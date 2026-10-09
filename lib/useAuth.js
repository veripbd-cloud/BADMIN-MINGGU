import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from './supabaseClient';

function denganTimeout(promise, ms) {
  let timer;
  const batas = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), ms); });
  return Promise.race([promise, batas]).finally(() => clearTimeout(timer));
}

async function ambilProfil(userId) {
  for (let percobaan = 0; percobaan < 3; percobaan++) {
    try {
      const { data, error } = await denganTimeout(
        supabase.from('profiles').select('*').eq('id', userId).single(),
        8000
      );
      if (!error && data) return data;
    } catch (e) { /* ulangi */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  return null;
}

export function useAuth({ redirectIfGuest = true } = {}) {
  const router = useRouter();
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function load() {
      let akanReload = false;
      try {
        const { data: { session } } = await denganTimeout(supabase.auth.getSession(), 8000);
        if (!mounted) return;
        try { sessionStorage.removeItem('auth_retry'); } catch (e) { /* abaikan */ }
        setSession(session);

        if (!session) {
          if (redirectIfGuest) router.push('/login');
          return;
        }
        const profileData = await ambilProfil(session.user.id);
        if (!mounted) return;
        setProfile(profileData);
      } catch (e) {
        // Cek sesi macet/gagal: muat ulang otomatis SEKALI (sama kayak refresh manual)
        try {
          if (typeof window !== 'undefined' && sessionStorage.getItem('auth_retry') !== '1') {
            sessionStorage.setItem('auth_retry', '1');
            akanReload = true;
            window.location.reload();
          }
        } catch (err) { /* abaikan */ }
      } finally {
        // Apapun yang terjadi, jangan biarin halaman nyangkut di "loading" (itu yang bikin blank)
        if (mounted && !akanReload) setLoading(false);
      }
    }

    load();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (!newSession && redirectIfGuest) router.push('/login');
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { session, profile, loading };
}

export async function getAccessToken() {
  try {
    const { data: { session } } = await denganTimeout(supabase.auth.getSession(), 8000);
    return session?.access_token;
  } catch (e) {
    return undefined;
  }
}
