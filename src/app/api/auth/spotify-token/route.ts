import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

/**
 * API Route to get Spotify tokens for client-side SDK
 *
 * If the provider_token is not in the session (common after page refresh),
 * we use the stored refresh_token to get a new access token from Spotify.
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

  // If we have a provider_token in session, use it
  if (session.provider_token) {
    return NextResponse.json({
      access_token: session.provider_token,
      refresh_token: session.provider_refresh_token,
      expires_at: session.expires_at,
      user_id: session.user.id,
    });
  }

  // Otherwise, try to refresh using stored refresh_token
  const { data: tokenData, error: tokenError } = await supabase
    .from('spotify_tokens')
    .select('refresh_token')
    .eq('user_id', session.user.id)
    .single();

  if (tokenError || !tokenData?.refresh_token) {
    return NextResponse.json(
      {
        error: 'No Spotify token available',
        message: 'Please log out and log in again with Spotify',
      },
      { status: 400 }
    );
  }

  // Refresh the token from Spotify
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: 'Spotify credentials not configured' },
      { status: 500 }
    );
  }

  try {
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: tokenData.refresh_token,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Spotify token refresh failed:', errorData);
      return NextResponse.json(
        {
          error: 'Failed to refresh Spotify token',
          message: 'Please log out and log in again',
        },
        { status: 400 }
      );
    }

    const data = await response.json();

    // If Spotify returned a new refresh token, save it
    if (data.refresh_token) {
      await supabase
        .from('spotify_tokens')
        .update({ refresh_token: data.refresh_token })
        .eq('user_id', session.user.id);
    }

    const expiresAt = Math.floor(Date.now() / 1000) + data.expires_in;

    return NextResponse.json({
      access_token: data.access_token,
      expires_at: expiresAt,
      user_id: session.user.id,
    });
  } catch (err) {
    console.error('Error refreshing Spotify token:', err);
    return NextResponse.json(
      { error: 'Failed to refresh token' },
      { status: 500 }
    );
  }
}
