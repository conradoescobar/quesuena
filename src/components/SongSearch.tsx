'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Search, Plus, Loader2, Music, X, Check, ListMusic, Download } from 'lucide-react';
import {
  searchSpotify,
  searchPlaylists,
  addSongToRoom,
  importFromPlaylist,
  SpotifySearchResult,
  SpotifyPlaylistResult,
} from '@/lib/actions/game-actions';

type TabType = 'songs' | 'playlists';

interface SongSearchProps {
  roomId: string;
  onSongAdded?: () => void;
}

export function SongSearch({ roomId, onSongAdded }: SongSearchProps) {
  const [activeTab, setActiveTab] = useState<TabType>('songs');
  const [query, setQuery] = useState('');
  const [songResults, setSongResults] = useState<SpotifySearchResult[]>([]);
  const [playlistResults, setPlaylistResults] = useState<SpotifyPlaylistResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isAdding, setIsAdding] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);

  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Cerrar resultados al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Limpiar mensaje de éxito después de 3 segundos
  useEffect(() => {
    if (successMessage) {
      const timeout = setTimeout(() => setSuccessMessage(null), 3000);
      return () => clearTimeout(timeout);
    }
  }, [successMessage]);

  // Búsqueda con debounce
  const handleSearch = useCallback(async (searchQuery: string, tab: TabType) => {
    if (searchQuery.trim().length < 2) {
      setSongResults([]);
      setPlaylistResults([]);
      setShowResults(false);
      return;
    }

    setIsSearching(true);
    setError(null);

    if (tab === 'songs') {
      const { results, error: searchError } = await searchSpotify(searchQuery);
      if (searchError) {
        setError(searchError);
        setSongResults([]);
      } else {
        setSongResults(results);
        setShowResults(true);
      }
    } else {
      const { results, error: searchError } = await searchPlaylists(searchQuery);
      if (searchError) {
        setError(searchError);
        setPlaylistResults([]);
      } else {
        setPlaylistResults(results);
        setShowResults(true);
      }
    }

    setIsSearching(false);
  }, []);

  // Manejar cambios en el input
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    setError(null);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      handleSearch(value, activeTab);
    }, 400);
  };

  // Manejar envío del formulario
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    handleSearch(query, activeTab);
  };

  // Cambiar de tab
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setSongResults([]);
    setPlaylistResults([]);
    setShowResults(false);
    setError(null);

    // Re-buscar si hay query
    if (query.trim().length >= 2) {
      handleSearch(query, tab);
    }
  };

  // Agregar canción individual
  const handleAddSong = async (song: SpotifySearchResult) => {
    setIsAdding(song.id);
    setError(null);

    const { success, error: addError } = await addSongToRoom(roomId, {
      uri: song.uri,
      name: song.name,
      artist: song.artist,
      albumUrl: song.albumUrl,
    });

    if (addError) {
      setError(addError);
    } else if (success) {
      setSuccessMessage(`"${song.name}" agregada`);
      setSongResults((prev) => prev.filter((s) => s.id !== song.id));
      onSongAdded?.();
    }

    setIsAdding(null);
  };

  // Importar canciones de playlist
  const handleImportPlaylist = async (playlist: SpotifyPlaylistResult) => {
    setIsImporting(playlist.id);
    setError(null);

    const { success, addedCount, error: importError } = await importFromPlaylist(
      roomId,
      playlist.id,
      5
    );

    if (importError) {
      setError(importError);
    } else if (success) {
      setSuccessMessage(`${addedCount} canciones agregadas de "${playlist.name}"`);
      onSongAdded?.();
    }

    setIsImporting(null);
  };

  // Limpiar búsqueda
  const handleClear = () => {
    setQuery('');
    setSongResults([]);
    setPlaylistResults([]);
    setShowResults(false);
    setError(null);
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Tabs */}
      <div className="flex mb-2 bg-gray-800/50 rounded-lg p-1">
        <button
          onClick={() => handleTabChange('songs')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-md text-sm font-medium transition-all ${
            activeTab === 'songs'
              ? 'bg-green-500 text-white'
              : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
          }`}
        >
          <Music className="w-4 h-4" />
          <span>Canciones</span>
        </button>
        <button
          onClick={() => handleTabChange('playlists')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-md text-sm font-medium transition-all ${
            activeTab === 'playlists'
              ? 'bg-green-500 text-white'
              : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
          }`}
        >
          <ListMusic className="w-4 h-4" />
          <span>Playlists</span>
        </button>
      </div>

      {/* Search Input */}
      <form onSubmit={handleSubmit} className="relative">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            {isSearching ? (
              <Loader2 className="h-5 w-5 text-gray-400 animate-spin" />
            ) : (
              <Search className="h-5 w-5 text-gray-400" />
            )}
          </div>

          <input
            type="text"
            value={query}
            onChange={handleInputChange}
            onFocus={() => {
              const hasResults = activeTab === 'songs' ? songResults.length > 0 : playlistResults.length > 0;
              if (hasResults) setShowResults(true);
            }}
            placeholder={activeTab === 'songs' ? 'Buscar canciones...' : 'Buscar playlists...'}
            className="w-full pl-10 pr-10 py-3 bg-gray-800/80 border border-gray-700 rounded-xl
                       text-white placeholder-gray-400
                       focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500
                       transition-all duration-200"
          />

          {query && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      </form>

      {/* Success Toast */}
      {successMessage && (
        <div className="absolute top-full left-0 right-0 mt-2 p-3 bg-green-500/20 border border-green-500/50
                        rounded-xl flex items-center gap-2 text-green-400 text-sm animate-fade-in z-50">
          <Check className="h-4 w-4 flex-shrink-0" />
          <span className="truncate">{successMessage}</span>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="absolute top-full left-0 right-0 mt-2 p-3 bg-red-500/20 border border-red-500/50
                        rounded-xl text-red-400 text-sm z-50">
          {error}
        </div>
      )}

      {/* Songs Results */}
      {showResults && activeTab === 'songs' && songResults.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-gray-800 border border-gray-700
                        rounded-xl shadow-2xl overflow-hidden z-40 max-h-80 overflow-y-auto">
          {songResults.map((song) => (
            <div
              key={song.id}
              className="flex items-center gap-3 p-3 hover:bg-gray-700/50 transition-colors
                         border-b border-gray-700/50 last:border-b-0"
            >
              <div className="flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden bg-gray-700">
                {song.albumUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={song.albumUrl} alt={song.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Music className="w-6 h-6 text-gray-500" />
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-white font-medium truncate">{song.name}</p>
                <p className="text-gray-400 text-sm truncate">{song.artist}</p>
              </div>

              <button
                onClick={() => handleAddSong(song)}
                disabled={isAdding === song.id}
                className="flex-shrink-0 p-2 rounded-full bg-green-500 hover:bg-green-400
                           disabled:bg-gray-600 disabled:cursor-not-allowed
                           text-white transition-colors"
              >
                {isAdding === song.id ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Plus className="w-5 h-5" />
                )}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Playlist Results */}
      {showResults && activeTab === 'playlists' && playlistResults.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-gray-800 border border-gray-700
                        rounded-xl shadow-2xl overflow-hidden z-40 max-h-80 overflow-y-auto">
          {playlistResults.map((playlist) => (
            <div
              key={playlist.id}
              className="flex items-center gap-3 p-3 hover:bg-gray-700/50 transition-colors
                         border-b border-gray-700/50 last:border-b-0"
            >
              <div className="flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden bg-gray-700">
                {playlist.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={playlist.imageUrl} alt={playlist.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ListMusic className="w-6 h-6 text-gray-500" />
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-white font-medium truncate">{playlist.name}</p>
                <p className="text-gray-400 text-sm truncate">
                  {playlist.owner} · {playlist.tracksTotal} canciones
                </p>
              </div>

              <button
                onClick={() => handleImportPlaylist(playlist)}
                disabled={isImporting === playlist.id}
                className="flex-shrink-0 flex items-center gap-1.5 py-2 px-3 rounded-lg
                           bg-purple-500 hover:bg-purple-400
                           disabled:bg-gray-600 disabled:cursor-not-allowed
                           text-white text-sm font-medium transition-colors"
              >
                {isImporting === playlist.id ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Importando...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>+5</span>
                  </>
                )}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* No Results */}
      {showResults && query.length >= 2 && !isSearching && !error && (
        <>
          {activeTab === 'songs' && songResults.length === 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 p-4 bg-gray-800 border border-gray-700
                            rounded-xl text-gray-400 text-center z-40">
              No se encontraron canciones para &ldquo;{query}&rdquo;
            </div>
          )}
          {activeTab === 'playlists' && playlistResults.length === 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 p-4 bg-gray-800 border border-gray-700
                            rounded-xl text-gray-400 text-center z-40">
              No se encontraron playlists para &ldquo;{query}&rdquo;
            </div>
          )}
        </>
      )}
    </div>
  );
}
