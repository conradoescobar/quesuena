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

  // Get user
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect('/');
  }

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
    />
  );
}
