import { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { supabase } from '../lib/supabaseClient';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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

  return (
    <div className="wrap" style={{ maxWidth: 380, paddingTop: 80 }}>
      <h1>Masuk</h1>
      <p className="subtle">BADMIN MINGGU — absensi & kas</p>
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
      <p className="subtle" style={{ marginTop: 20 }}>
        Belum punya akun? <Link href="/register">Daftar di sini</Link>
      </p>
    </div>
  );
}
