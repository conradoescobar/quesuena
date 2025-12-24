'use client';

import { useEffect, useState, useCallback, useRef } from 'react';

// Tipos para el Spotify Web Playback SDK
interface SpotifyErrorEvent {
  message: string;
}

interface SpotifyDeviceEvent {
  device_id: string;
}

interface SpotifyPlaybackState {
  context: { uri: string; metadata: unknown };
  disallows: { pausing: boolean; skipping_prev: boolean };
  paused: boolean;
  position: number;
  duration: number;
  track_window: {
    current_track: SpotifyTrack;
    previous_tracks: SpotifyTrack[];
    next_tracks: SpotifyTrack[];
  };
}

export interface SpotifyTrack {
  uri: string;
  id: string;
  type: string;
  media_type: string;
  name: string;
  is_playable: boolean;
  album: { uri: string; name: string; images: { url: string }[] };
  artists: { uri: string; name: string }[];
}

interface SpotifyPlayerInit {
  name: string;
  getOAuthToken: (cb: (token: string) => void) => void;
  volume?: number;
}

interface SpotifyPlayerInstance {
  connect(): Promise<boolean>;
  disconnect(): void;
  addListener(
    event: 'initialization_error' | 'authentication_error' | 'account_error' | 'playback_error',
    callback: (error: SpotifyErrorEvent) => void
  ): void;
  addListener(
    event: 'ready' | 'not_ready',
    callback: (state: SpotifyDeviceEvent) => void
  ): void;
  addListener(
    event: 'player_state_changed',
    callback: (state: SpotifyPlaybackState | null) => void
  ): void;
  removeListener(event: string, callback?: (state: unknown) => void): void;
  getCurrentState(): Promise<SpotifyPlaybackState | null>;
  setName(name: string): Promise<void>;
  getVolume(): Promise<number>;
  setVolume(volume: number): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  togglePlay(): Promise<void>;
  seek(position_ms: number): Promise<void>;
  previousTrack(): Promise<void>;
  nextTrack(): Promise<void>;
}

interface SpotifyPlayerConstructor {
  new (options: SpotifyPlayerInit): SpotifyPlayerInstance;
}

interface SpotifySDK {
  Player: SpotifyPlayerConstructor;
}

declare global {
  interface Window {
    Spotify: SpotifySDK;
    onSpotifyWebPlaybackSDKReady: () => void;
  }
}

interface UseSpotifyPlayerOptions {
  token: string | null;
  isHost: boolean;
  onPlayerReady?: (deviceId: string) => void;
  onPlayerError?: (error: string) => void;
}

interface UseSpotifyPlayerReturn {
  player: SpotifyPlayerInstance | null;
  deviceId: string | null;
  isReady: boolean;
  isPlaying: boolean;
  currentTrack: SpotifyTrack | null;
  position: number;
  duration: number;
  error: string | null;
  // Controles (solo funcionan para el host)
  play: (spotifyUri: string) => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  seek: (positionMs: number) => Promise<void>;
  setVolume: (volume: number) => Promise<void>;
}

/**
 * Hook para el Spotify Web Playback SDK
 *
 * IMPORTANTE: Solo el host puede controlar la reproducción.
 * Los demás jugadores escuchan el estado via broadcast.
 */
export function useSpotifyPlayer({
  token,
  isHost,
  onPlayerReady,
  onPlayerError,
}: UseSpotifyPlayerOptions): UseSpotifyPlayerReturn {
  const playerRef = useRef<SpotifyPlayerInstance | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<SpotifyTrack | null>(null);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Cargar el SDK de Spotify
  useEffect(() => {
    // Solo el host necesita el player
    if (!isHost || !token) return;

    // Si ya existe el script, no lo cargamos de nuevo
    if (document.getElementById('spotify-player-script')) {
      if (window.Spotify) {
        initializePlayer();
      }
      return;
    }

    const script = document.createElement('script');
    script.id = 'spotify-player-script';
    script.src = 'https://sdk.scdn.co/spotify-player.js';
    script.async = true;

    window.onSpotifyWebPlaybackSDKReady = () => {
      console.log('Spotify SDK Ready');
      initializePlayer();
    };

    document.body.appendChild(script);

    return () => {
      // Cleanup: desconectar el player
      if (playerRef.current) {
        playerRef.current.disconnect();
        playerRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, token]);

  // Inicializar el player
  const initializePlayer = useCallback(() => {
    if (!token || playerRef.current) return;

    const player = new window.Spotify.Player({
      name: 'Adivina la Canción',
      getOAuthToken: (cb) => cb(token),
      volume: 0.5,
    });

    // Error handling
    player.addListener('initialization_error', (error) => {
      console.error('Initialization error:', error.message);
      setError(`Error de inicialización: ${error.message}`);
      onPlayerError?.(`Error de inicialización: ${error.message}`);
    });

    player.addListener('authentication_error', (error) => {
      console.error('Authentication error:', error.message);
      setError('Error de autenticación con Spotify. Vuelve a iniciar sesión.');
      onPlayerError?.('Error de autenticación con Spotify');
    });

    player.addListener('account_error', (error) => {
      console.error('Account error:', error.message);
      setError('Se requiere Spotify Premium para reproducir música.');
      onPlayerError?.('Se requiere Spotify Premium');
    });

    player.addListener('playback_error', (error) => {
      console.error('Playback error:', error.message);
      setError(`Error de reproducción: ${error.message}`);
    });

    // Ready
    player.addListener('ready', (state) => {
      console.log('Player ready with Device ID:', state.device_id);
      setDeviceId(state.device_id);
      setIsReady(true);
      setError(null);
      onPlayerReady?.(state.device_id);
    });

    // Not Ready
    player.addListener('not_ready', (state) => {
      console.log('Device has gone offline:', state.device_id);
      setIsReady(false);
    });

    // Playback state changes
    player.addListener('player_state_changed', (state) => {
      if (!state) return;

      setIsPlaying(!state.paused);
      setPosition(state.position);
      setDuration(state.duration);
      setCurrentTrack(state.track_window.current_track);
    });

    player.connect();
    playerRef.current = player;
  }, [token, onPlayerReady, onPlayerError]);

  // Reproducir una canción
  const play = useCallback(async (spotifyUri: string) => {
    if (!deviceId || !token) {
      setError('Player no está listo');
      return;
    }

    try {
      const response = await fetch(
        `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            uris: [spotifyUri],
          }),
        }
      );

      if (!response.ok && response.status !== 204) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Error al reproducir');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      setError(message);
      console.error('Play error:', err);
    }
  }, [deviceId, token]);

  // Pausar
  const pause = useCallback(async () => {
    if (playerRef.current) {
      await playerRef.current.pause();
    }
  }, []);

  // Reanudar
  const resume = useCallback(async () => {
    if (playerRef.current) {
      await playerRef.current.resume();
    }
  }, []);

  // Seek
  const seek = useCallback(async (positionMs: number) => {
    if (playerRef.current) {
      await playerRef.current.seek(positionMs);
    }
  }, []);

  // Volumen
  const setVolume = useCallback(async (volume: number) => {
    if (playerRef.current) {
      await playerRef.current.setVolume(volume);
    }
  }, []);

  // Actualizar posición periodicamente
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      setPosition((prev) => Math.min(prev + 1000, duration));
    }, 1000);

    return () => clearInterval(interval);
  }, [isPlaying, duration]);

  return {
    player: playerRef.current,
    deviceId,
    isReady,
    isPlaying,
    currentTrack,
    position,
    duration,
    error,
    play,
    pause,
    resume,
    seek,
    setVolume,
  };
}
