import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../lib/supabaseClient';
import { useAuth, getAccessToken } from '../lib/useAuth';
import TopBar from '../components/TopBar';

const NAMA_BULAN = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

export default function MemberBulanan() {
  const { profile, loading } = useAuth();
  const [sesi, setSesi] = useState(null);
  const [pendaftaranSaya, setPendaftaranSaya] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function load() {
    const { data: sesiData } = await supabase
      .from('sesi_member_bulanan')
      .select('*')
      .order('tahun', { ascending: false })
      .order('bulan', { ascending: false })
      .limit(1)
      .maybeSingle();
    setSesi(sesiData);

    if (sesiData && profile) {
      const { data: p } = await supabase
        .from('pendaftaran_member_bulanan')
        .select('*')
        .eq('sesi_member_bulanan_id', sesiData.id)
        .eq('player_id', profile.id)
        .maybeSingle();
      setPendaftaranSaya(p && p.status_daftar !== 'batal' ? p : null);
    }
  }

  useEffect(() => { if (!loading) load(); }, [loading, profile]);

  async function daftar() {
    setBusy(true);
    setMsg('');
    const token = await getAccessToken();
    const res = await fetch('/api/daftar-member-bulanan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ sesi_member_bulanan_id: sesi.id }),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) { setMsg(json.error); return; }
    await load();
  }

  async function batal() {
    setBusy(true);
    setMsg('');
    const token = await getAccessToken();
    const res = await fetch('/api/batal-member-bulanan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ pendaftaran_id: pendaftaranSaya.id }),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) { setMsg(json.error); return; }
    await load();
  }

  if (loading) return null;

  const isAdmin = profile && (profile.role === 'admin' || profile.role === 'super_admin');
  const lewatDeadline = sesi && new Date() > new Date(sesi.deadline_daftar);

  return (
    <div className="wrap">
      <TopBar profile={profile} />
      <h1>Konfirmasi Member Bulanan</h1>
      <p className="subtle">Daftar di sini kalau mau lanjut/jadi member bulan ini. Belum daftar sampai deadline = otomatis jadi harian bulan depan.</p>

      {msg && <p className="error">{msg}</p>}

      {!sesi && <div className="empty">Belum ada sesi konfirmasi member yang dibuka admin.</div>}

      {sesi && (
        <div className="card">
          <div className="card-row">
            <div>
              <strong>{sesi.label || `${NAMA_BULAN[sesi.bulan]} ${sesi.tahun}`}</strong>
              <p className="subtle" style={{ margin: '4px 0 0', fontSize: 11 }}>
                Deadline daftar: {new Date(sesi.deadline_daftar).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              {lewatDeadline ? (
                <span className="badge done">Ditutup</span>
              ) : pendaftaranSaya ? (
                <>
                  <span className="badge open">Terdaftar</span>
                  <div style={{ marginTop: 8 }}>
                    <button className="badge-btn" disabled={busy} onClick={batal}>
                      {busy ? '...' : 'Batal'}
                    </button>
                  </div>
                </>
              ) : (
                <button disabled={busy} onClick={daftar}>{busy ? '...' : 'Daftar'}</button>
              )}
            </div>
          </div>
        </div>
      )}

      {isAdmin && sesi && (
        <p className="subtle" style={{ marginTop: 12 }}>
          <Link href={`/member-bulanan/${sesi.id}`} style={{ textDecoration: 'underline' }}>
            Lihat siapa aja yang sudah daftar
          </Link>
        </p>
      )}
    </div>
  );
}
