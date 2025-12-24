'use server';

import { createClient } from '@/utils/supabase/server';
import SpotifyWebApi from 'spotify-web-api-node';

// Tipo para los resultados de búsqueda
export interface SpotifySearchResult {
  id: string;
  uri: string;
  name: string;
  artist: string;
  albumUrl: string;
}

// Tipo para agregar canción
export interface AddSongPayload {
  uri: string;
  name: string;
  artist: string;
  albumUrl: string;
}

/**
 * Busca canciones en Spotify usando el token del usuario autenticado
 */
export async function searchSpotify(query: string): Promise<{
  results: SpotifySearchResult[];
  error: string | null;
}> {
  if (!query || query.trim().length < 2) {
    return { results: [], error: null };
  }

  try {
    const supabase = await createClient();

    // Obtener la sesión actual
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session) {
      return { results: [], error: 'No hay sesión activa' };
    }

    // Obtener el token de Spotify del proveedor
    const spotifyToken = session.provider_token;

    if (!spotifyToken) {
      return {
        results: [],
        error: 'Token de Spotify no disponible. Vuelve a iniciar sesión.'
      };
    }

    // Inicializar el cliente de Spotify
    const spotifyApi = new SpotifyWebApi();
    spotifyApi.setAccessToken(spotifyToken);

    // Buscar canciones
    const searchResponse = await spotifyApi.searchTracks(query, { limit: 10 });

    if (!searchResponse.body.tracks?.items) {
      return { results: [], error: null };
    }

    // Mapear resultados a formato simplificado
    const results: SpotifySearchResult[] = searchResponse.body.tracks.items.map((track) => ({
      id: track.id,
      uri: track.uri,
      name: track.name,
      artist: track.artists.map((a) => a.name).join(', '),
      albumUrl: track.album.images[0]?.url || '',
    }));

    return { results, error: null };
  } catch (err) {
    console.error('Spotify search error:', err);

    // Manejar errores específicos de Spotify
    if (err instanceof Error) {
      if (err.message.includes('401') || err.message.includes('Unauthorized')) {
        return {
          results: [],
          error: 'Token expirado. Refresca la página o vuelve a iniciar sesión.'
        };
      }
    }

    return { results: [], error: 'Error al buscar en Spotify' };
  }
}

/**
 * Agrega una canción a la cola de una sala
 */
export async function addSongToRoom(
  roomId: string,
  song: AddSongPayload
): Promise<{ success: boolean; error: string | null }> {
  try {
    const supabase = await createClient();

    // Obtener el usuario actual
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return { success: false, error: 'No hay sesión activa' };
    }

    // Verificar que la sala existe
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('id')
      .eq('id', roomId)
      .single();

    if (roomError || !room) {
      return { success: false, error: 'Sala no encontrada' };
    }

    // Verificar si la canción ya existe en la sala
    const { data: existingSong } = await supabase
      .from('songs')
      .select('id')
      .eq('room_id', roomId)
      .eq('spotify_uri', song.uri)
      .single();

    if (existingSong) {
      return { success: false, error: 'Esta canción ya está en la cola' };
    }

    // Insertar la canción
    const { error: insertError } = await supabase.from('songs').insert({
      room_id: roomId,
      user_id: user.id,
      spotify_uri: song.uri,
      title: song.name,
      artist: song.artist,
      album_art_url: song.albumUrl,
    });

    if (insertError) {
      console.error('Insert song error:', insertError);
      return { success: false, error: 'Error al agregar la canción' };
    }

    return { success: true, error: null };
  } catch (err) {
    console.error('Add song error:', err);
    return { success: false, error: 'Error inesperado' };
  }
}
