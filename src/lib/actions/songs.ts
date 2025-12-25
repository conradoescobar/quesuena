'use server';

import { createClient } from '@/utils/supabase/server';
import SpotifyWebApi from 'spotify-web-api-node';
import type { Song } from '@/types/database';

/**
 * Helper para obtener el cliente de Spotify autenticado
 */
async function getSpotifyClient(): Promise<{
  spotifyApi: SpotifyWebApi | null;
  error: string | null;
}> {
  const supabase = await createClient();
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();

  if (sessionError || !session) {
    return { spotifyApi: null, error: 'No hay sesión activa' };
  }

  const spotifyToken = session.provider_token;

  if (!spotifyToken) {
    return {
      spotifyApi: null,
      error: 'Token de Spotify no disponible. Vuelve a iniciar sesión.'
    };
  }

  const spotifyApi = new SpotifyWebApi();
  spotifyApi.setAccessToken(spotifyToken);

  return { spotifyApi, error: null };
}

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

/**
 * Server Action: Refresh preview URLs for songs without them
 */
export async function refreshPreviewUrls(
  roomId: string
): Promise<{ updated: number; error: string | null }> {
  const supabase = await createClient();

  // Get songs without preview_url
  const { data: songs, error: fetchError } = await supabase
    .from('songs')
    .select('id, spotify_uri')
    .eq('room_id', roomId)
    .is('preview_url', null);

  if (fetchError) {
    console.error('Error fetching songs:', fetchError);
    return { updated: 0, error: 'Error al cargar canciones' };
  }

  if (!songs || songs.length === 0) {
    return { updated: 0, error: null };
  }

  // Get Spotify client
  const { spotifyApi, error: spotifyError } = await getSpotifyClient();
  if (spotifyError || !spotifyApi) {
    return { updated: 0, error: spotifyError || 'Error de conexión con Spotify' };
  }

  // Extract track IDs from URIs (spotify:track:XXXXX -> XXXXX)
  const trackIds = songs
    .map(song => {
      const parts = song.spotify_uri.split(':');
      return parts[2]; // Get the ID part
    })
    .filter(id => id);

  if (trackIds.length === 0) {
    return { updated: 0, error: 'No hay IDs válidos' };
  }

  try {
    // Fetch tracks from Spotify (max 50 per request)
    const batchSize = 50;
    let updatedCount = 0;

    for (let i = 0; i < trackIds.length; i += batchSize) {
      const batch = trackIds.slice(i, i + batchSize);
      const response = await spotifyApi.getTracks(batch);

      if (response.body.tracks) {
        for (const track of response.body.tracks) {
          if (track && track.preview_url) {
            // Find the song with this URI
            const song = songs.find(s => s.spotify_uri === track.uri);
            if (song) {
              // Update the preview_url
              const { error: updateError } = await supabase
                .from('songs')
                .update({ preview_url: track.preview_url })
                .eq('id', song.id);

              if (!updateError) {
                updatedCount++;
              }
            }
          }
        }
      }
    }

    return { updated: updatedCount, error: null };
  } catch (err) {
    console.error('Error refreshing preview URLs:', err);
    return { updated: 0, error: 'Error al obtener datos de Spotify' };
  }
}
