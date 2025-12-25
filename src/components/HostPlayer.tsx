'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Volume2, VolumeX, Loader2, AlertCircle } from 'lucide-react';

// =============================================
// Types
// =============================================

interface SpotifyPlayer {
  connect(): Promise<boolean>;
  disconnect(): void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  addListener(event: string, callback: (state: any) => void): void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  removeListener(event: string, callback?: (state: any) => void): void;
  getCurrentState(): Promise<SpotifyPlaybackState | null>;
  setVolume(volume: number): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  seek(position_ms: number): Promise<void>;
  togglePlay(): Promise<void>;
}

interface SpotifyPlaybackState {
  paused: boolean;
  position: number;
  duration: number;
  track_window: {
    current_track: {
      uri: string;
      name: string;
      artists: { name: string }[];
    };
  };
}

interface HostPlayerProps {
  token: string | null;
  currentSong?: {
    spotifyUri: string;
    positionMs?: number;
  } | null;
  onReady?: (deviceId: string) => void;
  onError?: (error: string) => void;
  onPlaybackStarted?: () => void;
  onPlaybackEnded?: () => void;
}

type PlayerStatus = 'idle' | 'activating' | 'ready' | 'playing' | 'error';

// =============================================
// Component
// =============================================

export function HostPlayer({
  token,
  currentSong,
  onReady,
  onError,
  onPlaybackStarted,
  onPlaybackEnded,
}: HostPlayerProps) {
  const [status, setStatus] = useState<PlayerStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);

  const playerRef = useRef<SpotifyPlayer | null>(null);
  const tokenRef = useRef<string | null>(token);
  const lastSongUriRef = useRef<string | null>(null);

  // Keep token ref updated
  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  // -------------------------
  // Load Spotify SDK Script
  // -------------------------
  const loadSpotifyScript = useCallback((): Promise<void> => {
    return new Promise((resolve, reject) => {
      // Already loaded
      if (window.Spotify) {
        resolve();
        return;
      }

      // Already loading
      if (document.getElementById('spotify-player-script')) {
        // Wait for it to load
        const checkInterval = setInterval(() => {
          if (window.Spotify) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 100);
        return;
      }

      const script = document.createElement('script');
      script.id = 'spotify-player-script';
      script.src = 'https://sdk.scdn.co/spotify-player.js';
      script.async = true;

      window.onSpotifyWebPlaybackSDKReady = () => {
        console.log('[HostPlayer] Spotify SDK Ready');
        resolve();
      };

      script.onerror = () => {
        reject(new Error('Failed to load Spotify SDK'));
      };

      document.body.appendChild(script);
    });
  }, []);

  // -------------------------
  // Initialize Player
  // -------------------------
  const initializePlayer = useCallback(async () => {
    if (!tokenRef.current) {
      setErrorMessage('No hay token de Spotify disponible');
      setStatus('error');
      return;
    }

    setStatus('activating');
    setErrorMessage(null);

    try {
      await loadSpotifyScript();

      // Create player instance
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const SpotifyPlayerClass = (window as any).Spotify?.Player;
      if (!SpotifyPlayerClass) {
        throw new Error('Spotify SDK not loaded');
      }

      const player = new SpotifyPlayerClass({
        name: 'Adivina la Cancion - Host',
        getOAuthToken: (cb: (token: string) => void) => {
          if (tokenRef.current) {
            cb(tokenRef.current);
          }
        },
        volume: 0.5,
      }) as SpotifyPlayer;

      // Error listeners
      player.addListener('initialization_error', ({ message }: { message: string }) => {
        console.error('[HostPlayer] Initialization error:', message);
        setErrorMessage('Error al inicializar el reproductor');
        setStatus('error');
        onError?.('Error al inicializar el reproductor');
      });

      player.addListener('authentication_error', ({ message }: { message: string }) => {
        console.error('[HostPlayer] Authentication error:', message);
        setErrorMessage('Error de autenticacion. Vuelve a iniciar sesion.');
        setStatus('error');
        onError?.('Error de autenticacion');
      });

      player.addListener('account_error', ({ message }: { message: string }) => {
        console.error('[HostPlayer] Account error:', message);
        setErrorMessage('Se requiere Spotify Premium para reproducir musica.');
        setStatus('error');
        onError?.('Se requiere Spotify Premium');
      });

      player.addListener('playback_error', ({ message }: { message: string }) => {
        console.error('[HostPlayer] Playback error:', message);
        // Don't set error status for playback errors, just log
      });

      // Ready listener
      player.addListener('ready', async ({ device_id }: { device_id: string }) => {
        console.log('[HostPlayer] Ready with Device ID:', device_id);
        setDeviceId(device_id);

        // Transfer playback to this device
        try {
          await transferPlayback(device_id);
          setStatus('ready');
          onReady?.(device_id);
        } catch (err) {
          console.error('[HostPlayer] Transfer playback error:', err);
          setErrorMessage('Error al activar el reproductor');
          setStatus('error');
        }
      });

      // Not ready listener
      player.addListener('not_ready', ({ device_id }: { device_id: string }) => {
        console.log('[HostPlayer] Device has gone offline:', device_id);
        setStatus('idle');
        setDeviceId(null);
      });

      // Playback state change
      player.addListener('player_state_changed', (state: SpotifyPlaybackState | null) => {
        if (!state) return;

        if (state.paused) {
          onPlaybackEnded?.();
        }
      });

      // Connect
      const connected = await player.connect();
      if (!connected) {
        throw new Error('Failed to connect to Spotify');
      }

      playerRef.current = player;
      console.log('[HostPlayer] Player connected');
    } catch (err) {
      console.error('[HostPlayer] Error:', err);
      setErrorMessage(err instanceof Error ? err.message : 'Error desconocido');
      setStatus('error');
      onError?.(err instanceof Error ? err.message : 'Error desconocido');
    }
  }, [loadSpotifyScript, onReady, onError, onPlaybackEnded]);

  // -------------------------
  // Transfer Playback
  // -------------------------
  const transferPlayback = async (targetDeviceId: string) => {
    if (!tokenRef.current) return;

    const response = await fetch('https://api.spotify.com/v1/me/player', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenRef.current}`,
      },
      body: JSON.stringify({
        device_ids: [targetDeviceId],
        play: false,
      }),
    });

    if (!response.ok && response.status !== 204) {
      throw new Error('Failed to transfer playback');
    }
  };

  // -------------------------
  // Play Song with Fade In
  // -------------------------
  const playSong = useCallback(
    async (uri: string, positionMs: number = 0) => {
      if (!deviceId || !tokenRef.current || !playerRef.current) {
        console.warn('[HostPlayer] Cannot play: not ready');
        return;
      }

      try {
        // Set volume to 0 before playing (for fade in)
        await playerRef.current.setVolume(0);

        // Start playback via API
        const response = await fetch(
          `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`,
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${tokenRef.current}`,
            },
            body: JSON.stringify({
              uris: [uri],
              position_ms: positionMs,
            }),
          }
        );

        if (!response.ok && response.status !== 204) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error?.message || 'Failed to start playback');
        }

        setStatus('playing');
        onPlaybackStarted?.();

        // Fade in volume
        await new Promise((resolve) => setTimeout(resolve, 300));
        await fadeVolume(0, 0.8, 500);
      } catch (err) {
        console.error('[HostPlayer] Play error:', err);
        setErrorMessage('Error al reproducir');
      }
    },
    [deviceId, onPlaybackStarted]
  );

  // -------------------------
  // Fade Volume
  // -------------------------
  const fadeVolume = async (from: number, to: number, durationMs: number) => {
    if (!playerRef.current) return;

    const steps = 10;
    const stepDuration = durationMs / steps;
    const stepAmount = (to - from) / steps;

    for (let i = 0; i <= steps; i++) {
      const volume = from + stepAmount * i;
      await playerRef.current.setVolume(Math.max(0, Math.min(1, volume)));
      await new Promise((resolve) => setTimeout(resolve, stepDuration));
    }
  };

  // -------------------------
  // Pause
  // -------------------------
  const pausePlayback = useCallback(async () => {
    if (!playerRef.current) return;

    try {
      // Fade out first
      await fadeVolume(0.8, 0, 200);
      await playerRef.current.pause();
      setStatus('ready');
    } catch (err) {
      console.error('[HostPlayer] Pause error:', err);
    }
  }, []);

  // -------------------------
  // Watch for currentSong changes
  // -------------------------
  useEffect(() => {
    if (!currentSong || status !== 'ready' && status !== 'playing') return;

    // Check if it's a new song
    if (currentSong.spotifyUri !== lastSongUriRef.current) {
      lastSongUriRef.current = currentSong.spotifyUri;
      playSong(currentSong.spotifyUri, currentSong.positionMs || 0);
    }
  }, [currentSong, status, playSong]);

  // -------------------------
  // Cleanup on unmount
  // -------------------------
  useEffect(() => {
    return () => {
      if (playerRef.current) {
        playerRef.current.disconnect();
        playerRef.current = null;
      }
    };
  }, []);

  // -------------------------
  // Activate Button Handler
  // -------------------------
  const handleActivate = () => {
    initializePlayer();
  };

  // -------------------------
  // Retry Handler
  // -------------------------
  const handleRetry = () => {
    setStatus('idle');
    setErrorMessage(null);
  };

  // =============================================
  // RENDER
  // =============================================

  // No token - can't do anything
  if (!token) {
    return (
      <div className="flex items-center gap-2 text-gray-400 text-sm">
        <VolumeX className="w-4 h-4" />
        <span>Inicia sesion con Spotify</span>
      </div>
    );
  }

  // Idle - Show activate button
  if (status === 'idle') {
    return (
      <button
        onClick={handleActivate}
        className="flex items-center gap-3 bg-green-500 hover:bg-green-400 text-white font-semibold py-4 px-6 rounded-2xl transition-all transform hover:scale-105 shadow-lg shadow-green-500/30"
      >
        <Volume2 className="w-6 h-6" />
        <span>Activar Altavoces</span>
      </button>
    );
  }

  // Activating - Show loading
  if (status === 'activating') {
    return (
      <div className="flex items-center gap-3 bg-gray-700 text-white py-4 px-6 rounded-2xl">
        <Loader2 className="w-6 h-6 animate-spin" />
        <span>Conectando con Spotify...</span>
      </div>
    );
  }

  // Error - Show error with retry
  if (status === 'error') {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3 bg-red-500/20 border border-red-500/30 text-red-400 py-3 px-4 rounded-xl">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">{errorMessage}</span>
        </div>
        <button
          onClick={handleRetry}
          className="text-sm text-gray-400 hover:text-white underline"
        >
          Intentar de nuevo
        </button>
      </div>
    );
  }

  // Ready or Playing - Show status
  return (
    <div className="flex items-center gap-3">
      <div
        className={`flex items-center gap-2 py-2 px-4 rounded-xl ${
          status === 'playing'
            ? 'bg-green-500/20 text-green-400'
            : 'bg-gray-700/50 text-gray-300'
        }`}
      >
        <Volume2 className={`w-4 h-4 ${status === 'playing' ? 'animate-pulse' : ''}`} />
        <span className="text-sm font-medium">
          {status === 'playing' ? 'Reproduciendo...' : 'Audio Listo'}
        </span>
      </div>

      {status === 'playing' && (
        <button
          onClick={pausePlayback}
          className="text-gray-400 hover:text-white text-sm transition-colors"
        >
          Pausar
        </button>
      )}
    </div>
  );
}

// =============================================
// Export pause function for external use
// =============================================

export type HostPlayerHandle = {
  pause: () => Promise<void>;
  play: (uri: string, positionMs?: number) => Promise<void>;
};
