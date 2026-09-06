import { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { supabase } from '../lib/supabaseClient';

export default function Register() {
  const router = useRouter();
  const [form, setForm] = useState({
    nama: '', email: '', password: '', tipe: 'harian', level_self: 'pemula',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleRegister(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
    });

    if (signUpError) {
      setLoading(false);
      setError(signUpError.message);
      return;
    }

    // Buat baris profil. Kalau project Supabase mengaktifkan "confirm email",
    // user.id tetap ada di sini walau belum bisa langsung login.
    const userId = data.user?.id;
    if (userId) {
      const { error: profileError } = await supabase.from('profiles').insert({
        id: userId,
        nama: form.nama,
        tipe: form.tipe,
        level_self: form.level_self,
        level_final: null,
        status_approval: 'pending',
        role: 'player',
      });
      if (profileError) {
        setLoading(false);
        setError('Akun dibuat tapi profil gagal disimpan: ' + profileError.message);
        return;
      }
    }

    setLoading(false);
    router.push('/');
  }

  return (
    <div className="wrap" style={{ maxWidth: 420, paddingTop: 50 }}>
      <h1>Daftar Akun</h1>
      <p className="subtle">
        Level yang lu isi di bawah cuma referensi awal — level final tetap ditentukan admin.
        Lu tetap boleh langsung ikut absen sesi minggu ini sambil menunggu review.
      </p>
      <form onSubmit={handleRegister}>
        <label>Nama</label>
        <input required value={form.nama} onChange={(e) => update('nama', e.target.value)} />

        <label>Email</label>
        <input type="email" required value={form.email} onChange={(e) => update('email', e.target.value)} />

        <label>Password</label>
        <input type="password" required minLength={6} value={form.password} onChange={(e) => update('password', e.target.value)} />

        <label>Status</label>
        <select value={form.tipe} onChange={(e) => update('tipe', e.target.value)}>
          <option value="harian">Pemain harian</option>
          <option value="member">Member</option>
        </select>

        <label>Level (perkiraan sendiri)</label>
        <select value={form.level_self} onChange={(e) => update('level_self', e.target.value)}>
          <option value="pemula">Pemula</option>
          <option value="menengah">Menengah</option>
          <option value="mahir">Mahir</option>
        </select>

        {error && <p className="error">{error}</p>}
        <div className="form-actions">
          <button type="submit" disabled={loading}>{loading ? 'Memproses...' : 'Daftar'}</button>
        </div>
      </form>
      <p className="subtle" style={{ marginTop: 20 }}>
        Sudah punya akun? <Link href="/login">Masuk di sini</Link>
      </p>
    </div>
  );
}
