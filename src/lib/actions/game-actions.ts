'use server';

import { createClient } from '@/utils/supabase/server';
import { cookies } from 'next/headers';
import SpotifyWebApi from 'spotify-web-api-node';

// Tipo para los resultados de búsqueda
export interface SpotifySearchResult {
  id: string;
  uri: string;
  name: string;
  artist: string;
  albumUrl: string;
  previewUrl: string | null;
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
  previewUrl: string | null;
}

// Tipo para resultado de búsqueda de YouTube
export interface YouTubeSearchResult {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
}

// Tipo para dispositivos de Spotify
export interface SpotifyDevice {
  id: string;
  name: string;
  type: string; // 'Computer', 'Smartphone', 'Speaker', etc.
  isActive: boolean;
  volumePercent: number;
}

// Cache para el token de Client Credentials
let clientCredentialsToken: string | null = null;
let clientCredentialsExpiry: number = 0;

/**
 * Helper para obtener el cliente de Spotify con token de usuario (para usuarios logueados)
 */
async function getSpotifyClientWithUserToken(): Promise<{
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
 * Helper para obtener el cliente de Spotify con Client Credentials (para invitados)
 * Usa SPOTIFY_CLIENT_ID y SPOTIFY_CLIENT_SECRET del env
 */
async function getSpotifyClientWithClientCredentials(): Promise<{
  spotifyApi: SpotifyWebApi | null;
  error: string | null;
}> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error('Missing SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET');
    return { spotifyApi: null, error: 'Configuración de Spotify incompleta' };
  }

  // Check if we have a valid cached token
  if (clientCredentialsToken && Date.now() < clientCredentialsExpiry) {
    const spotifyApi = new SpotifyWebApi();
    spotifyApi.setAccessToken(clientCredentialsToken);
    return { spotifyApi, error: null };
  }

  try {
    const spotifyApi = new SpotifyWebApi({
      clientId,
      clientSecret,
    });

    const data = await spotifyApi.clientCredentialsGrant();
    const accessToken = data.body.access_token;
    const expiresIn = data.body.expires_in;

    // Cache the token (with 1 minute buffer)
    clientCredentialsToken = accessToken;
    clientCredentialsExpiry = Date.now() + (expiresIn - 60) * 1000;

    spotifyApi.setAccessToken(accessToken);
    return { spotifyApi, error: null };
  } catch (err) {
    console.error('Client credentials grant error:', err);
    return { spotifyApi: null, error: 'Error al autenticar con Spotify' };
  }
}

/**
 * Helper para obtener el cliente de Spotify (intenta token de usuario, luego Client Credentials)
 */
async function getSpotifyClient(): Promise<{
  spotifyApi: SpotifyWebApi | null;
  error: string | null;
  isUserAuthenticated: boolean;
}> {
  // Try user token first
  const userResult = await getSpotifyClientWithUserToken();
  if (userResult.spotifyApi) {
    return { ...userResult, isUserAuthenticated: true };
  }

  // Fall back to Client Credentials for guests
  const clientResult = await getSpotifyClientWithClientCredentials();
  return { ...clientResult, isUserAuthenticated: false };
}

/**
 * Helper para obtener información del invitado desde cookies
 */
async function getGuestInfo(): Promise<{ guestId: string; guestName: string } | null> {
  const cookieStore = await cookies();
  const guestId = cookieStore.get('guest_id')?.value;
  const guestName = cookieStore.get('guest_name')?.value;

  if (guestId && guestName) {
    return { guestId, guestName };
  }
  return null;
}

/**
 * Busca canciones en Spotify
 * Funciona tanto para usuarios logueados como para invitados (usando Client Credentials)
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
      previewUrl: track.preview_url,
    }));

    return { results, error: null };
  } catch (err) {
    console.error('Spotify search error:', err);

    if (err instanceof Error) {
      if (err.message.includes('401') || err.message.includes('Unauthorized')) {
        // Try to get a fresh Client Credentials token
        clientCredentialsToken = null;
        clientCredentialsExpiry = 0;
        return {
          results: [],
          error: 'Token expirado. Intenta de nuevo.'
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
      fields: 'items(track(id,uri,name,artists,album(images),is_local,preview_url))'
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
      preview_url: track.preview_url || null,
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
 * Funciona tanto para usuarios logueados como para invitados
 */
