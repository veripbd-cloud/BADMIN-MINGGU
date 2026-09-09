import { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { supabase } from '../lib/supabaseClient';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [modeLupaPassword, setModeLupaPassword] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError('Email atau password salah.');
      return;
    }
    router.push('/');
  }

  async function handleLupaPassword(e) {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setInfo('Kalau email itu terdaftar, link buat reset password sudah dikirim. Cek inbox (dan folder spam) kamu.');
  }

  if (modeLupaPassword) {
    return (
      <div className="wrap" style={{ maxWidth: 380, paddingTop: 80 }}>
        <h1>Lupa Password</h1>
        <p className="subtle">Masukkan email yang kamu pakai daftar. Link reset password akan dikirim ke situ.</p>
        <form onSubmit={handleLupaPassword}>
          <label>Email</label>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          {error && <p className="error">{error}</p>}
          {info && <p className="success">{info}</p>}
          <div className="form-actions">
            <button type="submit" disabled={loading}>{loading ? 'Mengirim...' : 'Kirim Link Reset'}</button>
          </div>
        </form>
        <p className="subtle" style={{ marginTop: 20 }}>
          <a style={{ cursor: 'pointer' }} onClick={() => { setModeLupaPassword(false); setError(''); setInfo(''); }}>
            Kembali ke halaman Masuk
          </a>
        </p>
      </div>
    );
  }

  return (
    <div className="wrap" style={{ maxWidth: 380, paddingTop: 80 }}>
      <h1>Masuk</h1>
      <p className="subtle">Badmin Minggu — absensi & kas</p>
      <form onSubmit={handleLogin}>
        <label>Email</label>
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <label>Password</label>
        <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <p className="error">{error}</p>}
        <div className="form-actions">
          <button type="submit" disabled={loading}>{loading ? 'Memproses...' : 'Masuk'}</button>
        </div>
      </form>
      <p className="subtle" style={{ marginTop: 12 }}>
        <a style={{ cursor: 'pointer' }} onClick={() => { setModeLupaPassword(true); setError(''); setInfo(''); }}>
          Lupa password?
        </a>
      </p>
      <p className="subtle" style={{ marginTop: 8 }}>
        Belum punya akun? <Link href="/register">Daftar di sini</Link>
      </p>
    </div>
  );
}
