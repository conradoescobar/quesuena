'use client';

import { useState, useEffect, useCallback } from 'react';

interface SpotifyTokenData {
  access_token: string;
  refresh_token: string | null;
  expires_at: number;
  user_id: string;
}

interface UseSpotifyTokenReturn {
  token: string | null;
  isLoading: boolean;
  error: string | null;
  refreshToken: () => Promise<void>;
}

/**
 * Hook to manage Spotify access token on the client side
 *
 * This hook fetches the Spotify token from our API route and provides
 * methods to refresh it when needed.
 *
 * Usage:
 * ```tsx
 * const { token, isLoading, error, refreshToken } = useSpotifyToken();
 *
 * useEffect(() => {
 *   if (token) {
 *     // Initialize Spotify Web Playback SDK with token
 *     const player = new Spotify.Player({
 *       name: 'Adivina la canción',
 *       getOAuthToken: cb => cb(token),
 *     });
 *   }
 * }, [token]);
 * ```
 */
export function useSpotifyToken(): UseSpotifyTokenReturn {
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchToken = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/auth/spotify-token');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch token');
      }

      const tokenData = data as SpotifyTokenData;
      setToken(tokenData.access_token);

      // Check if token is about to expire (within 5 minutes)
      const expiresAt = tokenData.expires_at * 1000; // Convert to milliseconds
      const now = Date.now();
      const timeUntilExpiry = expiresAt - now;

      // If token expires in less than 5 minutes, schedule a refresh
      if (timeUntilExpiry < 5 * 60 * 1000 && timeUntilExpiry > 0) {
        console.warn('Spotify token expires soon, consider re-authenticating');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      setToken(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch token on mount
  useEffect(() => {
    fetchToken();
  }, [fetchToken]);

  return {
    token,
    isLoading,
    error,
    refreshToken: fetchToken,
  };
}
