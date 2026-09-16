import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../lib/supabaseClient';
import { useAuth, getAccessToken } from '../lib/useAuth';
import TopBar from '../components/TopBar';

const NAMA_BULAN = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const PER_HALAMAN = 5;

export default function Home() {
  const { profile, loading } = useAuth();

  // --- Sesi mingguan ---
  const [sesiList, setSesiList] = useState([]);
  const [pendaftaranSaya, setPendaftaranSaya] = useState({});
  const [jumlahTerisi, setJumlahTerisi] = useState({});
  const [busySesi, setBusySesi] = useState(null);
  const [msgSesi, setMsgSesi] = useState('');
  const [halamanSesi, setHalamanSesi] = useState(0);

  // --- Konfirmasi member bulanan ---
  const [memberList, setMemberList] = useState([]);
  const [pendaftaranMemberSaya, setPendaftaranMemberSaya] = useState({});
  const [busyMember, setBusyMember] = useState(null);
  const [msgMember, setMsgMember] = useState('');
  const [halamanMember, setHalamanMember] = useState(0);

  async function loadSesi() {
    const { data: sesi } = await supabase
      .from('sesi')
      .select('*')
      .order('tanggal', { ascending: false })
      .limit(50);
    setSesiList(sesi || []);

    if (profile) {
      const { data: pendaftaran } = await supabase
        .from('pendaftaran_sesi')
        .select('*')
        .eq('player_id', profile.id);
      const map = {};
      (pendaftaran || []).forEach((p) => {
        if (p.status_daftar !== 'batal') map[p.sesi_id] = p;
      });
      setPendaftaranSaya(map);

      const sesiIds = (sesi || []).map((s) => s.id);
      if (sesiIds.length && profile.tipe) {
        const { data: terdaftarSemua } = await supabase
          .from('pendaftaran_sesi')
          .select('sesi_id')
          .in('sesi_id', sesiIds)
          .eq('status_daftar', 'terdaftar')
          .eq('tipe_slot', profile.tipe);
        const countMap = {};
        (terdaftarSemua || []).forEach((row) => {
          countMap[row.sesi_id] = (countMap[row.sesi_id] || 0) + 1;
        });
        setJumlahTerisi(countMap);
      }
    }
  }

  async function loadMemberBulanan() {
    const { data: smb } = await supabase
      .from('sesi_member_bulanan')
      .select('*')
      .order('tahun', { ascending: false })
      .order('bulan', { ascending: false })
      .limit(24);
    setMemberList(smb || []);

    if (profile && smb && smb.length) {
      const { data: pendaftaran } = await supabase
        .from('pendaftaran_member_bulanan')
        .select('*')
        .eq('player_id', profile.id)
        .in('sesi_member_bulanan_id', smb.map((s) => s.id));
      const map = {};
      (pendaftaran || []).forEach((p) => {
        if (p.status_daftar !== 'batal') map[p.sesi_member_bulanan_id] = p;
      });
      setPendaftaranMemberSaya(map);
    }
  }

  useEffect(() => {
    if (!loading) { loadSesi(); loadMemberBulanan(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, profile]);

  async function daftarSesi(sesi_id) {
    setBusySesi(sesi_id);
    setMsgSesi('');
    const token = await getAccessToken();
    const res = await fetch('/api/daftar-sesi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ sesi_id }),
    });
    const json = await res.json();
    setBusySesi(null);
    if (!res.ok) { setMsgSesi(json.error); return; }
    await loadSesi();
  }

  async function batalSesi(pendaftaran_id) {
    setBusySesi(pendaftaran_id);
    setMsgSesi('');
    const token = await getAccessToken();
    const res = await fetch('/api/batal-sesi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ pendaftaran_id }),
    });
    const json = await res.json();
    setBusySesi(null);
    if (!res.ok) { setMsgSesi(json.error); return; }
    await loadSesi();
  }

  async function daftarMember(sesi_member_bulanan_id) {
    setBusyMember(sesi_member_bulanan_id);
    setMsgMember('');
    const token = await getAccessToken();
    const res = await fetch('/api/daftar-member-bulanan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ sesi_member_bulanan_id }),
    });
    const json = await res.json();
    setBusyMember(null);
    if (!res.ok) { setMsgMember(json.error); return; }
    await loadMemberBulanan();
  }

  async function batalMember(pendaftaran_id) {
    setBusyMember(pendaftaran_id);
    setMsgMember('');
    const token = await getAccessToken();
    const res = await fetch('/api/batal-member-bulanan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ pendaftaran_id }),
    });
    const json = await res.json();
    setBusyMember(null);
    if (!res.ok) { setMsgMember(json.error); return; }
    await loadMemberBulanan();
  }

  if (loading) return null;

  function sudahBerakhir(sesi) {
    const batasAkhir = new Date(sesi.tanggal + 'T10:00:00+07:00');
    return new Date() > batasAkhir;
  }

  const isAdminRole = profile && (profile.role === 'admin' || profile.role === 'super_admin');
  if (profile && profile.status_approval !== 'approved' && !isAdminRole) {
    return (
      <div className="wrap">
        <TopBar profile={profile} />
        <h1>Menunggu Persetujuan</h1>
        <div className="card">
          <p style={{ margin: 0 }}>
            Akun kamu (<strong>{profile.nama}</strong>) sudah terdaftar sebagai <strong>{profile.tipe === 'member' ? 'Member' : 'Harian'}</strong>,
            level usulan <strong>{profile.level_self || '-'}</strong>.
          </p>
          <p className="subtle" style={{ marginTop: 8, marginBottom: 0 }}>
            Menunggu admin verifikasi & tentukan level final sebelum bisa ikut daftar sesi main.
            Cek lagi halaman ini nanti.
          </p>
        </div>
      </div>
    );
  }

  const totalHalamanSesi = Math.max(1, Math.ceil(sesiList.length / PER_HALAMAN));
  const sesiTampil = sesiList.slice(halamanSesi * PER_HALAMAN, halamanSesi * PER_HALAMAN + PER_HALAMAN);

  const totalHalamanMember = Math.max(1, Math.ceil(memberList.length / PER_HALAMAN));
  const memberTampil = memberList.slice(halamanMember * PER_HALAMAN, halamanMember * PER_HALAMAN + PER_HALAMAN);

  return (
    <div className="wrap">
      <TopBar profile={profile} />
      <h1>Sesi Mingguan</h1>
      <p className="subtle">Main tiap minggu, jam 07:00–10:00. Daftar untuk ikut main, atau batal sebelum deadline.</p>

      {msgSesi && <p className="error">{msgSesi}</p>}

      {sesiList.length === 0 && <div className="empty">Belum ada sesi dibuat.</div>}

      {sesiTampil.map((sesi) => {
        const p = pendaftaranSaya[sesi.id];
        const lewatDeadline = new Date() > new Date(sesi.deadline_batal);
        const berakhir = sudahBerakhir(sesi);

        const kuotaTipe = profile?.tipe === 'member' ? sesi.kuota_member : sesi.kuota_harian;
        const terisi = jumlahTerisi[sesi.id] || 0;
        const penuh = terisi >= kuotaTipe;

        return (
          <div className="card" key={sesi.id}>
            <div className="card-row">
              <div>
                <Link href={`/sesi/${sesi.id}`}><strong>{sesi.label || sesi.tanggal}</strong></Link>
                <p className="subtle" style={{ margin: '4px 0 0', fontSize: 11 }}>
                  Deadline batal: {new Date(sesi.deadline_batal).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                {berakhir ? (
                  <span className="badge done">Selesai</span>
                ) : p ? (
                  <>
                    <span className={`badge ${p.status_daftar === 'terdaftar' ? 'open' : 'warn'}`}>
                      {p.status_daftar === 'terdaftar' ? 'Terdaftar' : 'Waiting list'}
                    </span>
                    {!lewatDeadline && (
                      <div style={{ marginTop: 8 }}>
                        <button className="badge-btn" disabled={busySesi === p.id} onClick={() => batalSesi(p.id)}>
                          {busySesi === p.id ? '...' : 'Batal'}
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <button
                    className={penuh ? 'secondary' : ''}
                    disabled={busySesi === sesi.id || sesi.status !== 'buka'}
                    onClick={() => daftarSesi(sesi.id)}
                  >
                    {busySesi === sesi.id ? '...' : penuh ? 'FULL — Gabung Waiting List' : 'Daftar'}
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {sesiList.length > PER_HALAMAN && (
        <div className="card-row" style={{ marginTop: 8, marginBottom: 24 }}>
          <button className="secondary" disabled={halamanSesi === 0} onClick={() => setHalamanSesi((h) => h - 1)}>← Sebelumnya</button>
          <span className="subtle" style={{ fontSize: 12 }}>Halaman {halamanSesi + 1} dari {totalHalamanSesi}</span>
          <button className="secondary" disabled={halamanSesi >= totalHalamanSesi - 1} onClick={() => setHalamanSesi((h) => h + 1)}>Selanjutnya →</button>
        </div>
      )}

      <h1 style={{ marginTop: 36 }}>Konfirmasi Member Bulanan</h1>
      <p className="subtle">Daftar di sini kalau mau lanjut/jadi member bulan ini. Belum daftar sampai deadline = otomatis jadi harian bulan depan.</p>

      {msgMember && <p className="error">{msgMember}</p>}

      {memberList.length === 0 && <div className="empty">Belum ada sesi konfirmasi member yang dibuka admin.</div>}

      {memberTampil.map((sesi) => {
        const p = pendaftaranMemberSaya[sesi.id];
        const lewatDeadline = new Date() > new Date(sesi.deadline_daftar);

        return (
          <div className="card" key={sesi.id}>
            <div className="card-row">
              <div>
                {isAdminRole ? (
                  <Link href={`/member-bulanan/${sesi.id}`}><strong>{sesi.label || `${NAMA_BULAN[sesi.bulan]} ${sesi.tahun}`}</strong></Link>
                ) : (
                  <strong>{sesi.label || `${NAMA_BULAN[sesi.bulan]} ${sesi.tahun}`}</strong>
                )}
                <p className="subtle" style={{ margin: '4px 0 0', fontSize: 11 }}>
                  Deadline daftar: {new Date(sesi.deadline_daftar).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                {lewatDeadline ? (
                  <span className="badge done">Ditutup</span>
                ) : p ? (
                  <>
                    <span className="badge open">Terdaftar</span>
                    <div style={{ marginTop: 8 }}>
                      <button className="badge-btn" disabled={busyMember === p.id} onClick={() => batalMember(p.id)}>
                        {busyMember === p.id ? '...' : 'Batal'}
                      </button>
                    </div>
                  </>
                ) : (
                  <button disabled={busyMember === sesi.id} onClick={() => daftarMember(sesi.id)}>
                    {busyMember === sesi.id ? '...' : 'Daftar'}
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {memberList.length > PER_HALAMAN && (
        <div className="card-row" style={{ marginTop: 8 }}>
          <button className="secondary" disabled={halamanMember === 0} onClick={() => setHalamanMember((h) => h - 1)}>← Sebelumnya</button>
          <span className="subtle" style={{ fontSize: 12 }}>Halaman {halamanMember + 1} dari {totalHalamanMember}</span>
          <button className="secondary" disabled={halamanMember >= totalHalamanMember - 1} onClick={() => setHalamanMember((h) => h + 1)}>Selanjutnya →</button>
        </div>
      )}
    </div>
  );
}
