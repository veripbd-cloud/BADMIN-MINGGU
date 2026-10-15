import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';

const BRAND_DEFAULT = { bagian1: 'BADMIN', bagian2: 'MINGGU' };
const CACHE_NILAI = 'brand_badmin';

export default function TopBar({ profile }) {
  const router = useRouter();
  const [brand, setBrand] = useState(BRAND_DEFAULT);

  useEffect(() => {
    let masihAda = true;

    // Tampilkan nama dari cache dulu biar gak kedip
    try {
      const nilai = localStorage.getItem(CACHE_NILAI);
      if (nilai) setBrand(JSON.parse(nilai));
    } catch (e) { /* abaikan */ }

    // Lalu SELALU cocokin ke server, jadi HP dan laptop pasti sama
    async function ambilBrand() {
      try {
        const res = await fetch('/api/brand', { cache: 'no-store' });
        if (!res.ok) return;
        const json = await res.json();
        if (!json || !json.brand || !masihAda) return;
        setBrand(json.brand);
        try { localStorage.setItem(CACHE_NILAI, JSON.stringify(json.brand)); } catch (e) { /* abaikan */ }
      } catch (e) { /* kalau gagal, tetap pakai yang ada */ }
    }
    ambilBrand();

    return () => { masihAda = false; };
  }, []);

  // Tab induk tetap nyala di halaman turunannya (detail sesi, Kelola User, dll)
  const path = router.pathname;
  const aktifSesi = path === '/' || path.startsWith('/sesi') || path.startsWith('/member-bulanan');
  const aktifKas = path.startsWith('/kas');
  const aktifProfil = path.startsWith('/profile') || path === '/reset-password';
  const aktifAdmin = path.startsWith('/admin');

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
        <Link href="/" className={aktifSesi ? 'active' : ''}>
          Sesi & Member
        </Link>
        {profile && (profile.tipe === 'member' || profile.role === 'admin' || profile.role === 'super_admin') && (
          <Link href="/kas" className={aktifKas ? 'active' : ''}>
            Kas & Shuttlecock
          </Link>
        )}
        <Link href="/profile" className={aktifProfil ? 'active' : ''}>
          Profil
        </Link>
        {profile && (profile.role === 'admin' || profile.role === 'super_admin') && (
          <Link href="/admin" className={aktifAdmin ? 'active' : ''}>
            Admin
          </Link>
        )}
        {profile && <a onClick={signOut} style={{ cursor: 'pointer' }}>Keluar</a>}
      </nav>
    </div>
  );
}
