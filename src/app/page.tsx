import { createClient } from '@/utils/supabase/server';
import { signInWithSpotify } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // If user is already logged in, redirect to lobby
  if (user) {
    redirect('/lobby');
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex flex-col items-center justify-center p-8">
      <div className="text-center space-y-8 max-w-md">
        {/* Logo/Title */}
        <div className="space-y-4">
          <h1 className="text-5xl font-bold text-white tracking-tight">
            Adivina la
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-500">
              Cancion
            </span>
          </h1>
          <p className="text-gray-400 text-lg">
            Compite con tus amigos para ver quien reconoce las canciones mas rapido
          </p>
        </div>

        {/* Spotify Login Button */}
        <form action={signInWithSpotify}>
          <button
            type="submit"
            className="w-full flex items-center justify-center gap-3 bg-[#1DB954] hover:bg-[#1ed760] text-white font-semibold py-4 px-8 rounded-full transition-all duration-200 transform hover:scale-105 shadow-lg shadow-green-500/25"
          >
            <SpotifyIcon />
            Iniciar sesion con Spotify
          </button>
        </form>

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
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
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
