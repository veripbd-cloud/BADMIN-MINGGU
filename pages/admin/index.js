import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';
import { useAuth, getAccessToken } from '../../lib/useAuth';
import TopBar from '../../components/TopBar';

function formatRibuan(v) {
  const angka = String(v || '').replace(/\D/g, '');
  if (!angka) return '';
  return parseInt(angka, 10).toLocaleString('id-ID');
}

function parseRibuan(str) {
  return String(str || '').replace(/\D/g, '');
}

export default function AdminPage() {
  const router = useRouter();
  const { profile, loading } = useAuth();
  const [pengaturan, setPengaturan] = useState({});
  const [pending, setPending] = useState([]);
  const [msg, setMsg] = useState('');
  const [sesiForm, setSesiForm] = useState({ tanggal: '', label: '' });
  const [subsidiForm, setSubsidiForm] = useState({ bulan: new Date().getMonth() + 1, tahun: new Date().getFullYear(), biaya_bola: '' });
  const [hasilSubsidi, setHasilSubsidi] = useState(null);

  const isAdmin = profile && (profile.role === 'admin' || profile.role === 'super_admin');

  useEffect(() => {
    if (!loading && profile && !isAdmin) router.push('/');
  }, [loading, profile]);

  async function load() {
    const res = await fetch('/api/admin/pengaturan');
    const json = await res.json();
    setPengaturan(json.data || {});

    const { data: pendingData } = await supabase.from('profiles').select('*').eq('status_approval', 'pending');
    setPending(pendingData || []);
  }

  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

  async function simpanPengaturan(e) {
    e.preventDefault();
    const token = await getAccessToken();
    await fetch('/api/admin/pengaturan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(pengaturan),
    });
    setMsg('Pengaturan tersimpan.');
  }

  async function approveLevel(player_id, level_final) {
    setMsg('');
    const token = await getAccessToken();
    const res = await fetch('/api/admin/approve-level', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ player_id, level_final }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setMsg(`Gagal approve: ${json.error || 'terjadi kesalahan, coba lagi.'}`);
      return;
    }
    setMsg(`Berhasil di-approve sebagai level ${level_final}.`);
    load();
  }

  async function buatSesi(e) {
    e.preventDefault();
    setMsg('');
    // Deadline batal = Sabtu 23:59 sebelum tanggal sesi (sesuai pengaturan default)
    // Deadline batal = persis jam 00:00 di tanggal sesi itu sendiri.
    // Setelah lewat tengah malam menuju hari sesi, batal otomatis tidak bisa lagi
    // (hanya admin yang bisa ubah manual lewat Supabase kalau perlu).
    const tanggalSesi = new Date(sesiForm.tanggal + 'T00:00:00+07:00');
    const deadline = new Date(tanggalSesi);

    const token = await getAccessToken();
    const res = await fetch('/api/admin/buat-sesi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        tanggal: sesiForm.tanggal,
        label: sesiForm.label,
        kuota_total: pengaturan.kuota_total,
        kuota_member: pengaturan.kuota_member,
        kuota_harian: pengaturan.kuota_harian,
        deadline_batal: deadline.toISOString(),
      }),
    });
    const json = await res.json();
    if (!res.ok) { setMsg(json.error); return; }
    setMsg('Sesi baru dibuat.');
    setSesiForm({ tanggal: '', label: '' });
  }

  async function prosesSubsidi(e) {
    e.preventDefault();
    const token = await getAccessToken();
    const res = await fetch('/api/admin/proses-tagihan-bulanan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(subsidiForm),
    });
    const json = await res.json();
    setHasilSubsidi(json);
  }

  if (loading || !isAdmin) return null;

  return (
    <div className="wrap">
      <TopBar profile={profile} />
      <h1>Admin</h1>
      {msg && <p className="success">{msg}</p>}

      <h2>Pengaturan Harga & Kuota</h2>
      <form className="card" onSubmit={simpanPengaturan}>
        <label>Harga harian (Rp)</label>
        <input
          value={formatRibuan(pengaturan.harga_harian)}
          onChange={(e) => setPengaturan({ ...pengaturan, harga_harian: parseRibuan(e.target.value) })}
        />
        <label>Harga member bulanan (Rp)</label>
        <input
          value={formatRibuan(pengaturan.harga_member_bulanan)}
          onChange={(e) => setPengaturan({ ...pengaturan, harga_member_bulanan: parseRibuan(e.target.value) })}
        />
        <label>Kuota member per sesi</label>
        <input value={pengaturan.kuota_member || ''} onChange={(e) => setPengaturan({ ...pengaturan, kuota_member: e.target.value })} />
        <label>Kuota harian per sesi</label>
        <input value={pengaturan.kuota_harian || ''} onChange={(e) => setPengaturan({ ...pengaturan, kuota_harian: e.target.value })} />
        <label>Kuota total per sesi</label>
        <input value={pengaturan.kuota_total || ''} onChange={(e) => setPengaturan({ ...pengaturan, kuota_total: e.target.value })} />
        <label>Kuota guest per sesi (pemain dadakan tanpa akun)</label>
        <input value={pengaturan.kuota_guest || ''} onChange={(e) => setPengaturan({ ...pengaturan, kuota_guest: e.target.value })} />
        <label>Biaya lapangan per bulan (Rp)</label>
        <input
          value={formatRibuan(pengaturan.biaya_lapangan_bulanan)}
          onChange={(e) => setPengaturan({ ...pengaturan, biaya_lapangan_bulanan: parseRibuan(e.target.value) })}
        />
        <div className="form-actions"><button type="submit">Simpan Pengaturan</button></div>
      </form>

      <h2>Buat Sesi Baru</h2>
      <form className="card" onSubmit={buatSesi}>
        <label>Tanggal sesi</label>
        <input type="date" required value={sesiForm.tanggal} onChange={(e) => setSesiForm({ ...sesiForm, tanggal: e.target.value })} />
        <label>Label (opsional)</label>
        <input placeholder="misal: Week 5 - 12 September 2026" value={sesiForm.label} onChange={(e) => setSesiForm({ ...sesiForm, label: e.target.value })} />
        <p className="subtle" style={{ fontSize: 11 }}>
          Sesi main jam 07:00–10:00 di tanggal ini. Deadline batal otomatis: tepat jam 00:00 di tanggal sesi
          (setelah itu batal harus lewat admin). Sesi otomatis dianggap selesai begitu lewat jam 10:00.
        </p>
        <div className="form-actions"><button type="submit">Buat Sesi</button></div>
      </form>

      <h2>Pending Approval ({pending.length})</h2>
      <p className="subtle" style={{ fontSize: 11 }}>Akun baru gak bisa daftar sesi sampai di-approve di sini. Pilih level final buat langsung meng-approve.</p>
      {pending.length === 0 && <div className="empty">Tidak ada yang menunggu review.</div>}
      {pending.map((p) => (
        <div className="card" key={p.id}>
          <div className="card-row">
            <div>
              <strong>{p.nama}</strong> <span className="badge">{p.tipe}</span>
              <div className="subtle" style={{ fontSize: 11, marginTop: 4 }}>
                Level usulan: <strong>{p.level_self || '-'}</strong> · Daftar: {new Date(p.tanggal_daftar).toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta' })}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button className="secondary" onClick={() => approveLevel(p.id, 'A1')}>A1</button>
              <button className="secondary" onClick={() => approveLevel(p.id, 'A2')}>A2</button>
              <button className="secondary" onClick={() => approveLevel(p.id, 'B1')}>B1</button>
              <button className="secondary" onClick={() => approveLevel(p.id, 'B2')}>B2</button>
              <button className="secondary" onClick={() => approveLevel(p.id, 'C')}>C</button>
            </div>
          </div>
        </div>
      ))}

      <h2>Proses Tagihan & Subsidi Bulanan</h2>
      <p className="subtle">
        Jalankan di akhir bulan setelah biaya bola sudah dibeli & dicatat. Sistem otomatis hitung
        member mana yang eligible subsidi (3 bulan berturut lunas) dan tier-nya (50% / gratis),
        berdasarkan sisa kas setelah dipotong bola & lapangan.
      </p>
      <form className="card" onSubmit={prosesSubsidi}>
        <label>Bulan (1-12)</label>
        <input type="number" min="1" max="12" value={subsidiForm.bulan} onChange={(e) => setSubsidiForm({ ...subsidiForm, bulan: e.target.value })} />
        <label>Tahun</label>
        <input type="number" value={subsidiForm.tahun} onChange={(e) => setSubsidiForm({ ...subsidiForm, tahun: e.target.value })} />
        <label>Biaya bola bulan ini (Rp)</label>
        <input
          value={formatRibuan(subsidiForm.biaya_bola)}
          onChange={(e) => setSubsidiForm({ ...subsidiForm, biaya_bola: parseRibuan(e.target.value) })}
        />
        <div className="form-actions"><button type="submit">Proses</button></div>
      </form>

      {hasilSubsidi && (
        <div className="card">
          <p>Tier untuk member eligible: <strong>{hasilSubsidi.tier_untuk_eligible || '-'}</strong></p>
          <p>Jumlah eligible: {hasilSubsidi.jumlah_eligible} · Tidak eligible: {hasilSubsidi.jumlah_tidak_eligible}</p>
          <p>Sisa kas terhitung: Rp{hasilSubsidi.sisa_kas_dihitung?.toLocaleString('id-ID')}</p>
        </div>
      )}
    </div>
  );
}
