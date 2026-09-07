import { useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';

export default function ResetPassword() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [sukses, setSukses] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSukses(true);
    setTimeout(() => router.push('/'), 2000);
  }

  return (
    <div className="wrap" style={{ maxWidth: 380, paddingTop: 80 }}>
      <h1>Set Password Baru</h1>
      <p className="subtle">Masukkan password baru untuk akun kamu.</p>
      {sukses ? (
        <p className="success">Password berhasil diganti. Mengalihkan ke halaman utama...</p>
      ) : (
        <form onSubmit={handleSubmit}>
          <label>Password Baru</label>
          <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
          {error && <p className="error">{error}</p>}
          <div className="form-actions">
            <button type="submit" disabled={loading}>{loading ? 'Menyimpan...' : 'Simpan Password Baru'}</button>
          </div>
        </form>
      )}
    </div>
  );
}
