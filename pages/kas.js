import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth, getAccessToken } from '../lib/useAuth';
import TopBar from '../components/TopBar';

export default function Kas() {
  const { profile, loading } = useAuth();
  const [transaksi, setTransaksi] = useState([]);
  const [outstanding, setOutstanding] = useState([]);
  const [profilesMap, setProfilesMap] = useState({});
  const [form, setForm] = useState({ jenis: 'pengeluaran', kategori: 'bola', nominal: '', keterangan: '' });
  const [msg, setMsg] = useState('');

  const isAdmin = profile && (profile.role === 'admin' || profile.role === 'super_admin');

  async function load() {
    const { data: t } = await supabase.from('transaksi_kas').select('*').order('tanggal', { ascending: false }).limit(50);
    setTransaksi(t || []);

    const { data: o } = await supabase.from('outstanding').select('*').eq('status', 'belum_lunas');
    setOutstanding(o || []);

    const ids = [...new Set((o || []).map((x) => x.player_id))];
    if (ids.length) {
      const { data: p } = await supabase.from('profiles').select('id, nama').in('id', ids);
      const map = {};
      (p || []).forEach((pr) => { map[pr.id] = pr.nama; });
      setProfilesMap(map);
    }
  }

  useEffect(() => { if (!loading) load(); }, [loading]);

  const saldo = transaksi.reduce((sum, t) => sum + (t.jenis === 'pemasukan' ? t.nominal : -t.nominal), 0);
  const totalOutstanding = outstanding.reduce((sum, o) => sum + o.nominal, 0);

  async function tambahTransaksi(e) {
    e.preventDefault();
    setMsg('');
    const token = await getAccessToken();
    const res = await fetch('/api/admin/tambah-transaksi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(form),
    });
    const json = await res.json();
    if (!res.ok) { setMsg(json.error); return; }
    setForm({ jenis: 'pengeluaran', kategori: 'bola', nominal: '', keterangan: '' });
    load();
  }

  async function lunasi(outstanding_id) {
    const token = await getAccessToken();
    await fetch('/api/admin/lunasi-outstanding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ outstanding_id }),
    });
    load();
  }

  if (loading) return null;

  return (
    <div className="wrap">
      <TopBar profile={profile} />
      <h1>Kas</h1>

      <div className="stat">
        <div className="item">
          <span className="num">Rp{saldo.toLocaleString('id-ID')}</span>
          <span className="label">Saldo kas saat ini</span>
        </div>
        <div className="item">
          <span className="num">Rp{totalOutstanding.toLocaleString('id-ID')}</span>
          <span className="label">Total outstanding</span>
        </div>
      </div>

      <h2>Outstanding — Belum Bayar</h2>
      {outstanding.length === 0 && <div className="empty">Tidak ada outstanding. 🎉</div>}
      {outstanding.map((o) => (
        <div className="card outstanding-item" key={o.id}>
          <div className="card-row">
            <div>
              <strong>{profilesMap[o.player_id] || '—'}</strong>
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>{o.keterangan} · Rp{o.nominal.toLocaleString('id-ID')}</div>
            </div>
            {isAdmin && <button className="secondary" onClick={() => lunasi(o.id)}>Tandai Lunas</button>}
          </div>
        </div>
      ))}

      {isAdmin && (
        <>
          <h2>Catat Transaksi</h2>
          <form className="card" onSubmit={tambahTransaksi}>
            <label>Jenis</label>
            <select value={form.jenis} onChange={(e) => setForm({ ...form, jenis: e.target.value })}>
              <option value="pengeluaran">Pengeluaran</option>
              <option value="pemasukan">Pemasukan</option>
            </select>
            <label>Kategori</label>
            <select value={form.kategori} onChange={(e) => setForm({ ...form, kategori: e.target.value })}>
              <option value="bola">Bola/shuttle</option>
              <option value="lapangan">Lapangan</option>
              <option value="iuran_member">Iuran member</option>
              <option value="iuran_harian">Iuran harian</option>
              <option value="lain_lain">Lain-lain</option>
            </select>
            <label>Nominal (Rp)</label>
            <input type="number" required value={form.nominal} onChange={(e) => setForm({ ...form, nominal: e.target.value })} />
            <label>Keterangan</label>
            <input value={form.keterangan} onChange={(e) => setForm({ ...form, keterangan: e.target.value })} />
            {msg && <p className="error">{msg}</p>}
            <div className="form-actions">
              <button type="submit">Simpan</button>
            </div>
          </form>
        </>
      )}

      <h2>Riwayat Transaksi</h2>
      <table>
        <thead>
          <tr><th>Tanggal</th><th>Jenis</th><th>Kategori</th><th>Nominal</th><th>Keterangan</th></tr>
        </thead>
        <tbody>
          {transaksi.map((t) => (
            <tr key={t.id}>
              <td>{new Date(t.tanggal).toLocaleDateString('id-ID')}</td>
              <td>{t.jenis}</td>
              <td>{t.kategori || '-'}</td>
              <td style={{ color: t.jenis === 'pemasukan' ? '#9ed6b0' : '#e8988c' }}>
                {t.jenis === 'pemasukan' ? '+' : '-'}Rp{t.nominal.toLocaleString('id-ID')}
              </td>
              <td>{t.keterangan || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
