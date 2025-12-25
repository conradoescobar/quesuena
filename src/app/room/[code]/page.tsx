import { createClient } from '@/utils/supabase/server';
import { redirect, notFound } from 'next/navigation';
import { getRoomByCode } from '@/lib/actions/room';
import { GameRoom } from './GameRoom';

interface RoomPageProps {
  params: Promise<{ code: string }>;
}

export default async function RoomPage({ params }: RoomPageProps) {
  const { code } = await params;
  const supabase = await createClient();

  // Get user and session
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  const { data: { session } } = await supabase.auth.getSession();

  if (userError || !user) {
    redirect('/');
  }

  // Get Spotify token from session (for Premium playback)
  const spotifyToken = session?.provider_token || null;

  // Get room data
  const result = await getRoomByCode(code);

  if ('error' in result) {
    notFound();
  }

  const { room, players } = result;
  const isHost = room.host_id === user.id;

  // Get user display info
  const displayName =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email?.split('@')[0] ||
    'Player';

  const avatarUrl = user.user_metadata?.avatar_url || null;

  return (
    <GameRoom
      room={room}
      initialPlayers={players}
      currentUser={{
        id: user.id,
        displayName,
        avatarUrl,
      }}
      isHost={isHost}
      spotifyToken={spotifyToken}
    />
  );
}