export async function addSongToRoom(
  roomId: string,
  song: AddSongPayload
): Promise<{ success: boolean; error: string | null }> {
  try {
    const supabase = await createClient();

    // Intentar obtener el usuario actual
    const { data: { user } } = await supabase.auth.getUser();

    // Si no hay usuario, verificar si es un invitado
    const guestInfo = !user ? await getGuestInfo() : null;

    if (!user && !guestInfo) {
      return { success: false, error: 'Debes iniciar sesión o unirte como invitado' };
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

    // Preparar datos para inserción
    const songData: {
      room_id: string;
      user_id: string | null;
      guest_id: string | null;
      added_by_name: string | null;
      spotify_uri: string;
      title: string;
      artist: string;
      album_art_url: string;
      preview_url: string | null;
    } = {
      room_id: roomId,
      user_id: user?.id || null,
      guest_id: guestInfo?.guestId || null,
      added_by_name: user
        ? (user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'Usuario')
        : (guestInfo?.guestName || 'Invitado'),
      spotify_uri: song.uri,
      title: song.name,
      artist: song.artist,
      album_art_url: song.albumUrl,
      preview_url: song.previewUrl,
    };

    // Insertar la canción
    const { error: insertError } = await supabase.from('songs').insert(songData);

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

/**
 * Busca un video en YouTube basado en el título y artista de una canción
 * Usa la YouTube Data API v3 con cacheo en la base de datos
 *
 * @param songTitle - Título de la canción
 * @param artist - Artista de la canción
 * @param songId - ID opcional de la canción en la DB para cachear el resultado
 */
export async function searchYouTube(
  songTitle: string,
  artist: string,
  songId?: string
): Promise<{ result: YouTubeSearchResult | null; error: string | null }> {
  const supabase = await createClient();

  // Si tenemos songId, primero verificar si ya está cacheado
  if (songId) {
    const { data: song } = await supabase
      .from('songs')
      .select('youtube_video_id')
      .eq('id', songId)
      .single();

    if (song?.youtube_video_id) {
      console.log('[YouTube] Using cached videoId:', song.youtube_video_id);
      return {
        result: {
          videoId: song.youtube_video_id,
          title: `${artist} - ${songTitle}`,
          channelTitle: '',
          thumbnailUrl: `https://i.ytimg.com/vi/${song.youtube_video_id}/mqdefault.jpg`,
        },
        error: null,
      };
    }
  }

  // No hay cache, buscar en YouTube API
  const apiKey = process.env.YOUTUBE_API_KEY;

  if (!apiKey) {
    console.error('Missing YOUTUBE_API_KEY');
    return { result: null, error: 'Configuración de YouTube incompleta' };
  }

  try {
    // Construir query de búsqueda: "artista - canción"
    const query = `${artist} - ${songTitle}`;
    const encodedQuery = encodeURIComponent(query);

    console.log('[YouTube API] Searching:', query);

    // Llamar a la API de YouTube
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/search?` +
      `part=snippet&` +
      `q=${encodedQuery}&` +
      `type=video&` +
      `videoCategoryId=10&` + // Categoría: Music
      `maxResults=1&` +
      `key=${apiKey}`,
      { next: { revalidate: 3600 } } // Cache HTTP por 1 hora
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('YouTube API error:', response.status, errorData);

      if (response.status === 403) {
        return { result: null, error: 'Cuota de YouTube API agotada' };
      }
      return { result: null, error: 'Error al buscar en YouTube' };
    }

    const data = await response.json();

    if (!data.items || data.items.length === 0) {
      return { result: null, error: 'No se encontró el video' };
    }

    const video = data.items[0];
    const videoId = video.id.videoId;

    console.log('[YouTube API] Found:', videoId, '-', video.snippet.title);

    // Cachear el resultado en la DB si tenemos songId
    if (songId && videoId) {
      const { error: updateError } = await supabase
        .from('songs')
        .update({ youtube_video_id: videoId })
        .eq('id', songId);

      if (updateError) {
        console.warn('[YouTube] Failed to cache videoId:', updateError);
      } else {
        console.log('[YouTube] Cached videoId for song:', songId);
      }
    }

    const result: YouTubeSearchResult = {
      videoId,
      title: video.snippet.title,
      channelTitle: video.snippet.channelTitle,
      thumbnailUrl: video.snippet.thumbnails.medium?.url || video.snippet.thumbnails.default?.url,
    };

    return { result, error: null };
  } catch (err) {
    console.error('YouTube search error:', err);
    return { result: null, error: 'Error al buscar en YouTube' };
  }
}

/**
 * Obtiene los dispositivos de Spotify disponibles del usuario
 * Requiere que el usuario tenga Spotify abierto en algún dispositivo
 */
export async function getSpotifyDevices(): Promise<{
  devices: SpotifyDevice[];
  error: string | null;
}> {
  try {
    const { spotifyApi, error } = await getSpotifyClientWithUserToken();
    if (error || !spotifyApi) {
      return { devices: [], error: error || 'No hay sesión activa' };
    }

    const response = await spotifyApi.getMyDevices();

    if (!response.body.devices) {
      return { devices: [], error: null };
    }

    const devices: SpotifyDevice[] = response.body.devices
      .filter((d): d is SpotifyApi.UserDevice & { id: string } => d.id !== null)
      .map((device) => ({
        id: device.id,
        name: device.name || 'Dispositivo desconocido',
        type: device.type || 'Unknown',
        isActive: device.is_active || false,
        volumePercent: device.volume_percent || 50,
      }));

    return { devices, error: null };
  } catch (err) {
    console.error('Get devices error:', err);
    return { devices: [], error: 'Error al obtener dispositivos' };
  }
}

/**
 * Reproduce una canción en un dispositivo específico de Spotify
 * Funciona incluso si el dispositivo no está activo (lo activa automáticamente)
 */
export async function playOnSpotifyDevice(
  deviceId: string,
  spotifyUri: string,
  positionMs: number = 0
): Promise<{ success: boolean; error: string | null }> {
  try {
    const { spotifyApi, error } = await getSpotifyClientWithUserToken();
    if (error || !spotifyApi) {
      return { success: false, error: error || 'No hay sesión activa' };
    }

    // Transferir reproducción al dispositivo y reproducir
    await spotifyApi.play({
      device_id: deviceId,
      uris: [spotifyUri],
      position_ms: positionMs,
    });

    return { success: true, error: null };
  } catch (err) {
    console.error('Play on device error:', err);

    // Check for specific errors
    if (err instanceof Error) {
      if (err.message.includes('NO_ACTIVE_DEVICE') || err.message.includes('Device not found')) {
        return { success: false, error: 'El dispositivo no está disponible. Abre Spotify en tu móvil.' };
      }
      if (err.message.includes('PREMIUM_REQUIRED')) {
        return { success: false, error: 'Se requiere Spotify Premium' };
      }
    }

    return { success: false, error: 'Error al reproducir' };
  }
}

/**
 * Pausa la reproducción en Spotify
 */
export async function pauseSpotifyPlayback(
  deviceId?: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    const { spotifyApi, error } = await getSpotifyClientWithUserToken();
    if (error || !spotifyApi) {
      return { success: false, error: error || 'No hay sesión activa' };
    }

    await spotifyApi.pause(deviceId ? { device_id: deviceId } : undefined);

    return { success: true, error: null };
  } catch (err) {
    console.error('Pause playback error:', err);
    return { success: false, error: 'Error al pausar' };
  }
}
