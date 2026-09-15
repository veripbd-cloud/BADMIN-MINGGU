import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { supabase } from '../../lib/supabaseClient';
import { useAuth, getAccessToken } from '../../lib/useAuth';
import TopBar from '../../components/TopBar';

const NAMA_BULAN = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

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
  const [memberBulananForm, setMemberBulananForm] = useState({ bulan: new Date().getMonth() + 1, tahun: new Date().getFullYear(), label: '' });
  const [sesiMemberList, setSesiMemberList] = useState([]);

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

    const { data: smb } = await supabase
      .from('sesi_member_bulanan')
      .select('*')
      .order('tahun', { ascending: false })
      .order('bulan', { ascending: false })
      .limit(6);
    setSesiMemberList(smb || []);
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
    // Deadline batal = H-1 (sehari sebelum sesi) jam 23:59 WIB — sesuai pengaturan
    // deadline_batal_hari/deadline_batal_jam. Dihitung pakai UTC math + offset eksplisit
    // +07:00 (BUKAN setDate/setHours) biar gak gantung timezone device admin sama sekali.
    const [y, m, d] = sesiForm.tanggal.split('-').map(Number);
    const tanggalMinus1 = new Date(Date.UTC(y, m - 1, d));
    tanggalMinus1.setUTCDate(tanggalMinus1.getUTCDate() - 1);
    const yyyy = tanggalMinus1.getUTCFullYear();
    const mm = String(tanggalMinus1.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(tanggalMinus1.getUTCDate()).padStart(2, '0');
    const deadline = new Date(`${yyyy}-${mm}-${dd}T23:59:00+07:00`);

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

  async function bukaSesiMember(e) {
    e.preventDefault();
    setMsg('');
    const token = await getAccessToken();
    const res = await fetch('/api/admin/buka-sesi-member', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(memberBulananForm),
    });
    const json = await res.json();
    if (!res.ok) { setMsg(json.error); return; }
    setMsg('Sesi konfirmasi member bulanan dibuka.');
    load();
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
          Sesi main jam 07:00–10:00 di tanggal ini. Deadline batal otomatis: H-1 (sehari sebelumnya)
          jam 23:59 WIB (setelah itu batal harus lewat admin). Sesi otomatis dianggap selesai begitu
          lewat jam 10:00.
        </p>
        <div className="form-actions"><button type="submit">Buat Sesi</button></div>
      </form>

      <h2>Konfirmasi Member Bulanan</h2>
      <p className="subtle" style={{ fontSize: 11 }}>
        Buka sekali tiap bulan buat konfirmasi siapa aja yang lanjut/mau jadi member. Deadline daftar
        otomatis: 2 hari sejak dibuka, jam 23:59 WIB. Member yang gak daftar sampai deadline otomatis
        diturunkan jadi harian. Harian yang daftar & bayar lunas otomatis naik jadi member.
      </p>
      <form className="card" onSubmit={bukaSesiMember}>
        <label>Bulan (1-12)</label>
        <input type="number" min="1" max="12" value={memberBulananForm.bulan} onChange={(e) => setMemberBulananForm({ ...memberBulananForm, bulan: e.target.value })} />
        <label>Tahun</label>
        <input type="number" value={memberBulananForm.tahun} onChange={(e) => setMemberBulananForm({ ...memberBulananForm, tahun: e.target.value })} />
        <label>Label (opsional)</label>
        <input placeholder="misal: Oktober 2026" value={memberBulananForm.label} onChange={(e) => setMemberBulananForm({ ...memberBulananForm, label: e.target.value })} />
        <div className="form-actions"><button type="submit">Buka Sesi</button></div>
      </form>

      {sesiMemberList.length > 0 && (
        <div className="card">
          <p className="subtle" style={{ fontSize: 11, margin: '0 0 8px' }}>Sesi terakhir:</p>
          {sesiMemberList.map((s) => (
            <div key={s.id} style={{ fontSize: 13, marginBottom: 6 }}>
              <Link href={`/member-bulanan/${s.id}`} style={{ textDecoration: 'underline' }}>
                {s.label || `${NAMA_BULAN[s.bulan]} ${s.tahun}`}
              </Link>
              <span className="subtle" style={{ fontSize: 11 }}> — deadline {new Date(s.deadline_daftar).toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta' })}</span>
            </div>
          ))}
        </div>
      )}

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
        Jalankan di akhir bulan setelah biaya bola sudah dibeli & dicatat. Subsidi cuma dihitung di
        bulan TERAKHIR tiap kuartal tetap (Desember, Maret, Juni, September) — eligible kalau member
        itu "terdaftar" di Konfirmasi Member Bulanan buat KETIGA bulan di kuartal itu tanpa putus.
        Tier-nya (50% / gratis) dihitung dari sisa kas setelah dipotong bola & lapangan.
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
