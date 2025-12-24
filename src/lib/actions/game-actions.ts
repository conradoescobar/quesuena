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

// Tipo para resultados de playlist
export interface SpotifyPlaylistResult {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  owner: string;
  tracksTotal: number;
}

// Tipo para agregar canción
export interface AddSongPayload {
  uri: string;
  name: string;
  artist: string;
  albumUrl: string;
}

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
    const { spotifyApi, error } = await getSpotifyClient();
    if (error || !spotifyApi) {
      return { results: [], error: error || 'Error de conexión' };
    }

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
 * Busca playlists en Spotify
 */
export async function searchPlaylists(query: string): Promise<{
  results: SpotifyPlaylistResult[];
  error: string | null;
}> {
  if (!query || query.trim().length < 2) {
    return { results: [], error: null };
  }

  try {
    const { spotifyApi, error } = await getSpotifyClient();
    if (error || !spotifyApi) {
      return { results: [], error: error || 'Error de conexión' };
    }

    const searchResponse = await spotifyApi.searchPlaylists(query, { limit: 10 });

    if (!searchResponse.body.playlists?.items) {
      return { results: [], error: null };
    }

    const results: SpotifyPlaylistResult[] = searchResponse.body.playlists.items
      .filter((playlist): playlist is NonNullable<typeof playlist> => playlist !== null)
      .map((playlist) => ({
        id: playlist.id,
        name: playlist.name,
        description: playlist.description || '',
        imageUrl: playlist.images[0]?.url || '',
        owner: playlist.owner.display_name || playlist.owner.id,
        tracksTotal: playlist.tracks.total,
      }));

    return { results, error: null };
  } catch (err) {
    console.error('Spotify playlist search error:', err);

    if (err instanceof Error) {
      if (err.message.includes('401') || err.message.includes('Unauthorized')) {
        return {
          results: [],
          error: 'Token expirado. Refresca la página o vuelve a iniciar sesión.'
        };
      }
    }

    return { results: [], error: 'Error al buscar playlists' };
  }
}

/**
 * Importa canciones aleatorias de una playlist
 */
export async function importFromPlaylist(
  roomId: string,
  playlistId: string,
  count: number = 5
): Promise<{ success: boolean; addedCount: number; error: string | null }> {
  try {
    const supabase = await createClient();

    // Obtener usuario
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return { success: false, addedCount: 0, error: 'No hay sesión activa' };
    }

    // Verificar sala
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('id')
      .eq('id', roomId)
      .single();

    if (roomError || !room) {
      return { success: false, addedCount: 0, error: 'Sala no encontrada' };
    }

    // Obtener cliente de Spotify
    const { spotifyApi, error: spotifyError } = await getSpotifyClient();
    if (spotifyError || !spotifyApi) {
      return { success: false, addedCount: 0, error: spotifyError || 'Error de conexión' };
    }

    // Obtener tracks de la playlist
    const playlistResponse = await spotifyApi.getPlaylistTracks(playlistId, {
      limit: 100,
      fields: 'items(track(id,uri,name,artists,album(images),is_local))'
    });

    if (!playlistResponse.body.items) {
      return { success: false, addedCount: 0, error: 'Playlist vacía' };
    }

    // Filtrar tracks válidos (no locales, no nulos)
    const validTracks = playlistResponse.body.items
      .map(item => item.track)
      .filter((track): track is SpotifyApi.TrackObjectFull =>
        track !== null &&
        !track.is_local &&
        track.uri !== null
      );

    if (validTracks.length === 0) {
      return { success: false, addedCount: 0, error: 'No hay canciones válidas en esta playlist' };
    }

    // Obtener canciones ya existentes en la sala
    const { data: existingSongs } = await supabase
      .from('songs')
      .select('spotify_uri')
      .eq('room_id', roomId);

    const existingUris = new Set(existingSongs?.map(s => s.spotify_uri) || []);

    // Filtrar tracks que ya están en la sala
    const newTracks = validTracks.filter(track => !existingUris.has(track.uri));

    if (newTracks.length === 0) {
      return { success: false, addedCount: 0, error: 'Todas las canciones ya están en la cola' };
    }

    // Shuffle array (Fisher-Yates)
    const shuffled = [...newTracks];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    // Tomar las primeras `count` canciones
    const selectedTracks = shuffled.slice(0, Math.min(count, shuffled.length));

    // Preparar datos para inserción
    const songsToInsert = selectedTracks.map(track => ({
      room_id: roomId,
      user_id: user.id,
      spotify_uri: track.uri,
      title: track.name,
      artist: track.artists.map(a => a.name).join(', '),
      album_art_url: track.album.images[0]?.url || '',
    }));

    // Bulk insert
    const { error: insertError } = await supabase
      .from('songs')
      .insert(songsToInsert);

    if (insertError) {
      console.error('Bulk insert error:', insertError);
      return { success: false, addedCount: 0, error: 'Error al agregar canciones' };
    }

    return { success: true, addedCount: songsToInsert.length, error: null };
  } catch (err) {
    console.error('Import from playlist error:', err);
    return { success: false, addedCount: 0, error: 'Error inesperado' };
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
