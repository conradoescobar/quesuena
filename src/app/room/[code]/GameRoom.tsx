'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useGameRoom } from '@/hooks/useGameRoom';
import { updateRoomStatus, updatePlayerScore } from '@/lib/actions/room';
import { getRoomSongs, removeSong } from '@/lib/actions/songs';
import { SongSearch } from '@/components/SongSearch';
import { RoomQRCode } from '@/components/RoomQRCode';
import { YouTubePlayer } from '@/components/YouTubePlayer';
import { searchYouTube } from '@/lib/actions/game-actions';
import type { Room, Player, Song } from '@/types/database';

// Duración del snippet en milisegundos
const SNIPPET_DURATION_MS = 2000;

// =============================================
// Types
// =============================================

interface GameRoomProps {
  room: Room;
  initialPlayers: Player[];
  currentUser: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
  };
  isHost: boolean;
  isGuest?: boolean;
}

interface RoundState {
  winnerId: string | null;
  winnerName: string | null;
  isLocked: boolean;
}

// =============================================
// Main Component
// =============================================

export function GameRoom({ room, initialPlayers, currentUser, isHost, isGuest = false }: GameRoomProps) {
  const router = useRouter();

  // -------------------------
  // State
  // -------------------------
  const [songs, setSongs] = useState<Song[]>([]);
  const [dbPlayers, setDbPlayers] = useState<Player[]>(initialPlayers);
  const [roundState, setRoundState] = useState<RoundState>({
    winnerId: null,
    winnerName: null,
    isLocked: false,
  });
  const [roundTimer, setRoundTimer] = useState<number>(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [buzzCooldown, setBuzzCooldown] = useState(false);
  const [snippetPosition, setSnippetPosition] = useState<number>(0);
  const [isSnippetPlaying, setIsSnippetPlaying] = useState(false);
  const [isSearchingYouTube, setIsSearchingYouTube] = useState(false);
  const snippetTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // YouTube playback state (única fuente de audio)
  const [youtubeVideoId, setYoutubeVideoId] = useState<string | null>(null);
  const [isYouTubePlaying, setIsYouTubePlaying] = useState(false);
  const [youtubeError, setYoutubeError] = useState<string | null>(null);

  // -------------------------
  // Hooks
  // -------------------------

  // Realtime connection
  const {
    isConnected,
    connectionError,
    players: onlinePlayers,
    lastBuzz,
    sendBuzz,
    gameState,
    updateGameState,
  } = useGameRoom({
    roomCode: room.code,
    userId: currentUser.id,
    displayName: currentUser.displayName,
    avatarUrl: currentUser.avatarUrl,
  });

  // -------------------------
  // Cargar canciones de la DB
  // -------------------------
  const loadSongs = useCallback(async () => {
    const result = await getRoomSongs(room.id);
    if ('songs' in result) {
      setSongs(result.songs);
    }
  }, [room.id]);

  useEffect(() => {
    loadSongs();
  }, [loadSongs]);

  // -------------------------
  // Timer por ronda
  // -------------------------
  useEffect(() => {
    if (!isTimerRunning) return;

    const interval = setInterval(() => {
      setRoundTimer((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isTimerRunning]);

  // -------------------------
  // Resetear estado al cambiar de ronda
  // -------------------------
  useEffect(() => {
    if (gameState) {
      setRoundState({ winnerId: null, winnerName: null, isLocked: false });
      setRoundTimer(0);
      setIsTimerRunning(gameState.status === 'playing');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState?.current_round_index, gameState?.status]);

  // -------------------------
  // Manejar buzz entrante
  // -------------------------
  useEffect(() => {
    if (lastBuzz && !roundState.isLocked && gameState?.status === 'playing') {
      setRoundState({
        winnerId: lastBuzz.user_id,
        winnerName: lastBuzz.display_name,
        isLocked: true,
      });
      setIsTimerRunning(false);

      // Si soy host, pausar YouTube
      if (isHost) {
        setIsYouTubePlaying(false);
      }
    }
  }, [lastBuzz, roundState.isLocked, gameState?.status, isHost]);

  // -------------------------
  // Enviar buzz (con bloqueo)
  // -------------------------
  const handleBuzz = () => {
    if (buzzCooldown || roundState.isLocked || gameState?.status !== 'playing') return;

    sendBuzz();
    setBuzzCooldown(true);
    setTimeout(() => setBuzzCooldown(false), 2000);
  };

  // -------------------------
  // Reproducir snippet via YouTube
  // -------------------------
  const playSnippet = useCallback(async (song: Song, customPositionSeconds?: number) => {
    console.log('[GameRoom] Playing snippet via YouTube:', song.title, '-', song.artist);

    // Limpiar timeout anterior
    if (snippetTimeoutRef.current) {
      clearTimeout(snippetTimeoutRef.current);
    }

    // Resetear estado
    setIsYouTubePlaying(false);
    setYoutubeError(null);
    setIsSnippetPlaying(true);
    setIsSearchingYouTube(true);

    // Buscar el video en YouTube
    const ytResult = await searchYouTube(song.title, song.artist);
    setIsSearchingYouTube(false);

    if (ytResult.error || !ytResult.result) {
      console.warn('[GameRoom] YouTube search failed:', ytResult.error);
      setYoutubeError(ytResult.error || 'No se encontró en YouTube');
      setIsSnippetPlaying(false);
      return;
    }

    console.log('[GameRoom] Found YouTube video:', ytResult.result.videoId, ytResult.result.title);
    setYoutubeVideoId(ytResult.result.videoId);

    // Posición aleatoria entre 30-90 segundos (para saltar intros y anuncios pre-roll)
    const randomPosition = customPositionSeconds ?? (30 + Math.floor(Math.random() * 60));
    setSnippetPosition(randomPosition);

    // Pequeño delay para que el player se inicialice
    setTimeout(() => {
      setIsYouTubePlaying(true);
    }, 300);

    // Pausar después de SNIPPET_DURATION_MS
    snippetTimeoutRef.current = setTimeout(() => {
      console.log('[GameRoom] Snippet finished');
      setIsYouTubePlaying(false);
      setIsSnippetPlaying(false);
    }, SNIPPET_DURATION_MS + 300);
  }, []);

  // Repetir el mismo snippet
  const handleRepeat = useCallback(async () => {
    const songIndex = gameState?.current_round_index || 0;
    const song = songs[songIndex];
    if (song) {
      await playSnippet(song, snippetPosition);
    }
  }, [gameState?.current_round_index, songs, playSnippet, snippetPosition]);

  // -------------------------
  // Acciones del Host
  // -------------------------
  const handleStartGame = async () => {
    if (songs.length === 0) {
      alert('Agrega canciones primero.');
      return;
    }

    // 1. Persistir en DB
    await updateRoomStatus(room.id, 'playing', 0);

    // 2. Broadcast para sync inmediato
    updateGameState({ status: 'playing', current_round_index: 0 });

    // 3. Reproducir snippet de la primera canción
    await playSnippet(songs[0]);

    setIsTimerRunning(true);
  };

  const handleNextRound = async () => {
    const nextIndex = (gameState?.current_round_index || 0) + 1;

    // 1. Persistir en DB
    await updateRoomStatus(room.id, 'playing', nextIndex);

    // 2. Broadcast
    updateGameState({ status: 'playing', current_round_index: nextIndex });

    // 3. Reproducir snippet de la siguiente canción
    if (songs[nextIndex]) {
      await playSnippet(songs[nextIndex]);
    }

    // 4. Reset round state
    setRoundState({ winnerId: null, winnerName: null, isLocked: false });
    setRoundTimer(0);
    setIsTimerRunning(true);
  };

  const handleEndGame = async () => {
    // Limpiar timeout de snippet
    if (snippetTimeoutRef.current) {
      clearTimeout(snippetTimeoutRef.current);
    }

    // 1. Persistir
    await updateRoomStatus(room.id, 'finished', 0);

    // 2. Broadcast
    updateGameState({ status: 'finished', current_round_index: 0 });

    // 3. Pausar YouTube
    setIsYouTubePlaying(false);
    setYoutubeVideoId(null);

    setIsTimerRunning(false);
    setIsSnippetPlaying(false);
  };

  // -------------------------
  // Dar puntos al ganador
  // -------------------------
  const handleAwardPoints = async (playerId: string, points: number) => {
    const result = await updatePlayerScore(playerId, points);
    if ('success' in result) {
      // Actualizar lista local de jugadores
      setDbPlayers((prev) =>
        prev.map((p) =>
          p.id === playerId ? { ...p, score: p.score + points } : p
        )
      );

      // Broadcast actualización de puntos
      updateGameState({
        status: gameState?.status || 'playing',
        current_round_index: gameState?.current_round_index || 0,
        winner_id: playerId,
      });
    }
  };

  // -------------------------
  // Eliminar canción
  // -------------------------
  const handleRemoveSong = async (songId: string) => {
    const result = await removeSong(songId);
    if ('success' in result) {
      setSongs((prev) => prev.filter((s) => s.id !== songId));
    }
  };

  // -------------------------
  // Formato tiempo
  // -------------------------
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // -------------------------
  // Canción actual
  // -------------------------
  const currentSongIndex = gameState?.current_round_index || 0;
  const currentSong = songs[currentSongIndex];

  // -------------------------
  // Estado del juego efectivo
  // -------------------------
  const effectiveStatus = gameState?.status || room.status;
  const isBuzzerEnabled =
    effectiveStatus === 'playing' && !roundState.isLocked && !buzzCooldown && isConnected;

  // =============================================
  // RENDER
  // =============================================

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-4 md:p-8">
      {/* ===================== YOUTUBE PLAYER (HIDDEN) ===================== */}
      {isHost && youtubeVideoId && (
        <YouTubePlayer
          videoId={youtubeVideoId}
          isPlaying={isYouTubePlaying}
          startSeconds={snippetPosition}
          onReady={() => console.log('[GameRoom] YouTube player ready')}
          onStateChange={(state) => {
            console.log('[GameRoom] YouTube state:', state);
            if (state === 'ended') {
              setIsYouTubePlaying(false);
              setIsSnippetPlaying(false);
            }
          }}
          onError={(error) => {
            console.error('[GameRoom] YouTube error:', error);
            setYoutubeError(error);
            setIsYouTubePlaying(false);
            setIsSnippetPlaying(false);
          }}
        />
      )}

      {/* ===================== BUZZ ALERT OVERLAY ===================== */}
      {roundState.isLocked && roundState.winnerName && (
        <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none bg-black/50">
          <div className="animate-bounce text-center">
            <div
              className={`text-6xl md:text-8xl font-black ${
                roundState.winnerId === currentUser.id ? 'text-green-400' : 'text-yellow-400'
              }`}
            >
              {roundState.winnerId === currentUser.id ? '¡TU!' : roundState.winnerName}
            </div>
            <div className="text-3xl md:text-5xl text-white mt-2">🔔 BUZZ!</div>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto">
        {/* ===================== HEADER ===================== */}
        <header className="flex items-center justify-between gap-2 mb-4 lg:mb-6">
          <div className="flex-1 min-w-0">
            <h1 className="text-lg lg:text-2xl font-bold text-white truncate">
              <span className="text-green-400 tracking-widest">{room.code}</span>
            </h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <div className="flex items-center gap-1">
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`} />
                <span className="text-gray-400 text-xs lg:text-sm">
                  {isConnected ? 'OK' : 'Sin conexión'}
                </span>
              </div>
              {isGuest && (
                <span className="text-blue-400 text-xs bg-blue-500/20 px-2 py-0.5 rounded">
                  Invitado
                </span>
              )}
              {effectiveStatus === 'playing' && (
                <span className="text-purple-400 text-xs lg:text-sm hidden lg:inline">
                  Ronda {currentSongIndex + 1}/{songs.length || '?'}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* QR Code button - only for host */}
            {isHost && <RoomQRCode roomCode={room.code} />}

            <button
              onClick={() => router.push('/lobby')}
              className="text-gray-400 hover:text-white text-xs lg:text-sm transition-colors px-3 py-2 rounded-lg bg-white/5"
            >
              Salir
            </button>
          </div>
        </header>

        {/* ===================== MAIN GRID ===================== */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 lg:gap-6">

          {/* ===================== MOBILE: BUZZER FIRST ===================== */}
          <div className="lg:hidden space-y-4">
            {/* BUZZER - Prominente en móvil */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center">
              <button
                onClick={handleBuzz}
                disabled={!isBuzzerEnabled}
                className={`
                  w-32 h-32 rounded-full text-3xl font-black transition-all duration-200 transform mx-auto block
                  ${
                    !isBuzzerEnabled
                      ? 'bg-gray-700 text-gray-500 cursor-not-allowed scale-95'
                      : 'bg-red-500 hover:bg-red-600 text-white active:scale-90 shadow-lg shadow-red-500/50'
                  }
                `}
              >
                {roundState.isLocked ? '🔒' : buzzCooldown ? '...' : 'BUZZ!'}
              </button>
              <p className="text-gray-500 text-xs mt-3">
                {roundState.isLocked
                  ? `${roundState.winnerName} fue primero`
                  : effectiveStatus !== 'playing'
                  ? 'Esperando inicio...'
                  : 'Presiona cuando sepas la canción'}
              </p>

              {/* Estado + Timer en móvil */}
              <div className="flex items-center justify-center gap-4 mt-3">
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  effectiveStatus === 'playing' ? 'bg-green-500/20 text-green-400' :
                  effectiveStatus === 'waiting' ? 'bg-yellow-500/20 text-yellow-400' :
                  'bg-gray-500/20 text-gray-400'
                }`}>
                  {effectiveStatus}
                </span>
                {effectiveStatus === 'playing' && (
                  <span className="text-purple-400 text-sm font-mono">
                    {formatTime(roundTimer)}
                  </span>
                )}
              </div>
            </div>

            {/* Host Controls Mobile */}
            {isHost && (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                <div className="flex flex-wrap gap-2 justify-center">
                  {effectiveStatus === 'waiting' && (
                    <>
                      <button
                        onClick={handleStartGame}
                        disabled={songs.length === 0}
                        className="bg-green-500 hover:bg-green-600 disabled:bg-gray-600 text-white font-medium py-3 px-6 rounded-xl transition-colors text-sm"
                      >
                        ▶️ Iniciar
                      </button>
                      {songs.length === 0 && (
                        <p className="w-full text-center text-yellow-400 text-xs mt-2">
                          Agrega canciones primero ⬇️
                        </p>
                      )}
                    </>
                  )}
                  {effectiveStatus === 'playing' && (
                    <>
                      <button
                        onClick={handleRepeat}
                        disabled={isSnippetPlaying || isSearchingYouTube}
                        className="bg-yellow-500 disabled:bg-yellow-600 text-white font-medium py-3 px-4 rounded-xl text-sm"
                      >
                        {isSearchingYouTube ? '🔍' : isSnippetPlaying ? '🔊' : '🔁'}
                      </button>
                      <button
                        onClick={handleNextRound}
                        disabled={currentSongIndex >= songs.length - 1}
                        className="bg-purple-500 disabled:bg-gray-600 text-white font-medium py-3 px-4 rounded-xl text-sm"
                      >
                        ⏭️
                      </button>
                      <button
                        onClick={handleEndGame}
                        className="bg-gray-500 text-white font-medium py-3 px-4 rounded-xl text-sm"
                      >
                        🏁
                      </button>
                    </>
                  )}
                </div>

                {/* Dar puntos - móvil */}
                {roundState.isLocked && roundState.winnerId && (
                  <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-3 mt-3 text-center">
                    <p className="text-green-400 text-sm mb-2">
                      🎉 <strong>{roundState.winnerName}</strong> acertó!
                    </p>
                    <div className="flex gap-2 justify-center">
                      <button
                        onClick={() => {
                          const player = dbPlayers.find((p) => p.user_id === roundState.winnerId);
                          if (player) handleAwardPoints(player.id, 1);
                        }}
                        className="bg-green-500 text-white text-sm py-2 px-4 rounded-lg"
                      >
                        +1
                      </button>
                      <button
                        onClick={() => {
                          const player = dbPlayers.find((p) => p.user_id === roundState.winnerId);
                          if (player) handleAwardPoints(player.id, 2);
                        }}
                        className="bg-green-500 text-white text-sm py-2 px-4 rounded-lg"
                      >
                        +2
                      </button>
                    </div>
                  </div>
                )}

                {/* YouTube status */}
                <div className="mt-3 pt-3 border-t border-white/10 text-center">
                  <p className="text-xs text-gray-400">
                    {isSearchingYouTube ? '🔍 Buscando en YouTube...' :
                     isSnippetPlaying ? '🎵 Reproduciendo...' :
                     '▶ Audio via YouTube'}
                  </p>
                  {youtubeError && (
                    <p className="text-xs text-yellow-400 mt-1">⚠ {youtubeError}</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ===================== SIDEBAR: PLAYERS + RANKING ===================== */}
          <div className="lg:col-span-1 space-y-4 lg:space-y-6">
            {/* Players Online */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
              <h2 className="text-sm font-semibold text-gray-400 mb-3">
                En línea ({onlinePlayers.length})
              </h2>
              <ul className="space-y-2">
                {onlinePlayers.map((player) => (
                  <li key={player.user_id} className="flex items-center gap-2 p-2 rounded-lg bg-white/5">
                    {player.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={player.avatar_url} alt="" className="w-6 h-6 rounded-full" />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-purple-500 flex items-center justify-center text-white text-xs font-bold">
                        {player.display_name[0].toUpperCase()}
                      </div>
                    )}
                    <span className="text-white text-sm flex-1 truncate">{player.display_name}</span>
                    {player.user_id === room.host_id && (
                      <span className="text-xs text-yellow-400">👑</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            {/* Ranking */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
              <h2 className="text-sm font-semibold text-gray-400 mb-3">🏆 Ranking</h2>
              <ul className="space-y-2">
                {[...dbPlayers]
                  .sort((a, b) => b.score - a.score)
                  .map((player, idx) => (
                    <li key={player.id} className="flex items-center gap-2 p-2 rounded-lg bg-white/5">
                      <span className="text-lg">{idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '•'}</span>
                      <span className="text-white text-sm flex-1 truncate">{player.display_name}</span>
                      <span className="text-green-400 font-bold">{player.score}</span>
                    </li>
                  ))}
              </ul>
            </div>
          </div>

          {/* ===================== MAIN CONTENT (Desktop only for buzzer) ===================== */}
          <div className="hidden lg:block lg:col-span-2 lg:space-y-6">
            {/* Estado del juego */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center">
              <p className="text-gray-400 text-sm mb-1">Estado</p>
              <p className="text-2xl font-bold text-white capitalize">{effectiveStatus}</p>
              {currentSong && effectiveStatus === 'playing' && (
                <div className="mt-4 text-center">
                  {currentSong.album_art_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={currentSong.album_art_url}
                      alt=""
                      className="w-24 h-24 mx-auto rounded-lg mb-2 opacity-50 blur-sm"
                    />
                  )}
                  <p className="text-gray-500 text-sm">🎵 Canción #{currentSongIndex + 1}</p>
                </div>
              )}
            </div>

            {/* BUZZER */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
              <button
                onClick={handleBuzz}
                disabled={!isBuzzerEnabled}
                className={`
                  w-40 h-40 md:w-48 md:h-48 rounded-full text-4xl font-black transition-all duration-200 transform
                  ${
                    !isBuzzerEnabled
                      ? 'bg-gray-700 text-gray-500 cursor-not-allowed scale-95'
                      : 'bg-red-500 hover:bg-red-600 text-white hover:scale-105 active:scale-95 shadow-lg shadow-red-500/50'
                  }
                `}
              >
                {roundState.isLocked ? '🔒' : buzzCooldown ? '...' : 'BUZZ!'}
              </button>
              <p className="text-gray-500 text-sm mt-4">
                {roundState.isLocked
                  ? `${roundState.winnerName} fue primero`
                  : effectiveStatus !== 'playing'
                  ? 'Esperando inicio...'
                  : 'Presiona cuando sepas la canción'}
              </p>
            </div>

            {/* Host Controls */}
            {isHost && (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4">🎮 Controles del Host</h3>

                {/* Botones de control del juego */}
                <div className="flex flex-wrap gap-3 mb-4">
                  {effectiveStatus === 'waiting' && (
                    <>
                      <button
                        onClick={handleStartGame}
                        disabled={songs.length === 0}
                        className="bg-green-500 hover:bg-green-600 disabled:bg-gray-600 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                      >
                        ▶️ Iniciar Juego {songs.length > 0 && `(${songs.length} canciones)`}
                      </button>
                      {songs.length === 0 && (
                        <span className="text-yellow-400 text-sm">← Primero agrega canciones</span>
                      )}
                    </>
                  )}
                  {effectiveStatus === 'playing' && (
                    <>
                      <button
                        onClick={handleRepeat}
                        disabled={isSnippetPlaying || isSearchingYouTube}
                        className="bg-yellow-500 hover:bg-yellow-600 disabled:bg-yellow-600 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                      >
                        {isSearchingYouTube ? '🔍 Buscando...' : isSnippetPlaying ? '🔊 Sonando...' : '🔁 Repetir'}
                      </button>
                      <button
                        onClick={handleNextRound}
                        disabled={currentSongIndex >= songs.length - 1}
                        className="bg-purple-500 hover:bg-purple-600 disabled:bg-gray-600 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                      >
                        ⏭️ Siguiente
                      </button>
                      <button
                        onClick={handleEndGame}
                        className="bg-gray-500 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                      >
                        🏁 Terminar
                      </button>
                    </>
                  )}
                </div>

                {/* Dar puntos al ganador */}
                {roundState.isLocked && roundState.winnerId && (
                  <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 mt-4">
                    <p className="text-green-400 mb-2">
                      🎉 <strong>{roundState.winnerName}</strong> acertó!
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          const player = dbPlayers.find(
                            (p) => p.user_id === roundState.winnerId
                          );
                          if (player) handleAwardPoints(player.id, 1);
                        }}
                        className="bg-green-500 hover:bg-green-600 text-white text-sm py-1 px-3 rounded-lg"
                      >
                        +1 punto
                      </button>
                      <button
                        onClick={() => {
                          const player = dbPlayers.find(
                            (p) => p.user_id === roundState.winnerId
                          );
                          if (player) handleAwardPoints(player.id, 2);
                        }}
                        className="bg-green-500 hover:bg-green-600 text-white text-sm py-1 px-3 rounded-lg"
                      >
                        +2 puntos
                      </button>
                    </div>
                  </div>
                )}

                {/* YouTube status */}
                <div className="mt-4 pt-4 border-t border-white/10">
                  <p className="text-gray-400 text-sm">
                    {isSearchingYouTube ? '🔍 Buscando en YouTube...' :
                     isSnippetPlaying ? '🎵 Reproduciendo snippet...' :
                     '▶ Audio via YouTube'}
                  </p>
                  {youtubeError && (
                    <p className="text-yellow-400 text-sm mt-2">⚠ {youtubeError}</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ===================== SIDEBAR: SONG QUEUE ===================== */}
          <div className="lg:col-span-1 space-y-4 lg:space-y-6">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-3 lg:p-4">
              <h2 className="text-sm font-semibold text-gray-400 mb-2 lg:mb-3">🎵 Cola ({songs.length})</h2>

              {/* Buscador de Spotify (solo host) */}
              {isHost && (
                <div className="mb-3 lg:mb-4">
                  <SongSearch roomId={room.id} onSongAdded={loadSongs} />
                </div>
              )}

              <ul className="space-y-2 max-h-48 lg:max-h-60 overflow-y-auto">
                {songs.map((song, idx) => (
                  <li
                    key={song.id}
                    className={`flex items-center gap-2 p-2 rounded-lg ${
                      idx === currentSongIndex && effectiveStatus === 'playing'
                        ? 'bg-green-500/20 border border-green-500/30'
                        : 'bg-white/5'
                    }`}
                  >
                    {song.album_art_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={song.album_art_url} alt="" className="w-8 h-8 rounded" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm truncate">{song.title}</p>
                      <p className="text-gray-500 text-xs truncate">{song.artist}</p>
                    </div>
                    {isHost && (
                      <button
                        onClick={() => handleRemoveSong(song.id)}
                        className="text-red-400 hover:text-red-300 text-xs"
                      >
                        ✕
                      </button>
                    )}
                  </li>
                ))}
              </ul>

              {songs.length === 0 && (
                <p className="text-gray-500 text-sm text-center py-4">
                  No hay canciones. {isHost ? 'Agrega algunas!' : ''}
                </p>
              )}
            </div>

            {/* Connection errors */}
            {connectionError && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                <p className="text-red-400 text-sm">{connectionError}</p>
              </div>
            )}
          </div>
        </div>
      </div>

    </main>
  );
}
