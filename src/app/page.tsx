'use client';

import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function Home() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if user is already logged in
  useEffect(() => {
    const checkUser = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        router.push('/lobby');
      } else {
        setIsLoading(false);
      }
    };

    // Check for error in URL
    const params = new URLSearchParams(window.location.search);
    if (params.get('error')) {
      setError('Error al iniciar sesión. Inténtalo de nuevo.');
    }

    checkUser();
  }, [router]);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    setError(null);

    const supabase = createClient();

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'spotify',
      options: {
        // CRÍTICO: Usar window.location.origin para que funcione en localhost Y Vercel
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: [
          'user-read-email',
          'user-read-private',
          'user-read-playback-state',
          'user-modify-playback-state',
          'user-top-read',
          'streaming', // Para el Web Playback SDK
        ].join(' '),
      },
    });

    if (error) {
      console.error('Login error:', error);
      setError('Error al conectar con Spotify');
      setIsLoggingIn(false);
    }
    // Si no hay error, el usuario será redirigido a Spotify
  };

  if (isLoading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
        <div className="animate-pulse text-white text-xl">Cargando...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex flex-col items-center justify-center p-8">
      <div className="text-center space-y-8 max-w-md">
        {/* Logo/Title */}
        <div className="space-y-4">
          <h1 className="text-6xl font-black text-white tracking-tight">
            Adivina la
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-500 mt-2">
              Cancion
            </span>
          </h1>
          <p className="text-gray-400 text-lg">
            Compite con tus amigos para ver quien reconoce las canciones mas rapido
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/50 rounded-xl p-4 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Spotify Login Button */}
        <button
          onClick={handleLogin}
          disabled={isLoggingIn}
          className="w-full flex items-center justify-center gap-3 bg-[#1DB954] hover:bg-[#1ed760] disabled:bg-[#1DB954]/50 text-white font-bold text-lg py-5 px-8 rounded-full transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-xl shadow-green-500/30 disabled:cursor-not-allowed disabled:transform-none"
        >
          {isLoggingIn ? (
            <>
              <LoadingSpinner />
              Conectando...
            </>
          ) : (
            <>
              <SpotifyIcon />
              Iniciar sesion con Spotify
            </>
          )}
        </button>

        {/* Features */}
        <div className="grid grid-cols-3 gap-4 pt-8">
          <FeatureCard icon="music" label="Tus canciones" />
          <FeatureCard icon="users" label="Multijugador" />
          <FeatureCard icon="zap" label="Tiempo real" />
        </div>
      </div>

      {/* Footer */}
      <footer className="absolute bottom-8 text-gray-500 text-sm">
        Conecta tu cuenta de Spotify para empezar a jugar
      </footer>
    </main>
  );
}

function SpotifyIcon() {
  return (
    <svg className="w-7 h-7" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
    </svg>
  );
}

function LoadingSpinner() {
  return (
    <svg className="animate-spin h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}

function FeatureCard({ icon, label }: { icon: string; label: string }) {
  const icons: Record<string, JSX.Element> = {
    music: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
      </svg>
    ),
    users: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
    zap: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
  };

  return (
    <div className="flex flex-col items-center gap-2 p-4 rounded-xl bg-white/5 border border-white/10">
      <div className="text-green-400">{icons[icon]}</div>
      <span className="text-gray-300 text-xs">{label}</span>
    </div>
  );
}
