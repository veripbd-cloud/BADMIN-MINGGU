import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { supabase } from '../../lib/supabaseClient';
import { useAuth, getAccessToken } from '../../lib/useAuth';
import TopBar from '../../components/TopBar';

const TEKS_SESI = 'Sesi main jam 07:00–10:00 di tanggal ini. Deadline batal otomatis: H-1 (sehari sebelumnya) jam 23:59 WIB (setelah itu batal harus lewat admin). Sesi otomatis dianggap selesai begitu lewat jam 10:00.';
const TEKS_MEMBER = 'Buka sekali tiap bulan buat konfirmasi siapa aja yang lanjut/mau jadi member. Deadline daftar otomatis: 2 hari sejak dibuka, jam 23:59 WIB. Member yang gak daftar sampai deadline otomatis diturunkan jadi harian. Harian yang daftar & bayar lunas otomatis naik jadi member. Khusus bulan Des/Mar/Jun/Sep, sistem juga otomatis hitung subsidi 3-bulan begitu deadline lewat — pastiin "Biaya bola bulan ini" di Pengaturan udah diisi dulu sebelum buka sesi bulan itu.';

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
  const [pengaturanTerbuka, setPengaturanTerbuka] = useState(false);
  const [pending, setPending] = useState([]);
  const [pesan, setPesan] = useState({ teks: '', error: false });

  const [buatJenis, setBuatJenis] = useState('');
  const [buatForm, setBuatForm] = useState({ tanggal: '', bulanTahun: '', label: '' });

  const isAdmin = profile && (profile.role === 'admin' || profile.role === 'super_admin');

  function tampilPesan(teks, error = false) { setPesan({ teks, error }); }

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
    const res = await fetch('/api/admin/pengaturan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(pengaturan),
    });
    if (!res.ok) { tampilPesan('Gagal menyimpan pengaturan.', true); return; }
    try {
      localStorage.setItem('brand_badmin', JSON.stringify({
        bagian1: pengaturan.brand_bagian1 ?? 'BADMIN',
        bagian2: pengaturan.brand_bagian2 ?? 'MINGGU',
      }));
    } catch (err) { /* abaikan */ }
    tampilPesan('Pengaturan tersimpan. Nama brand di navbar ikut berubah setelah halaman di-refresh.');
  }

  async function approveLevel(player_id, level_final) {
    tampilPesan('');
    const token = await getAccessToken();
    const res = await fetch('/api/admin/approve-level', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ player_id, level_final }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      tampilPesan(`Gagal approve: ${json.error || 'terjadi kesalahan, coba lagi.'}`, true);
      return;
    }
    tampilPesan(`Berhasil di-approve sebagai ${level_final}.`);
    load();
  }

  async function submitBuat(e) {
    e.preventDefault();
    tampilPesan('');
    const token = await getAccessToken();
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

    if (buatJenis === 'sesi') {
      const [y, m, d] = buatForm.tanggal.split('-').map(Number);
      const tanggalMinus1 = new Date(Date.UTC(y, m - 1, d));
      tanggalMinus1.setUTCDate(tanggalMinus1.getUTCDate() - 1);
      const yyyy = tanggalMinus1.getUTCFullYear();
      const mm = String(tanggalMinus1.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(tanggalMinus1.getUTCDate()).padStart(2, '0');
      const deadline = new Date(`${yyyy}-${mm}-${dd}T23:59:00+07:00`);

      const res = await fetch('/api/admin/buat-sesi', {
        method: 'POST', headers,
        body: JSON.stringify({
          tanggal: buatForm.tanggal, label: buatForm.label,
          kuota_total: pengaturan.kuota_total, kuota_member: pengaturan.kuota_member, kuota_harian: pengaturan.kuota_harian,
          deadline_batal: deadline.toISOString(),
        }),
      });
      const json = await res.json();
      if (!res.ok) { tampilPesan(json.error, true); return; }
      tampilPesan('Sesi baru dibuat.');
    } else if (buatJenis === 'member') {
      const [tahun, bulan] = buatForm.bulanTahun.split('-').map(Number);
      const res = await fetch('/api/admin/buka-sesi-member', {
        method: 'POST', headers,
        body: JSON.stringify({ bulan, tahun, label: buatForm.label }),
      });
      const json = await res.json();
      if (!res.ok) { tampilPesan(json.error, true); return; }
      tampilPesan('Sesi konfirmasi member bulanan dibuka.');
    }

    setBuatForm({ tanggal: '', bulanTahun: '', label: '' });
    load();
  }

  if (loading || !isAdmin) return null;

  return (
    <div className="wrap">
      <TopBar profile={profile} />
      <h1>Admin</h1>
      {pesan.teks && <p className={pesan.error ? 'error' : 'success'}>{pesan.teks}</p>}

      <h2 style={{ marginTop: 20 }}>Pending Approval ({pending.length})</h2>
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
              <button className="secondary" onClick={() => approveLevel(p.id, 'Bisa Jump Smash')}>Bisa Jump Smash</button>
              <button className="secondary" onClick={() => approveLevel(p.id, 'Tidak Bisa Jump Smash')}>Tidak Bisa Jump Smash</button>
            </div>
          </div>
        </div>
      ))}

      <p className="subtle" style={{ margin: '24px 0 16px' }}>
        <Link href="/admin/users" style={{ textDecoration: 'underline' }}>Kelola User (nama, email, password, status, level)</Link>
      </p>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-row" style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => setPengaturanTerbuka(!pengaturanTerbuka)}>
          <strong>Pengaturan Harga, Kuota & Nama Brand</strong>
          <span style={{ fontSize: 12, lineHeight: 1 }}>{pengaturanTerbuka ? '▲' : '▼'}</span>
        </div>

        {pengaturanTerbuka && (
          <form onSubmit={simpanPengaturan} style={{ marginTop: 14 }}>
            <label style={{ marginTop: 0 }}>Nama brand — bagian putih</label>
            <input value={pengaturan.brand_bagian1 || ''} onChange={(e) => setPengaturan({ ...pengaturan, brand_bagian1: e.target.value })} />
            <label>Nama brand — bagian oranye</label>
            <input value={pengaturan.brand_bagian2 || ''} onChange={(e) => setPengaturan({ ...pengaturan, brand_bagian2: e.target.value })} />

            <label>Harga harian (Rp)</label>
            <input value={formatRibuan(pengaturan.harga_harian)} onChange={(e) => setPengaturan({ ...pengaturan, harga_harian: parseRibuan(e.target.value) })} />
            <label>Harga member bulanan (Rp)</label>
            <input value={formatRibuan(pengaturan.harga_member_bulanan)} onChange={(e) => setPengaturan({ ...pengaturan, harga_member_bulanan: parseRibuan(e.target.value) })} />
            <label>Kuota member per sesi</label>
            <input value={pengaturan.kuota_member || ''} onChange={(e) => setPengaturan({ ...pengaturan, kuota_member: e.target.value })} />
            <label>Kuota harian per sesi</label>
            <input value={pengaturan.kuota_harian || ''} onChange={(e) => setPengaturan({ ...pengaturan, kuota_harian: e.target.value })} />
            <label>Kuota total per sesi</label>
            <input value={pengaturan.kuota_total || ''} onChange={(e) => setPengaturan({ ...pengaturan, kuota_total: e.target.value })} />
            <label>Kuota guest per sesi (pemain dadakan tanpa akun)</label>
            <input value={pengaturan.kuota_guest || ''} onChange={(e) => setPengaturan({ ...pengaturan, kuota_guest: e.target.value })} />
            <label>Biaya lapangan per bulan (Rp)</label>
            <input value={formatRibuan(pengaturan.biaya_lapangan_bulanan)} onChange={(e) => setPengaturan({ ...pengaturan, biaya_lapangan_bulanan: parseRibuan(e.target.value) })} />
            <label>Biaya bola bulan ini (Rp) — isi sebelum buka sesi Des/Mar/Jun/Sep</label>
            <input value={formatRibuan(pengaturan.biaya_bola_bulan_ini)} onChange={(e) => setPengaturan({ ...pengaturan, biaya_bola_bulan_ini: parseRibuan(e.target.value) })} />
            <div className="form-actions"><button type="submit">Simpan Pengaturan</button></div>
          </form>
        )}
      </div>

      <h2>Buat Baru</h2>
      <form className="card" onSubmit={submitBuat}>
        <label style={{ marginTop: 0 }}>Jenis</label>
        <select value={buatJenis} onChange={(e) => setBuatJenis(e.target.value)} required>
          <option value="">Pilih jenis...</option>
          <option value="sesi">Buat Sesi Baru</option>
          <option value="member">Konfirmasi Member Bulanan</option>
        </select>

        {buatJenis === 'sesi' && (
          <>
            <label>Tanggal sesi</label>
            <input type="date" required value={buatForm.tanggal} onChange={(e) => setBuatForm({ ...buatForm, tanggal: e.target.value })} />
            <label>Label (opsional)</label>
            <input placeholder="misal: Week 5 - 12 September 2026" value={buatForm.label} onChange={(e) => setBuatForm({ ...buatForm, label: e.target.value })} />
            <p className="subtle" style={{ fontSize: 11, marginTop: 10, marginBottom: 0 }}>{TEKS_SESI}</p>
          </>
        )}

        {buatJenis === 'member' && (
          <>
            <label>Bulan</label>
            <input type="month" required value={buatForm.bulanTahun} onChange={(e) => setBuatForm({ ...buatForm, bulanTahun: e.target.value })} />
            <label>Label (opsional)</label>
            <input placeholder="misal: Oktober 2026" value={buatForm.label} onChange={(e) => setBuatForm({ ...buatForm, label: e.target.value })} />
            <p className="subtle" style={{ fontSize: 11, marginTop: 10, marginBottom: 0 }}>{TEKS_MEMBER}</p>
          </>
        )}

        {buatJenis && (
          <div className="form-actions">
            <button type="submit">{buatJenis === 'sesi' ? 'Buat Sesi' : 'Buka Sesi'}</button>
          </div>
        )}
      </form>
    </div>
  );
}
