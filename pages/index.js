import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../lib/supabaseClient';
import { useAuth, getAccessToken } from '../lib/useAuth';
import TopBar from '../components/TopBar';

export default function Home() {
  const { profile, loading } = useAuth();
  const [sesiList, setSesiList] = useState([]);
  const [pendaftaranSaya, setPendaftaranSaya] = useState({}); // sesi_id -> pendaftaran
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
                        <button className="secondary" disabled={busy === p.id} onClick={() => batal(p.id)}>
                          {busy === p.id ? '...' : 'Batal'}
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <button disabled={busy === sesi.id || sesi.status !== 'buka'} onClick={() => daftar(sesi.id)}>
                    {busy === sesi.id ? '...' : 'Daftar'}
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
