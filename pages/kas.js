import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth, getAccessToken } from '../lib/useAuth';
import TopBar from '../components/TopBar';

function formatRibuan(v) {
  const angka = String(v || '').replace(/\D/g, '');
  if (!angka) return '';
  return parseInt(angka, 10).toLocaleString('id-ID');
}
function parseRibuan(str) {
  return String(str || '').replace(/\D/g, '');
}

export default function Kas() {
  const { profile, loading } = useAuth();
  const [transaksi, setTransaksi] = useState([]);
  const [outstanding, setOutstanding] = useState([]);
  const [profilesMap, setProfilesMap] = useState({});
  const [form, setForm] = useState({ jenis: 'pengeluaran', kategori: 'bola', nominal: '', keterangan: '' });
  const [msg, setMsg] = useState('');
  const [processingId, setProcessingId] = useState(null);
  const [stokLog, setStokLog] = useState([]);
  const [stokForm, setStokForm] = useState({ arah: 'tambah', slop: '', piece: '' });
  const [showSemuaTransaksi, setShowSemuaTransaksi] = useState(false);
  const [showSemuaStok, setShowSemuaStok] = useState(false);

  const isAdmin = profile && (profile.role === 'admin' || profile.role === 'super_admin');

  async function load() {
    const { data: t } = await supabase.from('transaksi_kas').select('*').order('tanggal', { ascending: false }).order('created_at', { ascending: false }).limit(50);
    setTransaksi(t || []);

    const { data: o } = await supabase.from('outstanding').select('*').eq('status', 'belum_lunas');
    setOutstanding(o || []);

    const idsOutstanding = (o || []).map((x) => x.player_id);
    const idsTransaksi = (t || []).map((x) => x.player_id).filter(Boolean);
    const ids = [...new Set([...idsOutstanding, ...idsTransaksi])];
    if (ids.length) {
      const { data: p } = await supabase.from('profiles').select('id, nama').in('id', ids);
      const map = {};
      (p || []).forEach((pr) => { map[pr.id] = pr.nama; });
      setProfilesMap(map);
    }

    const { data: stokData } = await supabase
      .from('stok_shuttle_log')
      .select('*')
      .order('waktu', { ascending: false })
      .limit(50);
    setStokLog(stokData || []);
  }

  useEffect(() => { if (!loading) load(); }, [loading]);

  if (loading) return null;

  const bolehLihatKas = profile && (profile.tipe === 'member' || isAdmin);
  if (!bolehLihatKas) {
    return (
      <div className="wrap">
        <TopBar profile={profile} />
        <h1>Kas</h1>
        <div className="empty">Halaman ini cuma buat member.</div>
      </div>
    );
  }

  const saldo = transaksi.reduce((sum, t) => sum + (t.jenis === 'pemasukan' ? t.nominal : -t.nominal), 0);
  const totalOutstanding = outstanding.reduce((sum, o) => sum + o.nominal, 0);
  const stokPiece = stokLog.length > 0 ? stokLog[0].saldo_setelah : 0;
  const stokSlop = Math.floor(stokPiece / 12);
  const stokSisaPiece = stokPiece % 12;

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
    if (processingId) return;
    setProcessingId(outstanding_id);
    setMsg('');
    const token = await getAccessToken();
    try {
      const res = await fetch('/api/admin/lunasi-outstanding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ outstanding_id }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setMsg(`Gagal tandai lunas: ${json.error || 'terjadi kesalahan, coba lagi.'}`);
        return;
      }
      await load();
    } finally {
      setProcessingId(null);
    }
  }

  async function updateStok(e) {
    e.preventDefault();
    setMsg('');
    const token = await getAccessToken();
    const res = await fetch('/api/admin/stok-shuttle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(stokForm),
    });
    const json = await res.json();
    if (!res.ok) { setMsg(json.error); return; }
    setStokForm({ arah: 'tambah', slop: '', piece: '' });
    load();
  }

  return (
    <div className="wrap">
      <TopBar profile={profile} />
      <h1>Kas</h1>
      {msg && <p className="error">{msg}</p>}

      <div className="stat">
        <div className="item">
          <span className="label">Saldo kas saat ini</span>
          <span className="num">Rp{saldo.toLocaleString('id-ID')}</span>
        </div>
        <div className="item">
          <span className="label">Total outstanding</span>
          <span className="num">Rp{totalOutstanding.toLocaleString('id-ID')}</span>
        </div>
      </div>

      <h2>Outstanding — Belum Bayar</h2>
      {outstanding.length === 0 && <div className="empty">Tidak ada outstanding. 🎉</div>}
      {outstanding.map((o) => (
        <div className="card outstanding-item" key={o.id}>
          <div className="card-row">
            <div>
              <strong>{profilesMap[o.player_id] || '—'}</strong>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>{o.keterangan} · Rp{o.nominal.toLocaleString('id-ID')}</div>
            </div>
            {isAdmin && (
              <button
                className="secondary"
                disabled={processingId === o.id}
                onClick={() => lunasi(o.id)}
              >
                {processingId === o.id ? 'Memproses...' : 'Tandai Lunas'}
              </button>
            )}
          </div>
        </div>
      ))}

      <h2>Stock Shuttlecock</h2>
      <div className="card">
        <div className="card-row" style={{ marginBottom: isAdmin ? 14 : 0 }}>
          <span>Sisa stok saat ini</span>
          <strong>{stokSlop} slop {stokSisaPiece} piece <span className="subtle" style={{ fontWeight: 400, fontSize: 11 }}>({stokPiece} piece total)</span></strong>
        </div>

        {isAdmin && (
          <form onSubmit={updateStok}>
            <label>Arah</label>
            <select value={stokForm.arah} onChange={(e) => setStokForm({ ...stokForm, arah: e.target.value })}>
              <option value="tambah">Tambah stok (beli baru)</option>
              <option value="kurangi">Kurangi stok (terpakai main)</option>
            </select>
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <label>Slop (1 slop = 12 piece)</label>
                <input type="number" min="0" value={stokForm.slop} onChange={(e) => setStokForm({ ...stokForm, slop: e.target.value })} />
              </div>
              <div style={{ flex: 1 }}>
                <label>Piece (satuan)</label>
                <input type="number" min="0" value={stokForm.piece} onChange={(e) => setStokForm({ ...stokForm, piece: e.target.value })} />
              </div>
            </div>
            <div className="form-actions">
              <button type="submit">Update Stok</button>
            </div>
          </form>
        )}
      </div>

      {stokLog.length > 0 && (
        <>
          <table style={{ marginBottom: 8 }}>
            <thead>
              <tr><th>Waktu</th><th>Arah</th><th>Jumlah</th><th>Saldo Setelah</th></tr>
            </thead>
            <tbody>
              {(showSemuaStok ? stokLog : stokLog.slice(0, 5)).map((s) => (
                <tr key={s.id}>
                  <td>{new Date(s.waktu).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}</td>
                  <td style={{ color: s.arah === 'tambah' ? '#9ed6b0' : '#e8988c' }}>{s.arah}</td>
                  <td>{s.arah === 'tambah' ? '+' : '-'}{Math.abs(s.delta_piece)} piece ({s.slop} slop {s.piece} piece)</td>
                  <td>{Math.floor(s.saldo_setelah / 12)} slop {s.saldo_setelah % 12} piece</td>
                </tr>
              ))}
            </tbody>
          </table>
          {stokLog.length > 5 && (
            <button className="secondary" style={{ marginBottom: 20 }} onClick={() => setShowSemuaStok(!showSemuaStok)}>
              {showSemuaStok ? 'Tampilkan 5 Terbaru' : `Lihat Semua (${stokLog.length})`}
            </button>
          )}
        </>
      )}

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
            <input
              value={formatRibuan(form.nominal)}
              onChange={(e) => setForm({ ...form, nominal: parseRibuan(e.target.value) })}
            />
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
          <tr><th>Tanggal</th><th>Jenis</th><th>Kategori</th><th>Nominal</th><th>Pemain</th><th>Keterangan</th></tr>
        </thead>
        <tbody>
          {(showSemuaTransaksi ? transaksi : transaksi.slice(0, 5)).map((t) => (
            <tr key={t.id}>
              <td>{new Date(t.tanggal).toLocaleDateString('id-ID')}</td>
              <td>{t.jenis}</td>
              <td>{t.kategori || '-'}</td>
              <td style={{ color: t.jenis === 'pemasukan' ? '#9ed6b0' : '#e8988c' }}>
                {t.jenis === 'pemasukan' ? '+' : '-'}Rp{t.nominal.toLocaleString('id-ID')}
              </td>
              <td>{t.player_id ? (profilesMap[t.player_id] || '-') : '-'}</td>
              <td>{t.keterangan || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {transaksi.length > 5 && (
        <button className="secondary" style={{ marginTop: 8 }} onClick={() => setShowSemuaTransaksi(!showSemuaTransaksi)}>
          {showSemuaTransaksi ? 'Tampilkan 5 Terbaru' : `Lihat Semua (${transaksi.length})`}
        </button>
      )}
    </div>
  );
}
