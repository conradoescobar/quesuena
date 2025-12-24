'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Search, Plus, Loader2, Music, X, Check } from 'lucide-react';
import { searchSpotify, addSongToRoom, SpotifySearchResult } from '@/lib/actions/game-actions';

interface SongSearchProps {
  roomId: string;
  onSongAdded?: () => void;
}

export function SongSearch({ roomId, onSongAdded }: SongSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SpotifySearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isAdding, setIsAdding] = useState<string | null>(null);
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
  const handleSearch = useCallback(async (searchQuery: string) => {
    if (searchQuery.trim().length < 2) {
      setResults([]);
      setShowResults(false);
      return;
    }

    setIsSearching(true);
    setError(null);

    const { results: searchResults, error: searchError } = await searchSpotify(searchQuery);

    if (searchError) {
      setError(searchError);
      setResults([]);
    } else {
      setResults(searchResults);
      setShowResults(true);
    }

    setIsSearching(false);
  }, []);

  // Manejar cambios en el input
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    setError(null);

    // Debounce la búsqueda
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      handleSearch(value);
    }, 400);
  };

  // Manejar envío del formulario
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    handleSearch(query);
  };

  // Agregar canción
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
      setSuccessMessage(`"${song.name}" agregada a la cola`);
      // Remover la canción de los resultados
      setResults((prev) => prev.filter((s) => s.id !== song.id));
      onSongAdded?.();
    }

    setIsAdding(null);
  };

  // Limpiar búsqueda
  const handleClear = () => {
    setQuery('');
    setResults([]);
    setShowResults(false);
    setError(null);
  };

  return (
    <div ref={containerRef} className="relative w-full">
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
            onFocus={() => results.length > 0 && setShowResults(true)}
            placeholder="Buscar canciones en Spotify..."
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

      {/* Search Results Dropdown */}
      {showResults && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-gray-800 border border-gray-700
                        rounded-xl shadow-2xl overflow-hidden z-40 max-h-80 overflow-y-auto">
          {results.map((song) => (
            <div
              key={song.id}
              className="flex items-center gap-3 p-3 hover:bg-gray-700/50 transition-colors
                         border-b border-gray-700/50 last:border-b-0"
            >
              {/* Album Art */}
              <div className="flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden bg-gray-700">
                {song.albumUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={song.albumUrl}
                    alt={song.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Music className="w-6 h-6 text-gray-500" />
                  </div>
                )}
              </div>

              {/* Song Info */}
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium truncate">{song.name}</p>
                <p className="text-gray-400 text-sm truncate">{song.artist}</p>
              </div>

              {/* Add Button */}
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

      {/* No Results */}
      {showResults && query.length >= 2 && !isSearching && results.length === 0 && !error && (
        <div className="absolute top-full left-0 right-0 mt-2 p-4 bg-gray-800 border border-gray-700
                        rounded-xl text-gray-400 text-center z-40">
          No se encontraron resultados para &ldquo;{query}&rdquo;
        </div>
      )}
    </div>
  );
}
