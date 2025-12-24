'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { PresenceState, RoomStatus } from '@/types/database';

// =============================================
// Types for Realtime Events
// =============================================

interface BuzzPayload {
  user_id: string;
  display_name: string;
  timestamp: number;
}

interface GameStatePayload {
  status: RoomStatus;
  current_round_index: number;
  winner_id?: string;
}

interface PlayerPresence {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  online_at: string;
}

interface UseGameRoomOptions {
  roomCode: string;
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
}

interface UseGameRoomReturn {
  // Connection state
  isConnected: boolean;
  connectionError: string | null;

  // Presence (who's in the lobby)
  players: PlayerPresence[];

  // Buzz events
  lastBuzz: BuzzPayload | null;
  sendBuzz: () => void;

  // Game state events
  gameState: GameStatePayload | null;
  updateGameState: (state: GameStatePayload) => void;

  // Cleanup
  disconnect: () => void;
}

/**
 * useGameRoom Hook - Real-time game functionality
 *
 * This hook manages all real-time features of the game:
 *
 * 1. PRESENCE (Lobby): Uses channel.track() to show who's online
 *    - When a player joins, their presence is tracked
 *    - When they leave, their presence is automatically removed
 *
 * 2. BROADCAST (Buzzer): Uses channel.send() for instant buzzer events
 *    - NO database writes for the buzzer - this is INSTANT
 *    - All players receive the buzz event simultaneously
 *    - The payload includes timestamp for determining first buzzer
 *
 * 3. BROADCAST (Game State): Uses channel.send() for game state updates
 *    - Host broadcasts game state changes (start, next round, end)
 *    - All players receive the update instantly
 *
 * IMPORTANT: The buzzer does NOT use the database!
 * Supabase Realtime Broadcast is peer-to-peer-like and much faster.
 */
export function useGameRoom({
  roomCode,
  userId,
  displayName,
  avatarUrl,
}: UseGameRoomOptions): UseGameRoomReturn {
  const supabase = createClient();
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Connection state
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // Presence state (players in lobby)
  const [players, setPlayers] = useState<PlayerPresence[]>([]);

  // Buzz events
  const [lastBuzz, setLastBuzz] = useState<BuzzPayload | null>(null);

  // Game state
  const [gameState, setGameState] = useState<GameStatePayload | null>(null);

  // =============================================
  // Send Buzz Event (INSTANT - No Database!)
  // =============================================
  const sendBuzz = useCallback(() => {
    if (!channelRef.current || !isConnected) {
      console.warn('Cannot send buzz: not connected to channel');
      return;
    }

    const payload: BuzzPayload = {
      user_id: userId,
      display_name: displayName,
      timestamp: Date.now(), // High-precision timestamp for determining winner
    };

    // Broadcast the buzz event to all players in the room
    // This is INSTANT - no database round-trip!
    channelRef.current.send({
      type: 'broadcast',
      event: 'buzz',
      payload,
    });

    console.log('Buzz sent!', payload);
  }, [isConnected, userId, displayName]);

  // =============================================
  // Update Game State (Host only)
  // =============================================
  const updateGameState = useCallback(
    (state: GameStatePayload) => {
      if (!channelRef.current || !isConnected) {
        console.warn('Cannot update game state: not connected to channel');
        return;
      }

      channelRef.current.send({
        type: 'broadcast',
        event: 'game_state',
        payload: state,
      });

      console.log('Game state updated:', state);
    },
    [isConnected]
  );

  // =============================================
  // Disconnect from channel
  // =============================================
  const disconnect = useCallback(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
      setIsConnected(false);
    }
  }, [supabase]);

  // =============================================
  // Initialize Channel and Subscribe
  // =============================================
  useEffect(() => {
    // Create a unique channel for this room
    const channel = supabase.channel(`room:${roomCode}`, {
      config: {
        presence: {
          key: userId, // Use user ID as presence key
        },
      },
    });

    channelRef.current = channel;

    // -------------------------
    // Handle Presence (Lobby)
    // -------------------------
    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState<PresenceState>();
      const presentPlayers = Object.values(state)
        .flat()
        .map((p) => ({
          user_id: p.user_id,
          display_name: p.display_name,
          avatar_url: p.avatar_url,
          online_at: p.online_at,
        }));

      setPlayers(presentPlayers);
      console.log('Presence sync:', presentPlayers);
    });

    channel.on('presence', { event: 'join' }, ({ newPresences }) => {
      console.log('Player joined:', newPresences);
    });

    channel.on('presence', { event: 'leave' }, ({ leftPresences }) => {
      console.log('Player left:', leftPresences);
    });

    // -------------------------
    // Handle Buzz Events
    // -------------------------
    channel.on('broadcast', { event: 'buzz' }, ({ payload }) => {
      const buzzPayload = payload as BuzzPayload;
      setLastBuzz(buzzPayload);
      console.log('Buzz received!', buzzPayload);
    });

    // -------------------------
    // Handle Game State Events
    // -------------------------
    channel.on('broadcast', { event: 'game_state' }, ({ payload }) => {
      const statePayload = payload as GameStatePayload;
      setGameState(statePayload);
      console.log('Game state received:', statePayload);
    });

    // -------------------------
    // Subscribe to channel
    // -------------------------
    channel
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          setIsConnected(true);
          setConnectionError(null);

          // Track our presence in the room
          await channel.track({
            user_id: userId,
            display_name: displayName,
            avatar_url: avatarUrl || null,
            online_at: new Date().toISOString(),
          });

          console.log('Connected to room:', roomCode);
        } else if (status === 'CHANNEL_ERROR') {
          setConnectionError('Failed to connect to game room');
          setIsConnected(false);
        } else if (status === 'TIMED_OUT') {
          setConnectionError('Connection timed out');
          setIsConnected(false);
        }
      });

    // Cleanup on unmount
    return () => {
      channel.untrack();
      supabase.removeChannel(channel);
    };
  }, [roomCode, userId, displayName, avatarUrl, supabase]);

  return {
    isConnected,
    connectionError,
    players,
    lastBuzz,
    sendBuzz,
    gameState,
    updateGameState,
    disconnect,
  };
}
