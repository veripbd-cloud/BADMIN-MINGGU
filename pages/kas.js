import { useEffect, useState, Fragment } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth, getAccessToken } from '../lib/useAuth';
import TopBar from '../components/TopBar';
import Memuat from '../components/Memuat';
import { tampilToast } from '../components/Toast';

function formatRibuan(v) {
  const angka = String(v || '').replace(/\D/g, '');
  if (!angka) return '';
  return parseInt(angka, 10).toLocaleString('id-ID');
}
function parseRibuan(str) {
  return String(str || '').replace(/\D/g, '');
}

function formatHari(tanggal) {
  return new Date(tanggal + 'T00:00:00+07:00').toLocaleDateString('id-ID', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta',
  });
}

export default function Kas() {
  const { profile, loading } = useAuth();
  const [transaksi, setTransaksi] = useState([]); // baris yang sudah dimuat, terbaru dulu
  const [saldo, setSaldo] = useState(0);
  const [totalTransaksi, setTotalTransaksi] = useState(0);
  const [adaLagi, setAdaLagi] = useState(false);
  const [infoHari, setInfoHari] = useState({});
  const [memuatLagi, setMemuatLagi] = useState(false);
  const [outstanding, setOutstanding] = useState([]);
  const [profilesMap, setProfilesMap] = useState({});
  const [form, setForm] = useState({ jenis: 'pengeluaran', kategori: 'bola', nominal: '', keterangan: '' });
  const [msg, setMsg] = useState('');
  const [processingId, setProcessingId] = useState(null);
  const [stokLog, setStokLog] = useState([]);
  const [stokForm, setStokForm] = useState({ arah: 'tambah', slop: '', piece: '' });
  const [showSemuaStok, setShowSemuaStok] = useState(false);
  const [bukaOutstanding, setBukaOutstanding] = useState(false);

  const isAdmin = profile && (profile.role === 'admin' || profile.role === 'super_admin');

  // Saldo dan riwayat dihitung di SERVER dari seluruh transaksi; halaman hanya menampilkan 30 baris per muat.
  async function muatTransaksi(offset) {
    const token = await getAccessToken();
    const res = await fetch(`/api/kas?offset=${offset}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { setMsg(json.error || `Gagal memuat kas (kode ${res.status})`); return; }
    setSaldo(json.saldo);
    setTotalTransaksi(json.total);
    setAdaLagi(json.ada_lagi);
    setInfoHari((lama) => (offset === 0 ? json.hari : { ...lama, ...json.hari }));
    setTransaksi((lama) => (offset === 0 ? json.transaksi : [...lama, ...json.transaksi]));
  }

  async function muatLebih() {
    setMemuatLagi(true);
    await muatTransaksi(transaksi.length);
    setMemuatLagi(false);
  }

  async function load() {
    await muatTransaksi(0);

    const { data: o } = await supabase.from('outstanding').select('*').eq('status', 'belum_lunas');
    setOutstanding(o || []);

    const ids = [...new Set((o || []).map((x) => x.player_id).filter(Boolean))];
    if (ids.length) {
      const { data: p } = await supabase.from('profiles').select('id, nama').in('id', ids);
      const map = {};
      (p || []).forEach((pr) => { map[pr.id] = pr.nama; });
      setProfilesMap(map);
    }

    // Stok shuttlecock aman dari isu yang sama -- tiap baris nyimpen saldo_setelah
    // sendiri (dihitung server-side pas insert), jadi gak bergantung sama client
    // nge-jumlahin dari daftar yang dibatasi. Tapi .limit() tetep dibuang biar konsisten.
    const { data: stokData } = await supabase
      .from('stok_shuttle_log')
      .select('*')
      .order('waktu', { ascending: false });
    setStokLog(stokData || []);
  }

  useEffect(() => { if (!loading) load(); }, [loading]);

  if (loading) return <Memuat />;

  const bolehLihatKas = profile && (profile.tipe === 'member' || isAdmin);
  if (!bolehLihatKas) {
    return (
      <div className="wrap">
        <TopBar profile={profile} />
        <h1>Kas & Shuttlecock</h1>
        <div className="empty">Halaman ini cuma buat member.</div>
      </div>
    );
  }

  const totalOutstanding = outstanding.reduce((sum, o) => sum + o.nominal, 0);

  // Kelompokkan baris per hari (urutan: terbaru dulu)
  const kelompokHari = [];
  transaksi.forEach((t) => {
    const terakhir = kelompokHari[kelompokHari.length - 1];
    if (terakhir && terakhir.tanggal === t.tanggal) terakhir.baris.push(t);
    else kelompokHari.push({ tanggal: t.tanggal, baris: [t] });
  });
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
    tampilToast('Transaksi tersimpan ✓');
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
      tampilToast('Ditandai lunas ✓');
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
    tampilToast('Stok diperbarui ✓');
    load();
  }

  return (
    <div className="wrap">
      <TopBar profile={profile} />
      <h1>Kas & Shuttlecock</h1>
      {msg && <p className="error">{msg}</p>}

      <div style={{ display: 'flex', gap: 40, flexWrap: 'wrap', marginBottom: 8 }}>
        <div>
          <h2 style={{ margin: '0 0 8px' }}>Kas</h2>
          <div className="stat">
            <div className="item">
              <span className="label">Saldo kas saat ini</span>
              <span className="num">Rp{saldo.toLocaleString('id-ID')}</span>
            </div>
          </div>
        </div>
        <div>
          <h2 style={{ margin: '0 0 8px' }}>Shuttlecock</h2>
          <div className="stat">
            <div className="item">
              <span className="label">Sisa stok saat ini</span>
              <span className="num">{stokSlop} slop {stokSisaPiece} piece</span>
              <span className="subtle" style={{ fontSize: 11 }}>({stokPiece} piece total)</span>
            </div>
          </div>
        </div>
      </div>

      <div className="stat" style={{ marginTop: 16 }}>
        <div className="item">
          <span className="label">Total outstanding</span>
          <span className="num">Rp{totalOutstanding.toLocaleString('id-ID')}</span>
        </div>
      </div>

      <div
        onClick={() => setBukaOutstanding(!bukaOutstanding)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none', margin: '28px 0 10px' }}
      >
        <h2 style={{ margin: 0 }}>Outstanding — Belum Bayar{outstanding.length > 0 ? ` (${outstanding.length})` : ''}</h2>
        <span style={{ fontSize: 12, lineHeight: 1 }}>{bukaOutstanding ? '▲' : '▼'}</span>
        {outstanding.length === 0 && <span className="subtle" style={{ fontSize: 11 }}>Tidak ada outstanding. 🎉</span>}
      </div>
      {bukaOutstanding && outstanding.map((o) => (
        <div className="card outstanding-item" key={o.id}>
          <div className="card-row">
            <div>
              <strong>{profilesMap[o.player_id] || o.nama_guest || '—'}</strong>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>{o.keterangan} · Rp{o.nominal.toLocaleString('id-ID')}</div>
            </div>
            {isAdmin && (
              <button className="secondary" disabled={processingId === o.id} onClick={() => lunasi(o.id)}>
                {processingId === o.id ? 'Memproses...' : 'Tandai Lunas'}
              </button>
            )}
          </div>
        </div>
      ))}

      <h2>Update Stok Shuttlecock</h2>
      <div className="card">
        {isAdmin && (
          <form onSubmit={updateStok}>
            <label style={{ marginTop: 0 }}>Arah</label>
            <select value={stokForm.arah} onChange={(e) => setStokForm({ ...stokForm, arah: e.target.value })}>
              <option value="tambah">Tambah stok (beli baru)</option>
              <option value="set_sisa">Set sisa stok (hitung real, sistem yang hitung terpakai)</option>
            </select>
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <label>{stokForm.arah === 'set_sisa' ? 'Sisa sekarang — Slop' : 'Slop yang dibeli (1 slop = 12 piece)'}</label>
                <input type="number" min="0" value={stokForm.slop} onChange={(e) => setStokForm({ ...stokForm, slop: e.target.value })} />
              </div>
              <div style={{ flex: 1 }}>
                <label>{stokForm.arah === 'set_sisa' ? 'Sisa sekarang — Piece' : 'Piece yang dibeli'}</label>
                <input type="number" min="0" value={stokForm.piece} onChange={(e) => setStokForm({ ...stokForm, piece: e.target.value })} />
              </div>
            </div>
            {stokForm.arah === 'set_sisa' && (
              <p className="subtle" style={{ fontSize: 11, marginTop: 6 }}>
                Isi TOTAL sisa yang beneran ada sekarang (hasil hitung fisik), bukan berapa yang kepake.
                Sistem otomatis hitung selisihnya sebagai "terpakai".
              </p>
            )}
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
              <tr><th>Tanggal</th><th>Arah</th><th>Jumlah</th><th>Saldo Setelah</th></tr>
            </thead>
            <tbody>
              {(showSemuaStok ? stokLog : stokLog.slice(0, 5)).map((s) => (
                <tr key={s.id}>
                  <td>{new Date(s.waktu).toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta' })}</td>
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
            <label style={{ marginTop: 0 }}>Jenis</label>
            <select value={form.jenis} onChange={(e) => setForm({ ...form, jenis: e.target.value })}>
              <option value="pengeluaran">Kredit (pengeluaran)</option>
              <option value="pemasukan">Debit (pemasukan)</option>
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
            <input value={formatRibuan(form.nominal)} onChange={(e) => setForm({ ...form, nominal: parseRibuan(e.target.value) })} />
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
      <div style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr><th>Jenis</th><th>Nominal</th><th>Pemain</th><th>Keterangan</th><th>Saldo setelah</th></tr>
          </thead>
          <tbody>
            {kelompokHari.map((g) => (
              <Fragment key={g.tanggal}>
                <tr>
                  <td colSpan={5} style={{ color: 'var(--muted)', fontSize: 11, paddingTop: 16 }}>
                    <strong style={{ color: 'var(--line-white)' }}>{formatHari(g.tanggal)}</strong>
                    {infoHari[g.tanggal] && (
                      <> · saldo awal Rp{infoHari[g.tanggal].awal.toLocaleString('id-ID')} → akhir Rp{infoHari[g.tanggal].akhir.toLocaleString('id-ID')}</>
                    )}
                  </td>
                </tr>
                {g.baris.map((t) => (
                  <tr key={t.id}>
                    <td>{t.jenis === 'pemasukan' ? 'Debit' : 'Kredit'}</td>
                    <td style={{ color: t.jenis === 'pemasukan' ? '#9ed6b0' : '#e8988c' }}>
                      {t.jenis === 'pemasukan' ? '+' : '-'}Rp{t.nominal.toLocaleString('id-ID')}
                    </td>
                    <td>{t.pemain || '-'}</td>
                    <td>{t.keterangan || '-'}</td>
                    <td>Rp{t.saldo_setelah.toLocaleString('id-ID')}</td>
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      {adaLagi && (
        <button className="secondary" style={{ marginTop: 10 }} disabled={memuatLagi} onClick={muatLebih}>
          {memuatLagi ? 'Memuat...' : 'Muat 30 berikutnya'}
        </button>
      )}
      <p className="subtle" style={{ fontSize: 11, marginTop: 8 }}>
        Menampilkan {transaksi.length} dari {totalTransaksi} transaksi. Saldo dihitung dari semua transaksi.
      </p>
    </div>
  );
}
