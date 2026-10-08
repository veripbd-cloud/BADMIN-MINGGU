import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/useAuth';
import TopBar from '../components/TopBar';

function hitungTenure(profile) {
  const sumber = profile.member_sejak || profile.tanggal_daftar;
  const mulai = new Date(sumber);
  const now = new Date();
  const bulan = (now.getFullYear() - mulai.getFullYear()) * 12 + (now.getMonth() - mulai.getMonth());
  if (bulan < 1) return 'baru gabung bulan ini';
  return `sejak ${mulai.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })} (${bulan} bulan)`;
}

function labelRiwayat(r) {
  if (r.status_hadir === 'hadir') return 'Hadir';
  if (r.status_hadir === 'no_show') return 'Tidak Hadir';
  if (r.status_daftar === 'batal') return 'Batal';
  if (r.status_daftar === 'terdaftar') return 'Terdaftar';
  return 'Waiting list';
}

export default function Profile() {
  const { profile, loading } = useAuth();
  const [riwayat, setRiwayat] = useState([]);
  const [outstanding, setOutstanding] = useState([]);

  const [namaTampil, setNamaTampil] = useState('');
  const [modeEdit, setModeEdit] = useState(false);
  const [namaBaru, setNamaBaru] = useState('');
  const [simpanMsg, setSimpanMsg] = useState('');
  const [menyimpan, setMenyimpan] = useState(false);

  const [emailTampil, setEmailTampil] = useState('');
  const [modeEditEmail, setModeEditEmail] = useState(false);
  const [emailBaru, setEmailBaru] = useState('');
  const [simpanEmailMsg, setSimpanEmailMsg] = useState('');
  const [menyimpanEmail, setMenyimpanEmail] = useState(false);

  useEffect(() => {
    if (profile) setNamaTampil(profile.nama);
  }, [profile]);

  useEffect(() => {
    async function ambilEmail() {
      const { data } = await supabase.auth.getUser();
      if (data?.user?.email) setEmailTampil(data.user.email);
    }
    ambilEmail();
  }, []);

  useEffect(() => {
    async function load() {
      if (!profile) return;
      const { data: r } = await supabase
        .from('pendaftaran_sesi')
        .select('*, sesi:sesi_id(label, tanggal)')
        .eq('player_id', profile.id)
        .order('waktu_daftar', { ascending: false })
        .limit(10);
      setRiwayat(r || []);

      const { data: o } = await supabase
        .from('outstanding')
        .select('*')
        .eq('player_id', profile.id)
        .eq('status', 'belum_lunas');
      setOutstanding(o || []);
    }
    load();
  }, [profile]);

  async function simpanNama(e) {
    e.preventDefault();
    if (!namaBaru.trim()) return;
    setMenyimpan(true);
    setSimpanMsg('');
    const { error } = await supabase.from('profiles').update({ nama: namaBaru.trim() }).eq('id', profile.id);
    setMenyimpan(false);
    if (error) { setSimpanMsg('Gagal ganti nama: ' + error.message); return; }
    setNamaTampil(namaBaru.trim());
    setModeEdit(false);
  }

  async function simpanEmail(e) {
    e.preventDefault();
    if (!emailBaru.trim()) return;
    setMenyimpanEmail(true);
    setSimpanEmailMsg('');
    const { error } = await supabase.auth.updateUser({ email: emailBaru.trim() });
    setMenyimpanEmail(false);
    if (error) { setSimpanEmailMsg('Gagal ganti email: ' + error.message); return; }
    setSimpanEmailMsg('Berhasil. Kalau ada minta konfirmasi lewat email, cek inbox kamu dulu.');
    setEmailTampil(emailBaru.trim());
    setModeEditEmail(false);
  }

  if (loading || !profile) return null;

  const tombolPensil = { padding: '4px 8px', fontSize: 12, lineHeight: 1 };

  return (
    <div className="wrap">
      <TopBar profile={profile} />

      {modeEdit ? (
        <form onSubmit={simpanNama} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={{ marginTop: 0 }}>Nama</label>
            <input value={namaBaru} onChange={(e) => setNamaBaru(e.target.value)} autoFocus />
          </div>
          <button type="submit" disabled={menyimpan}>{menyimpan ? '...' : 'Simpan'}</button>
          <button type="button" className="secondary" onClick={() => setModeEdit(false)}>Batal</button>
        </form>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <h1 style={{ margin: 0 }}>{namaTampil}</h1>
          <button
            className="secondary"
            onClick={() => { setNamaBaru(namaTampil); setModeEdit(true); }}
            aria-label="Ganti nama" title="Ganti nama" style={tombolPensil}
          >
            ✏️
          </button>
        </div>
      )}
      {simpanMsg && <p className="error">{simpanMsg}</p>}

      <div className="stat" style={{ alignItems: 'flex-start', gap: 32 }}>
        <div className="item">
          <span className="label">Status</span>
          <span className="num">{profile.tipe === 'member' ? 'Member' : 'Harian'}</span>
          <span className="subtle" style={{ fontSize: 11 }}>{hitungTenure(profile)}</span>
        </div>

        <div className="item">
          <span className="label">Level</span>
          <span className="num">{profile.level_final || 'Belum di-review'}</span>
          {profile.level_self && (
            <span className="subtle" style={{ fontSize: 11 }}>
              Usulan: {profile.level_self}{profile.status_approval !== 'approved' ? ' (menunggu admin)' : ''}
            </span>
          )}
        </div>

        <div className="item">
          <span className="label">Akun</span>
          {modeEditEmail ? (
            <form onSubmit={simpanEmail} style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 2 }}>
              <input type="email" value={emailBaru} onChange={(e) => setEmailBaru(e.target.value)} autoFocus style={{ minWidth: 180 }} />
              <button type="submit" disabled={menyimpanEmail} style={{ padding: '6px 12px' }}>{menyimpanEmail ? '...' : 'Simpan'}</button>
              <button type="button" className="secondary" style={{ padding: '6px 12px' }} onClick={() => setModeEditEmail(false)}>Batal</button>
            </form>
          ) : (
            <span className="num" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {emailTampil}
              <button
                className="secondary"
                onClick={() => { setEmailBaru(emailTampil); setModeEditEmail(true); setSimpanEmailMsg(''); }}
                aria-label="Ganti email" title="Ganti email" style={tombolPensil}
              >
                ✏️
              </button>
            </span>
          )}
          <Link href="/reset-password" style={{ textDecoration: 'underline', fontSize: 11 }}>Ganti Password</Link>
          <span className="subtle" style={{ fontSize: 11, display: 'block', marginTop: 2 }}>
            {profile.status_approval === 'approved' ? 'Terverifikasi' : 'Menunggu review'}
          </span>
        </div>
      </div>
      {simpanEmailMsg && <p className={simpanEmailMsg.startsWith('Gagal') ? 'error' : 'success'}>{simpanEmailMsg}</p>}

      {outstanding.length > 0 && (
        <>
          <h2>Outstanding</h2>
          {outstanding.map((o) => (
            <div className="card outstanding-item" key={o.id}>
              Rp{o.nominal.toLocaleString('id-ID')} — {o.keterangan}
            </div>
          ))}
        </>
      )}

      <h2>Riwayat Sesi Terakhir</h2>
      {riwayat.length === 0 && <div className="empty">Belum ada riwayat.</div>}
      {riwayat.map((r) => (
        <div className="card" key={r.id}>
          <div className="card-row">
            <span>{r.sesi?.label || r.sesi?.tanggal}</span>
            <span className={`badge ${r.status_hadir === 'hadir' ? 'done' : r.status_hadir === 'no_show' ? 'warn' : ''}`}>
              {labelRiwayat(r)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
