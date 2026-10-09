import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';

const BRAND_DEFAULT = { bagian1: 'BADMIN', bagian2: 'MINGGU' };
const CACHE_NILAI = 'brand_badmin';
const CACHE_WAKTU = 'brand_badmin_t';
const MASA_SEGAR_MS = 10 * 60 * 1000;

export default function TopBar({ profile }) {
  const router = useRouter();
  const [brand, setBrand] = useState(BRAND_DEFAULT);

  useEffect(() => {
    try {
      const nilai = localStorage.getItem(CACHE_NILAI);
      const waktu = parseInt(localStorage.getItem(CACHE_WAKTU) || '0', 10);
      if (nilai) {
        setBrand(JSON.parse(nilai));
        // Cache masih segar -> gak perlu nanya ke server lagi (hemat 1 request per halaman)
        if (Date.now() - waktu < MASA_SEGAR_MS) return;
      }
    } catch (e) { /* abaikan */ }

    async function ambilBrand() {
      try {
        const { data } = await supabase
          .from('pengaturan').select('key, value')
          .in('key', ['brand_bagian1', 'brand_bagian2']);
        if (!data || data.length === 0) return;
        const map = {};
        data.forEach((r) => { map[r.key] = r.value; });
        const baru = {
          bagian1: map.brand_bagian1 ?? BRAND_DEFAULT.bagian1,
          bagian2: map.brand_bagian2 ?? BRAND_DEFAULT.bagian2,
        };
        setBrand(baru);
        try {
          localStorage.setItem(CACHE_NILAI, JSON.stringify(baru));
          localStorage.setItem(CACHE_WAKTU, String(Date.now()));
        } catch (e) { /* abaikan */ }
      } catch (e) { /* kalau gagal, tetep pakai nama yang ada */ }
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
