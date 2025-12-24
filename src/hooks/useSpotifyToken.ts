'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface SpotifyTokenData {
  access_token: string;
  refresh_token?: string | null;
  expires_at: number;
  user_id?: string;
}

interface UseSpotifyTokenReturn {
  token: string | null;
  isLoading: boolean;
  error: string | null;
  expiresAt: number | null;
  refreshToken: () => Promise<void>;
}

/**
 * Hook para gestionar el token de Spotify con auto-refresh
 *
 * Funcionalidades:
 * 1. Obtiene el token inicial desde la sesión
 * 2. Monitorea la expiración y refresca automáticamente
 * 3. Proporciona método manual para refrescar si falla
 */
export function useSpotifyToken(): UseSpotifyTokenReturn {
  const [token, setToken] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const doRefreshRef = useRef<() => Promise<void>>();

  // Refrescar el token
  const doRefresh = useCallback(async () => {
    try {
      setError(null);

      const response = await fetch('/api/auth/refresh-spotify', {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to refresh token');
      }

      setToken(data.access_token);
      setExpiresAt(data.expires_at);

      // Schedule next refresh
      const now = Date.now();
      const expiresAtMs = data.expires_at * 1000;
      const timeUntilExpiry = expiresAtMs - now;
      const refreshIn = timeUntilExpiry - 5 * 60 * 1000; // 5 minutes before

      if (refreshIn > 0) {
        console.log(`Token refresh scheduled in ${Math.round(refreshIn / 1000 / 60)} minutes`);
        if (refreshTimeoutRef.current) {
          clearTimeout(refreshTimeoutRef.current);
        }
        refreshTimeoutRef.current = setTimeout(() => {
          console.log('Auto-refreshing Spotify token...');
          doRefreshRef.current?.();
        }, refreshIn);
      }

      console.log('Spotify token refreshed successfully');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      console.error('Token refresh failed:', message);
    }
  }, []);

  // Keep ref updated
  useEffect(() => {
    doRefreshRef.current = doRefresh;
  }, [doRefresh]);

  // Obtener token inicial desde la sesión
  const fetchInitialToken = useCallback(async () => {
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
      setExpiresAt(tokenData.expires_at);

      // Schedule refresh before expiry
      const now = Date.now();
      const expiresAtMs = tokenData.expires_at * 1000;
      const timeUntilExpiry = expiresAtMs - now;
      const refreshIn = timeUntilExpiry - 5 * 60 * 1000; // 5 minutes before

      if (refreshIn > 0) {
        console.log(`Token refresh scheduled in ${Math.round(refreshIn / 1000 / 60)} minutes`);
        refreshTimeoutRef.current = setTimeout(() => {
          console.log('Auto-refreshing Spotify token...');
          doRefreshRef.current?.();
        }, refreshIn);
      } else if (timeUntilExpiry > 0) {
        // Token expiring soon - refresh immediately
        console.log('Token expiring soon, refreshing now...');
        doRefresh();
      } else {
        // Token already expired
        console.log('Token expired, refreshing...');
        doRefresh();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      setToken(null);
    } finally {
      setIsLoading(false);
    }
  }, [doRefresh]);

  // Efecto inicial
  useEffect(() => {
    fetchInitialToken();

    return () => {
      // Limpiar timeout al desmontar
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, [fetchInitialToken]);

  // Método manual para refrescar (expuesto al componente)
  const refreshToken = useCallback(async () => {
    setIsLoading(true);
    await doRefresh();
    setIsLoading(false);
  }, [doRefresh]);

  return {
    token,
    isLoading,
    error,
    expiresAt,
    refreshToken,
  };
}
