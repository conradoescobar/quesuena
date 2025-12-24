'use server';

import { createClient } from '@/utils/supabase/server';
import type { Song } from '@/types/database';

/**
 * Server Action: Add a song to the room
 */
export async function addSong(
  roomId: string,
  song: {
    spotify_uri: string;
    title: string;
    artist: string;
    album_art_url?: string;
  }
): Promise<{ song: Song } | { error: string }> {
  const supabase = await createClient();

  // Get current user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: 'You must be logged in to add songs' };
  }

  // Insert the song
  const { data: newSong, error: songError } = await supabase
    .from('songs')
    .insert({
      room_id: roomId,
      user_id: user.id,
      spotify_uri: song.spotify_uri,
      title: song.title,
      artist: song.artist,
      album_art_url: song.album_art_url || null,
    })
    .select()
    .single();

  if (songError) {
    console.error('Error adding song:', songError);
    return { error: 'Failed to add song. Please try again.' };
  }

  return { song: newSong as Song };
}

/**
 * Server Action: Get all songs in a room
 */
export async function getRoomSongs(
  roomId: string
): Promise<{ songs: Song[] } | { error: string }> {
  const supabase = await createClient();

  const { data: songs, error } = await supabase
    .from('songs')
    .select('*')
    .eq('room_id', roomId)
    .order('added_at', { ascending: true });

  if (error) {
    console.error('Error fetching songs:', error);
    return { error: 'Failed to load songs' };
  }

  return { songs: (songs || []) as Song[] };
}

/**
 * Server Action: Remove a song from the room
 */
export async function removeSong(
  songId: string
): Promise<{ success: boolean } | { error: string }> {
  const supabase = await createClient();

  // Get current user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: 'You must be logged in' };
  }

  // RLS will ensure only the song owner or host can delete
  const { error: deleteError } = await supabase
    .from('songs')
    .delete()
    .eq('id', songId);

  if (deleteError) {
    console.error('Error removing song:', deleteError);
    return { error: 'Failed to remove song' };
  }

  return { success: true };
}
