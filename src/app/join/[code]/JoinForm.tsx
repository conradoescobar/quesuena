'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { joinRoom, joinRoomAsGuest } from '@/lib/actions/room';

interface JoinFormProps {
  roomCode: string;
  spotifyName: string | null;
  isLoggedIn: boolean;
}

export function JoinForm({ roomCode, spotifyName, isLoggedIn }: JoinFormProps) {
  const router = useRouter();
  const [nickname, setNickname] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handle join as logged-in Spotify user
  const handleJoinAsUser = async () => {
    setIsLoading(true);
    setError(null);

    const result = await joinRoom(roomCode);

    if ('error' in result) {
      setError(result.error);
      setIsLoading(false);
      return;
    }

    router.push(`/room/${roomCode}`);
  };

  // Handle join as guest
  const handleJoinAsGuest = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const result = await joinRoomAsGuest(roomCode, nickname);

    if ('error' in result) {
      setError(result.error);
      setIsLoading(false);
      return;
    }

    router.push(`/room/${roomCode}`);
  };

  return (
    <div className="space-y-6">
      {/* Option 1: Join as Spotify user (if logged in) */}
      {isLoggedIn && spotifyName && (
        <div className="space-y-4">
          <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
            <p className="text-green-400 text-sm mb-1">Sesion de Spotify activa</p>
            <p className="text-white font-medium">{spotifyName}</p>
          </div>

          <button
            onClick={handleJoinAsUser}
            disabled={isLoading}
            className="w-full bg-green-500 hover:bg-green-600 disabled:bg-gray-600 text-white font-semibold py-4 px-6 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <span className="animate-spin">&#9696;</span>
                Entrando...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                </svg>
                Entrar como {spotifyName}
              </>
            )}
          </button>

          <div className="flex items-center gap-4">
            <div className="flex-1 h-px bg-white/10"></div>
            <span className="text-gray-500 text-sm">o</span>
            <div className="flex-1 h-px bg-white/10"></div>
          </div>
        </div>
      )}

      {/* Option 2: Join as guest */}
      <form onSubmit={handleJoinAsGuest} className="space-y-4">
        <div>
          <label htmlFor="nickname" className="block text-gray-400 text-sm mb-2">
            {isLoggedIn ? 'Entrar como invitado' : 'Tu nombre'}
          </label>
          <input
            type="text"
            id="nickname"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="Ej: Juan, Maria, ElMaster..."
            maxLength={20}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
            disabled={isLoading}
            autoFocus={!isLoggedIn}
          />
          <p className="text-gray-500 text-xs mt-1">2-20 caracteres</p>
        </div>

        <button
          type="submit"
          disabled={isLoading || nickname.trim().length < 2}
          className="w-full bg-purple-500 hover:bg-purple-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-4 px-6 rounded-xl transition-colors"
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="animate-spin">&#9696;</span>
              Entrando...
            </span>
          ) : (
            'Entrar como Invitado'
          )}
        </button>
      </form>

      {/* Error message */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Info for guests */}
      {!isLoggedIn && (
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
          <p className="text-blue-400 text-sm">
            <strong>Modo invitado:</strong> Podras buscar canciones y participar en el juego.
            El host (con Spotify Premium) reproducira el audio.
          </p>
        </div>
      )}

      {/* Link to login with Spotify */}
      {!isLoggedIn && (
        <div className="text-center">
          <a
            href="/"
            className="text-gray-400 hover:text-white text-sm underline transition-colors"
          >
            Iniciar sesion con Spotify
          </a>
        </div>
      )}
    </div>
  );
}
