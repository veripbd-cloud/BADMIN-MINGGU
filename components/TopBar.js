import Link from 'next/link';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';

export default function TopBar({ profile }) {
  const router = useRouter();

  async function signOut() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  return (
    <div className="topbar">
      <div className="brand">
        Kumpul <span className="accent">Badminton</span>
      </div>
      <nav className="tabs">
        <Link href="/" className={router.pathname === '/' ? 'active' : ''}>
          Sesi
        </Link>
        {profile && (profile.tipe === 'member' || profile.role === 'admin' || profile.role === 'super_admin') && (
          <Link href="/kas" className={router.pathname === '/kas' ? 'active' : ''}>
            Kas
          </Link>
        )}
        <Link href="/profile" className={router.pathname === '/profile' ? 'active' : ''}>
          Profil
        </Link>
        {profile && (profile.role === 'admin' || profile.role === 'super_admin') && (
          <Link href="/admin" className={router.pathname === '/admin' ? 'active' : ''}>
            Admin
          </Link>
        )}
        {profile && <a onClick={signOut} style={{ cursor: 'pointer' }}>Keluar</a>}
      </nav>
    </div>
  );
}
