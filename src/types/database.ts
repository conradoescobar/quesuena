/**
 * Database types for Supabase - "Adivina la canción" MVP
 */

export type RoomStatus = 'waiting' | 'playing' | 'round_end' | 'finished';

export interface Room {
  id: string;
  code: string;
  host_id: string;
  status: RoomStatus;
  current_round_index: number;
  created_at: string;
  updated_at: string;
}

export interface Player {
  id: string;
  room_id: string;
  user_id: string | null; // null for guest players
  guest_id: string | null; // UUID for guest players
  display_name: string;
  avatar_url: string | null;
  score: number;
  joined_at: string;
}

export interface Song {
  id: string;
  room_id: string;
  user_id: string | null; // null for guest-added songs
  guest_id: string | null; // UUID for guest who added the song
  added_by_name: string | null; // Display name of who added it
  spotify_uri: string;
  title: string;
  artist: string;
  album_art_url: string | null;
  preview_url: string | null;
  added_at: string;
}

// Supabase Database type definitions
export type Database = {
  public: {
    Tables: {
      rooms: {
        Row: Room;
        Insert: {
          id?: string;
          code?: string;
          host_id: string;
          status?: RoomStatus;
          current_round_index?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          host_id?: string;
          status?: RoomStatus;
          current_round_index?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      players: {
        Row: Player;
        Insert: {
          id?: string;
          room_id: string;
          user_id?: string | null;
          guest_id?: string | null;
          display_name: string;
          avatar_url?: string | null;
          score?: number;
          joined_at?: string;
        };
        Update: {
          id?: string;
          room_id?: string;
          user_id?: string | null;
          guest_id?: string | null;
          display_name?: string;
          avatar_url?: string | null;
          score?: number;
          joined_at?: string;
        };
        Relationships: [];
      };
      songs: {
        Row: Song;
        Insert: {
          id?: string;
          room_id: string;
          user_id?: string | null;
          guest_id?: string | null;
          added_by_name?: string | null;
          spotify_uri: string;
          title: string;
          artist: string;
          album_art_url?: string | null;
          preview_url?: string | null;
          added_at?: string;
        };
        Update: {
          id?: string;
          room_id?: string;
          user_id?: string | null;
          guest_id?: string | null;
          added_by_name?: string | null;
          spotify_uri?: string;
          title?: string;
          artist?: string;
          album_art_url?: string | null;
          preview_url?: string | null;
          added_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      generate_room_code: {
        Args: Record<string, never>;
        Returns: string;
      };
    };
    Enums: {
      room_status: RoomStatus;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

// Realtime types for game events
export interface BuzzEvent {
  type: 'broadcast';
  event: 'buzz';
  payload: {
    user_id: string;
    display_name: string;
    timestamp: number;
  };
}

export interface GameStateEvent {
  type: 'broadcast';
  event: 'game_state';
  payload: {
    status: RoomStatus;
    current_round_index: number;
    winner_id?: string;
  };
}

export interface PresenceState {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  online_at: string;
}
