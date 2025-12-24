import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

/**
 * OAuth Callback Handler
 *
 * Este handler:
 * 1. Intercambia el código por una sesión
 * 2. Guarda el refresh_token de Spotify en la DB para futuros refreshes
 * 3. Redirige al usuario al lobby
 */
export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next') ?? '/lobby';
  const origin = requestUrl.origin;

  if (code) {
    const supabase = await createClient();

    // Exchange the code for a session
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.session) {
      // Guardar el refresh token de Spotify en la base de datos
      // Esto nos permite refrescar el token más tarde sin re-autenticar
      if (data.session.provider_refresh_token) {
        const { error: tokenError } = await supabase
          .from('spotify_tokens')
          .upsert({
            user_id: data.session.user.id,
            refresh_token: data.session.provider_refresh_token,
            expires_at: data.session.expires_at
              ? new Date(data.session.expires_at * 1000).toISOString()
              : null,
          });

        if (tokenError) {
          // No es crítico, solo logueamos
          console.warn('Failed to save Spotify refresh token:', tokenError);
        }
      }

      // Redirect al lobby
      return NextResponse.redirect(`${origin}${next}`);
    }

    console.error('Auth callback error:', error);
  }

  // Error: redirigir a home con mensaje
  return NextResponse.redirect(`${origin}/?error=auth_failed`);
}
