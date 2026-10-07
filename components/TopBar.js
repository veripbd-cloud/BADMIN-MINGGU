import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';

const BRAND_DEFAULT = { bagian1: 'BADMIN', bagian2: 'MINGGU' };

export default function TopBar({ profile }) {
  const router = useRouter();
  const [brand, setBrand] = useState(BRAND_DEFAULT);

  useEffect(() => {
    try {
      const cache = localStorage.getItem('brand_badmin');
      if (cache) setBrand(JSON.parse(cache));
    } catch (e) { /* abaikan */ }

    async function ambilBrand() {
      const { data } = await supabase
        .from('pengaturan')
        .select('key, value')
        .in('key', ['brand_bagian1', 'brand_bagian2']);
      if (!data || data.length === 0) return;
      const map = {};
      data.forEach((r) => { map[r.key] = r.value; });
      const baru = {
        bagian1: map.brand_bagian1 ?? BRAND_DEFAULT.bagian1,
        bagian2: map.brand_bagian2 ?? BRAND_DEFAULT.bagian2,
      };
      setBrand(baru);
      try { localStorage.setItem('brand_badmin', JSON.stringify(baru)); } catch (e) { /* abaikan */ }
    }
    ambilBrand();
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  return (
    <div className="topbar">
      <div className="brand">
        {brand.bagian1} <span className="accent">{brand.bagian2}</span>
      </div>
      <nav className="tabs">
        <Link href="/" className={router.pathname === '/' ? 'active' : ''}>
          Sesi & Member
        </Link>
        {profile && (profile.tipe === 'member' || profile.role === 'admin' || profile.role === 'super_admin') && (
          <Link href="/kas" className={router.pathname === '/kas' ? 'active' : ''}>
            Kas & Shuttlecock
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
