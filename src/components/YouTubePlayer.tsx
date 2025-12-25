'use client';

import { useEffect, useRef, useCallback, useState } from 'react';

// YouTube IFrame API types
interface YTPlayer {
  playVideo(): void;
  pauseVideo(): void;
  stopVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  setVolume(volume: number): void;
  getVolume(): number;
  mute(): void;
  unMute(): void;
  isMuted(): boolean;
  getPlayerState(): number;
  destroy(): void;
}

interface YTPlayerEvent {
  target: YTPlayer;
  data: number;
}

declare global {
  interface Window {
    YT: {
      Player: new (
        elementId: string,
        options: {
          height?: string;
          width?: string;
          videoId?: string;
          playerVars?: {
            autoplay?: 0 | 1;
            controls?: 0 | 1;
            disablekb?: 0 | 1;
            fs?: 0 | 1;
            modestbranding?: 0 | 1;
            rel?: 0 | 1;
            showinfo?: 0 | 1;
            origin?: string;
            playsinline?: 0 | 1;
          };
          events?: {
            onReady?: (event: YTPlayerEvent) => void;
            onStateChange?: (event: YTPlayerEvent) => void;
            onError?: (event: YTPlayerEvent) => void;
          };
        }
      ) => YTPlayer;
      PlayerState: {
        UNSTARTED: number;
        ENDED: number;
        PLAYING: number;
        PAUSED: number;
        BUFFERING: number;
        CUED: number;
      };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

// Player states
const PlayerState = {
  UNSTARTED: -1,
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3,
  CUED: 5,
};

interface YouTubePlayerProps {
  videoId: string | null;
  isPlaying: boolean;
  startSeconds?: number;
  onReady?: () => void;
  onStateChange?: (state: 'playing' | 'paused' | 'ended' | 'buffering') => void;
  onError?: (error: string) => void;
}

export function YouTubePlayer({
  videoId,
  isPlaying,
  startSeconds = 30,
  onReady,
  onStateChange,
  onError,
}: YouTubePlayerProps) {
  const playerRef = useRef<YTPlayer | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isAPIReady, setIsAPIReady] = useState(false);
  const currentVideoIdRef = useRef<string | null>(null);

  // Load YouTube IFrame API
  useEffect(() => {
    if (window.YT && window.YT.Player) {
      setIsAPIReady(true);
      return;
    }

    // Check if script is already being loaded
    if (document.getElementById('youtube-iframe-api')) {
      const checkReady = setInterval(() => {
        if (window.YT && window.YT.Player) {
          setIsAPIReady(true);
          clearInterval(checkReady);
        }
      }, 100);
      return () => clearInterval(checkReady);
    }

    // Load the API
    const tag = document.createElement('script');
    tag.id = 'youtube-iframe-api';
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

    window.onYouTubeIframeAPIReady = () => {
      console.log('[YouTubePlayer] IFrame API Ready');
      setIsAPIReady(true);
    };
  }, []);

  // Initialize or update player when videoId changes
  useEffect(() => {
    if (!isAPIReady || !videoId) return;

    // If it's the same video, don't recreate
    if (videoId === currentVideoIdRef.current && playerRef.current) {
      return;
    }

    currentVideoIdRef.current = videoId;

    // Destroy existing player
    if (playerRef.current) {
      try {
        playerRef.current.destroy();
      } catch (e) {
        console.warn('[YouTubePlayer] Error destroying player:', e);
      }
      playerRef.current = null;
    }

    // Create new player
    console.log('[YouTubePlayer] Creating player for video:', videoId);

    try {
      playerRef.current = new window.YT.Player('youtube-player-container', {
        height: '1',
        width: '1',
        videoId: videoId,
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
          origin: typeof window !== 'undefined' ? window.location.origin : undefined,
        },
        events: {
          onReady: (event) => {
            console.log('[YouTubePlayer] Player ready');
            event.target.setVolume(100);
            // Seek to start position
            event.target.seekTo(startSeconds, true);
            onReady?.();
          },
          onStateChange: (event) => {
            switch (event.data) {
              case PlayerState.PLAYING:
                onStateChange?.('playing');
                break;
              case PlayerState.PAUSED:
                onStateChange?.('paused');
                break;
              case PlayerState.ENDED:
                onStateChange?.('ended');
                break;
              case PlayerState.BUFFERING:
                onStateChange?.('buffering');
                break;
            }
          },
          onError: (event) => {
            console.error('[YouTubePlayer] Error:', event.data);
            let errorMsg = 'Error al reproducir video';
            switch (event.data) {
              case 2:
                errorMsg = 'ID de video invalido';
                break;
              case 5:
                errorMsg = 'Error de HTML5 player';
                break;
              case 100:
                errorMsg = 'Video no encontrado';
                break;
              case 101:
              case 150:
                errorMsg = 'Video no disponible para embed';
                break;
            }
            onError?.(errorMsg);
          },
        },
      });
    } catch (e) {
      console.error('[YouTubePlayer] Error creating player:', e);
      onError?.('Error al crear el reproductor');
    }
  }, [isAPIReady, videoId, startSeconds, onReady, onStateChange, onError]);

  // Handle play/pause
  const play = useCallback(() => {
    if (playerRef.current) {
      try {
        playerRef.current.playVideo();
      } catch (e) {
        console.error('[YouTubePlayer] Play error:', e);
      }
    }
  }, []);

  const pause = useCallback(() => {
    if (playerRef.current) {
      try {
        playerRef.current.pauseVideo();
      } catch (e) {
        console.error('[YouTubePlayer] Pause error:', e);
      }
    }
  }, []);

  // React to isPlaying prop changes
  useEffect(() => {
    if (!playerRef.current) return;

    if (isPlaying) {
      play();
    } else {
      pause();
    }
  }, [isPlaying, play, pause]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch (e) {
          console.warn('[YouTubePlayer] Cleanup error:', e);
        }
        playerRef.current = null;
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        width: '1px',
        height: '1px',
        overflow: 'hidden',
        opacity: 0,
        pointerEvents: 'none',
      }}
    >
      <div id="youtube-player-container" />
    </div>
  );
}
