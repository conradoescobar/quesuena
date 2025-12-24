-- =============================================
-- "Adivina la canción" MVP - Initial Schema
-- =============================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- ENUM Types
-- =============================================

CREATE TYPE room_status AS ENUM ('waiting', 'playing', 'round_end', 'finished');

-- =============================================
-- Function to generate unique room codes
-- =============================================

CREATE OR REPLACE FUNCTION generate_room_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- Excluding confusing characters (0, O, 1, I)
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- Tables
-- =============================================

-- Rooms table: Stores game room information
CREATE TABLE rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT NOT NULL UNIQUE DEFAULT generate_room_code(),
  host_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status room_status NOT NULL DEFAULT 'waiting',
  current_round_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Players table: Stores players in each room
CREATE TABLE players (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  score INTEGER NOT NULL DEFAULT 0,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Ensure a user can only join a room once
  UNIQUE(room_id, user_id)
);

-- Songs table: Stores songs added to each room
CREATE TABLE songs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  spotify_uri TEXT NOT NULL,
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  album_art_url TEXT,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- Indexes for performance
-- =============================================

CREATE INDEX idx_rooms_code ON rooms(code);
CREATE INDEX idx_rooms_host_id ON rooms(host_id);
CREATE INDEX idx_rooms_status ON rooms(status);
CREATE INDEX idx_players_room_id ON players(room_id);
CREATE INDEX idx_players_user_id ON players(user_id);
CREATE INDEX idx_songs_room_id ON songs(room_id);
CREATE INDEX idx_songs_user_id ON songs(user_id);

-- =============================================
-- Trigger to update updated_at on rooms
-- =============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_rooms_updated_at
  BEFORE UPDATE ON rooms
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- Row Level Security (RLS) Policies
-- =============================================

-- Enable RLS on all tables
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE songs ENABLE ROW LEVEL SECURITY;

-- ROOMS POLICIES
-- Anyone can read rooms (to join via code)
CREATE POLICY "Anyone can view rooms"
  ON rooms FOR SELECT
  USING (true);

-- Only authenticated users can create rooms
CREATE POLICY "Authenticated users can create rooms"
  ON rooms FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = host_id);

-- Only the host can update room status
CREATE POLICY "Only host can update room"
  ON rooms FOR UPDATE
  TO authenticated
  USING (auth.uid() = host_id)
  WITH CHECK (auth.uid() = host_id);

-- Only the host can delete the room
CREATE POLICY "Only host can delete room"
  ON rooms FOR DELETE
  TO authenticated
  USING (auth.uid() = host_id);

-- PLAYERS POLICIES
-- Anyone can view players in a room
CREATE POLICY "Anyone can view players"
  ON players FOR SELECT
  USING (true);

-- Authenticated users can join rooms (insert themselves as player)
CREATE POLICY "Authenticated users can join rooms"
  ON players FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Players can update their own record (e.g., display name)
CREATE POLICY "Players can update own record"
  ON players FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Host can update any player in their room (for score updates)
CREATE POLICY "Host can update players in their room"
  ON players FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM rooms
      WHERE rooms.id = players.room_id
      AND rooms.host_id = auth.uid()
    )
  );

-- Players can leave (delete themselves)
CREATE POLICY "Players can leave room"
  ON players FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- SONGS POLICIES
-- Anyone can view songs in a room
CREATE POLICY "Anyone can view songs"
  ON songs FOR SELECT
  USING (true);

-- Authenticated users can add songs
CREATE POLICY "Authenticated users can add songs"
  ON songs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own songs
CREATE POLICY "Users can delete own songs"
  ON songs FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Host can delete any song in their room
CREATE POLICY "Host can delete songs in their room"
  ON songs FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM rooms
      WHERE rooms.id = songs.room_id
      AND rooms.host_id = auth.uid()
    )
  );

-- =============================================
-- Helpful Views
-- =============================================

-- View to get room details with player count
CREATE VIEW room_details AS
SELECT
  r.*,
  COUNT(p.id) as player_count,
  (SELECT display_name FROM players WHERE room_id = r.id AND user_id = r.host_id) as host_name
FROM rooms r
LEFT JOIN players p ON r.id = p.room_id
GROUP BY r.id;

-- =============================================
-- Comments for documentation
-- =============================================

COMMENT ON TABLE rooms IS 'Game rooms for "Adivina la canción"';
COMMENT ON TABLE players IS 'Players participating in game rooms';
COMMENT ON TABLE songs IS 'Songs added by players to be guessed';
COMMENT ON COLUMN rooms.code IS 'Unique 6-character code for joining the room';
COMMENT ON COLUMN rooms.current_round_index IS 'Index of the current song being played (0-based)';
COMMENT ON COLUMN players.score IS 'Player score in the current game';
COMMENT ON COLUMN songs.spotify_uri IS 'Spotify URI for playback (e.g., spotify:track:xxx)';
