import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

/**
 * OAuth Callback Handler
 *
 * This route handles the callback from Spotify OAuth.
 * After Supabase Auth exchanges the code for tokens, the session will contain:
 * - session.provider_token: Spotify Access Token
 * - session.provider_refresh_token: Spotify Refresh Token
 *
 * These tokens are crucial for controlling music playback via Spotify SDK.
 */
export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next') ?? '/lobby';
  const origin = requestUrl.origin;

  if (code) {
    const supabase = await createClient();

    // Exchange the code for a session
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Successfully authenticated - redirect to the lobby or specified page
      return NextResponse.redirect(`${origin}${next}`);
    }

    console.error('Auth callback error:', error);
  }

  // If there's an error or no code, redirect to home with error
  return NextResponse.redirect(`${origin}/?error=auth_failed`);
}
