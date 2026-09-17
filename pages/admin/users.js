import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth, getAccessToken } from '../../lib/useAuth';
import TopBar from '../../components/TopBar';

export default function KelolaUser() {
  const router = useRouter();
  const { profile, loading } = useAuth();
  const [users, setUsers] = useState([]);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({});
  const [msg, setMsg] = useState('');
  const [cari, setCari] = useState('');
  const [busy, setBusy] = useState(false);

  const isAdmin = profile && (profile.role === 'admin' || profile.role === 'super_admin');

  useEffect(() => {
    if (!loading && profile && !isAdmin) router.push('/');
  }, [loading, profile]);

  async function load() {
    const token = await getAccessToken();
    const res = await fetch('/api/admin/list-users', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json();
    setUsers(json.data || []);
  }

  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

  function mulaiEdit(u) {
    setEditId(u.id);
    setMsg('');
    setForm({
      nama: u.nama || '',
      email: u.email || '',
      password: '',
      tanggal_daftar: u.tanggal_daftar ? u.tanggal_daftar.slice(0, 10) : '',
      tipe: u.tipe || 'harian',
      level_self: u.level_self || '',
      level_final: u.level_final || '',
    });
  }

  async function simpan(player_id) {
    setBusy(true);
    setMsg('');
    const token = await getAccessToken();
    const body = { player_id, ...form };
    if (!body.password) delete body.password; // jangan kirim password kosong

    const res = await fetch('/api/admin/update-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) { setMsg(json.error); return; }
    setMsg('Tersimpan.');
    setEditId(null);
    load();
  }

  if (loading || !isAdmin) return null;

  const usersTampil = users.filter((u) =>
    (u.nama || '').toLowerCase().includes(cari.toLowerCase()) ||
    (u.email || '').toLowerCase().includes(cari.toLowerCase())
  );

  return (
    <div className="wrap">
      <TopBar profile={profile} />
      <h1>Kelola User</h1>
      <p className="subtle" style={{ fontSize: 11 }}>
        Edit langsung dari sini — otomatis kesimpen ke database yang sama, gak perlu buka Supabase.
        Ganti password di sini = orangnya bisa langsung pakai password baru itu buat login.
      </p>

      <input placeholder="Cari nama/email..." value={cari} onChange={(e) => setCari(e.target.value)} style={{ marginBottom: 16 }} />

      {msg && <p className={msg === 'Tersimpan.' ? 'success' : 'error'}>{msg}</p>}

      {usersTampil.map((u) => (
        <div className="card" key={u.id}>
          {editId === u.id ? (
            <div>
              <label style={{ marginTop: 0 }}>Nama</label>
              <input value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} />

              <label>Email</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />

              <label>Password Baru (kosongin kalau gak mau ganti)</label>
              <input type="text" placeholder="min. 6 karakter" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />

              <label>Tanggal Daftar (member sejak)</label>
              <input type="date" value={form.tanggal_daftar} onChange={(e) => setForm({ ...form, tanggal_daftar: e.target.value })} />

              <label>Status</label>
              <select value={form.tipe} onChange={(e) => setForm({ ...form, tipe: e.target.value })}>
                <option value="member">Member</option>
                <option value="harian">Harian</option>
              </select>

              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <label>Level Pengajuan</label>
                  <select value={form.level_self} onChange={(e) => setForm({ ...form, level_self: e.target.value })}>
                    <option value="">-</option>
                    <option value="A1">A1</option><option value="A2">A2</option>
                    <option value="B1">B1</option><option value="B2">B2</option>
                    <option value="C">C</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label>Level Final</label>
                  <select value={form.level_final} onChange={(e) => setForm({ ...form, level_final: e.target.value })}>
                    <option value="">-</option>
                    <option value="A1">A1</option><option value="A2">A2</option>
                    <option value="B1">B1</option><option value="B2">B2</option>
                    <option value="C">C</option>
                  </select>
                </div>
              </div>

              <div className="form-actions" style={{ display: 'flex', gap: 8 }}>
                <button disabled={busy} onClick={() => simpan(u.id)}>{busy ? 'Menyimpan...' : 'Simpan'}</button>
                <button type="button" className="secondary" onClick={() => setEditId(null)}>Batal</button>
              </div>
            </div>
          ) : (
            <div className="card-row">
              <div>
                <strong>{u.nama}</strong>
                <div className="subtle" style={{ fontSize: 11, marginTop: 2 }}>
                  {u.email} · {u.tipe === 'member' ? 'Member' : 'Harian'} · Level: {u.level_final || '-'} (usulan: {u.level_self || '-'})
                </div>
              </div>
              <button className="secondary" onClick={() => mulaiEdit(u)}>Edit</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
