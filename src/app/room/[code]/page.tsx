import { createClient } from '@/utils/supabase/server';
import { redirect, notFound } from 'next/navigation';
import { getRoomByCode, getGuestSession } from '@/lib/actions/room';
import { GameRoom } from './GameRoom';

interface RoomPageProps {
  params: Promise<{ code: string }>;
}

export default async function RoomPage({ params }: RoomPageProps) {
  const { code } = await params;
  const supabase = await createClient();

  // Get user
  const { data: { user } } = await supabase.auth.getUser();

  // Check for guest session if no user
  const guestSession = !user ? await getGuestSession() : null;

  // If no user and no guest, redirect to join page
  if (!user && !guestSession) {
    redirect(`/join/${code}`);
  }

  // Get room data
  const result = await getRoomByCode(code);

  if ('error' in result) {
    notFound();
  }

  const { room, players } = result;

  // Verify guest is in this room
  if (guestSession && guestSession.roomId !== room.id) {
    redirect(`/join/${code}`);
  }

  // Determine if current user/guest is the host
  const isHost = user ? room.host_id === user.id : false;

  // Get display info
  let currentUserId: string;
  let displayName: string;
  let avatarUrl: string | null;

  if (user) {
    currentUserId = user.id;
    displayName =
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.email?.split('@')[0] ||
      'Player';
    avatarUrl = user.user_metadata?.avatar_url || null;
  } else if (guestSession) {
    currentUserId = guestSession.guestId;
    displayName = guestSession.guestName;
    avatarUrl = null;
  } else {
    // This shouldn't happen due to earlier redirect, but just in case
    redirect(`/join/${code}`);
  }

  return (
    <GameRoom
      room={room}
      initialPlayers={players}
      currentUser={{
        id: currentUserId,
        displayName,
        avatarUrl,
      }}
      isHost={isHost}
      isGuest={!!guestSession}
    />
  );
}
