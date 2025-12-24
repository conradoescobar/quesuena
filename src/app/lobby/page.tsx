import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { signOut } from '@/lib/auth';
import { LobbyClient } from './LobbyClient';

export default async function LobbyPage() {
  const supabase = await createClient();

  // Get user
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    redirect('/');
  }

  // Get user display info
  const displayName =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email?.split('@')[0] ||
    'Player';

  const avatarUrl = user.user_metadata?.avatar_url || null;

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <header className="flex items-center justify-between mb-12">
          <h1 className="text-2xl font-bold text-white">
            Adivina la <span className="text-green-400">Cancion</span>
          </h1>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              {avatarUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl}
                  alt={displayName}
                  className="w-10 h-10 rounded-full border-2 border-green-400"
                />
              )}
              <span className="text-white font-medium">{displayName}</span>
            </div>
            <form action={signOut}>
              <button
                type="submit"
                className="text-gray-400 hover:text-white text-sm transition-colors"
              >
                Salir
              </button>
            </form>
          </div>
        </header>

        {/* Main Content */}
        <LobbyClient />
      </div>
    </main>
  );
}
