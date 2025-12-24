'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createRoom, joinRoom } from '@/lib/actions/room';

export function LobbyClient() {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleCreateRoom = async () => {
    setIsCreating(true);
    setError(null);

    try {
      const result = await createRoom();

      if ('error' in result) {
        setError(result.error);
        return;
      }

      // Navigate to the room
      router.push(`/room/${result.code}`);
    } catch {
      setError('Failed to create room. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!joinCode.trim()) {
      setError('Please enter a room code');
      return;
    }

    setIsJoining(true);
    setError(null);

    try {
      const result = await joinRoom(joinCode.trim());

      if ('error' in result) {
        setError(result.error);
        return;
      }

      // Navigate to the room using the code
      router.push(`/room/${joinCode.toUpperCase()}`);
    } catch {
      setError('Failed to join room. Please try again.');
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Error Message */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/50 rounded-xl p-4 text-red-400 text-center">
          {error}
        </div>
      )}

      {/* Create Room */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
        <h2 className="text-2xl font-bold text-white mb-4">Crear Partida</h2>
        <p className="text-gray-400 mb-6">
          Crea una nueva sala y comparte el codigo con tus amigos
        </p>
        <button
          onClick={handleCreateRoom}
          disabled={isCreating}
          className="w-full bg-green-500 hover:bg-green-600 disabled:bg-green-500/50 text-white font-semibold py-4 px-8 rounded-xl transition-all duration-200 disabled:cursor-not-allowed"
        >
          {isCreating ? (
            <span className="flex items-center justify-center gap-2">
              <LoadingSpinner />
              Creando...
            </span>
          ) : (
            'Crear Nueva Sala'
          )}
        </button>
      </div>

      {/* Divider */}
      <div className="flex items-center gap-4">
        <div className="flex-1 h-px bg-white/10" />
        <span className="text-gray-500 text-sm">o</span>
        <div className="flex-1 h-px bg-white/10" />
      </div>

      {/* Join Room */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
        <h2 className="text-2xl font-bold text-white mb-4 text-center">Unirse a Partida</h2>
        <p className="text-gray-400 mb-6 text-center">
          Introduce el codigo de la sala para unirte
        </p>
        <form onSubmit={handleJoinRoom} className="space-y-4">
          <input
            type="text"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="CODIGO"
            maxLength={6}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-6 py-4 text-white text-center text-2xl tracking-widest placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-green-500/50"
          />
          <button
            type="submit"
            disabled={isJoining || !joinCode.trim()}
            className="w-full bg-purple-500 hover:bg-purple-600 disabled:bg-purple-500/50 text-white font-semibold py-4 px-8 rounded-xl transition-all duration-200 disabled:cursor-not-allowed"
          >
            {isJoining ? (
              <span className="flex items-center justify-center gap-2">
                <LoadingSpinner />
                Uniendose...
              </span>
            ) : (
              'Unirse'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

function LoadingSpinner() {
  return (
    <svg
      className="animate-spin h-5 w-5"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}
