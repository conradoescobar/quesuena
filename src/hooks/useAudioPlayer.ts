'use client';

import { useCallback, useRef, useState } from 'react';

interface UseAudioPlayerReturn {
  isPlaying: boolean;
  isReady: boolean;
  error: string | null;
  play: (url: string, startPosition?: number) => Promise<void>;
  pause: () => void;
  stop: () => void;
}

/**
 * Hook para reproducir audio usando HTML5 Audio API
 * Funciona en todos los dispositivos incluyendo móvil
 */
export function useAudioPlayer(): UseAudioPlayerReturn {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // HTML5 Audio siempre está listo
  const isReady = true;

  const play = useCallback(async (url: string, startPosition?: number) => {
    try {
      setError(null);

      // Detener audio anterior si existe
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }

      // Crear nuevo elemento de audio
      const audio = new Audio(url);
      audioRef.current = audio;

      // Configurar evento de cuando está listo
      audio.addEventListener('canplaythrough', () => {
        // Si hay posición de inicio, establecerla
        if (startPosition !== undefined && startPosition > 0) {
          // startPosition está en ms, currentTime usa segundos
          audio.currentTime = startPosition / 1000;
        }
        audio.play().catch(err => {
          console.error('Play error:', err);
          setError('Error al reproducir');
          setIsPlaying(false);
        });
      }, { once: true });

      audio.addEventListener('play', () => {
        setIsPlaying(true);
      });

      audio.addEventListener('pause', () => {
        setIsPlaying(false);
      });

      audio.addEventListener('ended', () => {
        setIsPlaying(false);
      });

      audio.addEventListener('error', () => {
        setError('Error al cargar el audio');
        setIsPlaying(false);
      });

      // Iniciar carga
      audio.load();
    } catch (err) {
      console.error('Audio player error:', err);
      setError('Error al inicializar el reproductor');
      setIsPlaying(false);
    }
  }, []);

  const pause = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  }, []);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      setIsPlaying(false);
    }
  }, []);

  return {
    isPlaying,
    isReady,
    error,
    play,
    pause,
    stop,
  };
}
