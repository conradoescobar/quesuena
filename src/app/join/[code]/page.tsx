import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { getRoomByCode, joinRoom, getGuestSession } from '@/lib/actions/room';
import { JoinForm } from './JoinForm';

interface JoinPageProps {
  params: Promise<{ code: string }>;
}

export default async function JoinPage({ params }: JoinPageProps) {
  const { code } = await params;
  const supabase = await createClient();

  // Check if room exists
  const roomResult = await getRoomByCode(code);
  if ('error' in roomResult) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center p-4">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 max-w-md w-full text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Sala no encontrada</h1>
          <p className="text-gray-400 mb-6">
            El código <span className="text-green-400 font-mono">{code.toUpperCase()}</span> no existe o ha expirado.
          </p>
          <a
            href="/"
            className="inline-block bg-purple-500 hover:bg-purple-600 text-white font-medium py-2 px-6 rounded-lg transition-colors"
          >
            Volver al inicio
          </a>
        </div>
      </main>
    );
  }

  const { room } = roomResult;

  // Check if game already started
  if (room.status !== 'waiting') {
    return (
      <main className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center p-4">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 max-w-md w-full text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Juego en progreso</h1>
          <p className="text-gray-400 mb-6">
            Este juego ya ha comenzado y no puedes unirte.
          </p>
          <a
            href="/"
            className="inline-block bg-purple-500 hover:bg-purple-600 text-white font-medium py-2 px-6 rounded-lg transition-colors"
          >
            Volver al inicio
          </a>
        </div>
      </main>
    );
  }

  // Check if user is logged in with Spotify
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    // User is logged in - auto-join and redirect
    const joinResult = await joinRoom(code);
    if ('roomId' in joinResult) {
      redirect(`/room/${code.toUpperCase()}`);
    }
    // If join failed, show the form anyway
  }

  // Check if already a guest in this room
  const guestSession = await getGuestSession();
  if (guestSession && guestSession.roomId === room.id) {
    // Guest already in this room - redirect
    redirect(`/room/${code.toUpperCase()}`);
  }

  // Get Spotify display name if logged in
  const spotifyName = user?.user_metadata?.full_name || user?.user_metadata?.name || null;

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center p-4">
      <div className="bg-white/5 border border-white/10 rounded-2xl p-8 max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Unirse a la sala</h1>
          <p className="text-gray-400">
            Codigo: <span className="text-green-400 font-mono text-xl">{code.toUpperCase()}</span>
          </p>
        </div>

        <JoinForm
          roomCode={code.toUpperCase()}
          spotifyName={spotifyName}
          isLoggedIn={!!user}
        />
      </div>
    </main>
  );
}
