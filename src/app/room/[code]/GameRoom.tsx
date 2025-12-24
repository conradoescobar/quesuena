'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useGameRoom } from '@/hooks/useGameRoom';
import { useSpotifyToken } from '@/hooks/useSpotifyToken';
import type { Room, Player } from '@/types/database';

interface GameRoomProps {
  room: Room;
  initialPlayers: Player[];
  currentUser: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
  };
  isHost: boolean;
}

export function GameRoom({ room, currentUser, isHost }: GameRoomProps) {
  const router = useRouter();
  const [buzzCooldown, setBuzzCooldown] = useState(false);

  // Connect to the real-time channel
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

  // Get Spotify token for playback
  const { token: spotifyToken, error: tokenError } = useSpotifyToken();

  // Handle buzz with cooldown
  const handleBuzz = () => {
    if (buzzCooldown) return;

    sendBuzz();
    setBuzzCooldown(true);

    // 2 second cooldown
    setTimeout(() => setBuzzCooldown(false), 2000);
  };

  // Show buzz animation when someone buzzes
  const [showBuzzAlert, setShowBuzzAlert] = useState(false);
  const [buzzer, setBuzzer] = useState<{ name: string; isMe: boolean } | null>(null);

  useEffect(() => {
    if (lastBuzz) {
      setBuzzer({
        name: lastBuzz.display_name,
        isMe: lastBuzz.user_id === currentUser.id,
      });
      setShowBuzzAlert(true);

      // Hide after 2 seconds
      const timer = setTimeout(() => setShowBuzzAlert(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [lastBuzz, currentUser.id]);

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-4 md:p-8">
      {/* Buzz Alert Overlay */}
      {showBuzzAlert && buzzer && (
        <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
          <div
            className={`
              animate-pulse text-6xl md:text-8xl font-black text-center
              ${buzzer.isMe ? 'text-green-400' : 'text-yellow-400'}
            `}
          >
            {buzzer.isMe ? 'TU!' : buzzer.name}
            <div className="text-2xl md:text-4xl mt-2">BUZZ!</div>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <header className="flex flex-col md:flex-row items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">
              Sala: <span className="text-green-400 tracking-widest">{room.code}</span>
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <div
                className={`w-2 h-2 rounded-full ${
                  isConnected ? 'bg-green-400' : 'bg-red-400'
                }`}
              />
              <span className="text-gray-400 text-sm">
                {isConnected ? 'Conectado' : connectionError || 'Conectando...'}
              </span>
            </div>
          </div>

          <button
            onClick={() => router.push('/lobby')}
            className="text-gray-400 hover:text-white text-sm transition-colors"
          >
            Salir de la sala
          </button>
        </header>

        {/* Main Content */}
        <div className="grid md:grid-cols-3 gap-6">
          {/* Players List */}
          <div className="md:col-span-1 bg-white/5 border border-white/10 rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">
              Jugadores ({onlinePlayers.length})
            </h2>
            <ul className="space-y-3">
              {onlinePlayers.map((player) => (
                <li
                  key={player.user_id}
                  className="flex items-center gap-3 p-2 rounded-lg bg-white/5"
                >
                  {player.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={player.avatar_url}
                      alt={player.display_name}
                      className="w-8 h-8 rounded-full"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center text-white text-sm font-bold">
                      {player.display_name[0].toUpperCase()}
                    </div>
                  )}
                  <span className="text-white text-sm flex-1">{player.display_name}</span>
                  {player.user_id === room.host_id && (
                    <span className="text-xs text-yellow-400">Host</span>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Game Area */}
          <div className="md:col-span-2 space-y-6">
            {/* Status */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center">
              <p className="text-gray-400 mb-2">Estado de la partida</p>
              <p className="text-2xl font-bold text-white capitalize">
                {gameState?.status || room.status}
              </p>
              {room.status === 'waiting' && (
                <p className="text-gray-500 text-sm mt-2">
                  Esperando a que el host inicie la partida...
                </p>
              )}
            </div>

            {/* Buzzer */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
              <h3 className="text-lg font-semibold text-white mb-6">Buzzer</h3>
              <button
                onClick={handleBuzz}
                disabled={buzzCooldown || !isConnected}
                className={`
                  w-48 h-48 rounded-full text-4xl font-black transition-all duration-200 transform
                  ${buzzCooldown
                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed scale-95'
                    : 'bg-red-500 hover:bg-red-600 text-white hover:scale-105 active:scale-95 shadow-lg shadow-red-500/50'
                  }
                `}
              >
                {buzzCooldown ? '...' : 'BUZZ!'}
              </button>
              <p className="text-gray-500 text-sm mt-4">
                Presiona cuando sepas la cancion
              </p>
            </div>

            {/* Host Controls */}
            {isHost && (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Controles del Host</h3>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => updateGameState({ status: 'playing', current_round_index: 0 })}
                    className="bg-green-500 hover:bg-green-600 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                  >
                    Iniciar Juego
                  </button>
                  <button
                    onClick={() =>
                      updateGameState({
                        status: 'playing',
                        current_round_index: (gameState?.current_round_index || 0) + 1,
                      })
                    }
                    className="bg-purple-500 hover:bg-purple-600 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                  >
                    Siguiente Ronda
                  </button>
                  <button
                    onClick={() =>
                      updateGameState({ status: 'finished', current_round_index: 0 })
                    }
                    className="bg-gray-500 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                  >
                    Terminar Partida
                  </button>
                </div>
              </div>
            )}

            {/* Spotify Token Status (for debugging) */}
            {spotifyToken && (
              <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 text-center">
                <p className="text-green-400 text-sm">
                  Spotify conectado - Listo para reproducir musica
                </p>
              </div>
            )}
            {tokenError && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-center">
                <p className="text-red-400 text-sm">
                  Error de Spotify: {tokenError}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
