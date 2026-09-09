import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../lib/supabaseClient';
import { useAuth, getAccessToken } from '../lib/useAuth';
import TopBar from '../components/TopBar';

export default function Home() {
  const { profile, loading } = useAuth();
  const [sesiList, setSesiList] = useState([]);
  const [pendaftaranSaya, setPendaftaranSaya] = useState({});
  const [jumlahTerisi, setJumlahTerisi] = useState({}); // sesi_id -> jumlah terdaftar di tipe kita
  const [busy, setBusy] = useState(null);
  const [msg, setMsg] = useState('');

  async function loadSesi() {
    const { data: sesi } = await supabase
      .from('sesi')
      .select('*')
      .order('tanggal', { ascending: false })
      .limit(15);
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

      // Hitung berapa slot TIPE KITA yang udah terisi di tiap sesi, buat tau penuh apa belum
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

  useEffect(() => {
    if (!loading) loadSesi();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, profile]);

  async function daftar(sesi_id) {
    setBusy(sesi_id);
    setMsg('');
    const token = await getAccessToken();
    const res = await fetch('/api/daftar-sesi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ sesi_id }),
    });
    const json = await res.json();
    setBusy(null);
    if (!res.ok) { setMsg(json.error); return; }
    await loadSesi();
  }

  async function batal(pendaftaran_id) {
    setBusy(pendaftaran_id);
    setMsg('');
    const token = await getAccessToken();
    const res = await fetch('/api/batal-sesi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ pendaftaran_id }),
    });
    const json = await res.json();
    setBusy(null);
    if (!res.ok) { setMsg(json.error); return; }
    await loadSesi();
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

  return (
    <div className="wrap">
      <TopBar profile={profile} />
      <h1>Sesi Mingguan</h1>
      <p className="subtle">Main tiap minggu, jam 07:00–10:00. Daftar untuk ikut main, atau batal sebelum deadline.</p>

      {msg && <p className="error">{msg}</p>}

      {sesiList.length === 0 && <div className="empty">Belum ada sesi dibuat.</div>}

      {sesiList.map((sesi) => {
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
                        <button className="badge-btn" disabled={busy === p.id} onClick={() => batal(p.id)}>
                          {busy === p.id ? '...' : 'Batal'}
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <button
                    className={penuh ? 'secondary' : ''}
                    disabled={busy === sesi.id || sesi.status !== 'buka'}
                    onClick={() => daftar(sesi.id)}
                  >
                    {busy === sesi.id ? '...' : penuh ? 'FULL — Gabung Waiting List' : 'Daftar'}
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
