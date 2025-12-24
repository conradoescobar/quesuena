'use server';

import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';

/**
 * Sign in with Spotify OAuth
 *
 * IMPORTANT: For accessing the Spotify Web Playback SDK, we need specific scopes.
 * The provider_token returned by Supabase Auth contains the Spotify Access Token.
 *
 * Required Spotify scopes for music playback:
 * - streaming: Play music on Spotify
 * - user-read-email: Get user email
 * - user-read-private: Get user profile
 * - user-modify-playback-state: Control playback
 * - user-read-playback-state: Read playback state
 */
export async function signInWithSpotify() {
  const supabase = await createClient();
  const headersList = await headers();
  const origin = headersList.get('origin') || 'http://localhost:3000';

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'spotify',
    options: {
      redirectTo: `${origin}/auth/callback`,
      scopes: [
        'streaming',
        'user-read-email',
        'user-read-private',
        'user-modify-playback-state',
        'user-read-playback-state',
        'user-read-currently-playing',
      ].join(' '),
    },
  });

  if (error) {
    console.error('Spotify auth error:', error);
    throw new Error('Failed to initiate Spotify login');
  }

  if (data.url) {
    redirect(data.url);
  }
}

/**
 * Sign out the current user
 */
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/');
}

/**
 * Get the current user session including the Spotify provider token
 *
 * CRITICAL: The provider_token (Spotify Access Token) is only available
 * immediately after login. Supabase stores it in the session but it may expire.
 *
 * For production, you should:
 * 1. Store the provider_refresh_token in your database
 * 2. Use Spotify's token refresh endpoint when the access token expires
 */
export async function getSession() {
  const supabase = await createClient();
  const { data: { session }, error } = await supabase.auth.getSession();

  if (error) {
    console.error('Session error:', error);
    return null;
  }

  return session;
}

/**
 * Get the Spotify tokens from the current session
 *
 * Returns both the access token and refresh token for Spotify API calls.
 * The access token is used for immediate API calls.
 * The refresh token can be used to get a new access token when it expires.
 */
export async function getSpotifyTokens() {
  const session = await getSession();

  if (!session) {
    return null;
  }

  return {
    accessToken: session.provider_token,
    refreshToken: session.provider_refresh_token,
    expiresAt: session.expires_at,
  };
}

/**
 * Get the current authenticated user
 */
export async function getUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error) {
    console.error('User error:', error);
    return null;
  }

  return user;
}
