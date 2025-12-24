import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

/**
 * API Route para refrescar el access token de Spotify
 *
 * Usa el refresh_token almacenado en la base de datos para obtener
 * un nuevo access_token cuando el actual está por expirar.
 *
 * POST /api/auth/refresh-spotify
 */
export async function POST() {
  const supabase = await createClient();

  // Verificar autenticación
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  // Obtener refresh token de la base de datos
  const { data: tokenData, error: tokenError } = await supabase
    .from('spotify_tokens')
    .select('refresh_token')
    .eq('user_id', user.id)
    .single();

  if (tokenError || !tokenData?.refresh_token) {
    // Si no hay refresh token en DB, intentar obtenerlo de la sesión
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session?.provider_refresh_token) {
      // Guardar el refresh token en la DB para futuros usos
      await supabase.from('spotify_tokens').upsert({
        user_id: user.id,
        refresh_token: session.provider_refresh_token,
        expires_at: session.expires_at
          ? new Date(session.expires_at * 1000).toISOString()
          : null,
      });

      // Devolver el token actual si aún es válido
      if (session.provider_token) {
        return NextResponse.json({
          access_token: session.provider_token,
          expires_at: session.expires_at,
        });
      }
    }

    return NextResponse.json(
      { error: 'No refresh token available. Please re-authenticate.' },
      { status: 400 }
    );
  }

  // Obtener credenciales de Spotify desde Supabase Auth config
  // NOTA: En producción, deberías tener estas en variables de entorno
  const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
  const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
    // Fallback: si no tenemos las credenciales, pedir re-autenticación
    return NextResponse.json(
      { error: 'Spotify credentials not configured. Please re-authenticate.' },
      { status: 500 }
    );
  }

  try {
    // Refrescar el token con Spotify
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(
          `${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`
        ).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: tokenData.refresh_token,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Spotify refresh error:', errorData);

      // Si el refresh token es inválido, eliminarlo
      if (errorData.error === 'invalid_grant') {
        await supabase
          .from('spotify_tokens')
          .delete()
          .eq('user_id', user.id);
      }

      return NextResponse.json(
        { error: 'Failed to refresh token. Please re-authenticate.' },
        { status: 400 }
      );
    }

    const data = await response.json();

    // Si Spotify devuelve un nuevo refresh token, actualizarlo
    if (data.refresh_token) {
      await supabase.from('spotify_tokens').upsert({
        user_id: user.id,
        refresh_token: data.refresh_token,
        expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
      });
    }

    return NextResponse.json({
      access_token: data.access_token,
      expires_in: data.expires_in,
      expires_at: Math.floor(Date.now() / 1000) + data.expires_in,
    });
  } catch (error) {
    console.error('Error refreshing Spotify token:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
