import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

/**
 * API Route to get Spotify tokens for client-side SDK
 *
 * The Spotify Web Playback SDK needs the access token to initialize.
 * This endpoint securely provides the token to authorized users.
 *
 * IMPORTANT: The provider_token is the Spotify Access Token.
 * It expires after ~1 hour. For production, implement token refresh logic.
 */
export async function GET() {
  const supabase = await createClient();

  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error || !session) {
    return NextResponse.json(
      { error: 'Not authenticated' },
      { status: 401 }
    );
  }

  // Check if we have a Spotify token
  if (!session.provider_token) {
    return NextResponse.json(
      {
        error: 'No Spotify token available',
        message: 'Please re-authenticate with Spotify',
      },
      { status: 400 }
    );
  }

  return NextResponse.json({
    access_token: session.provider_token,
    refresh_token: session.provider_refresh_token,
    expires_at: session.expires_at,
    user_id: session.user.id,
  });
}
