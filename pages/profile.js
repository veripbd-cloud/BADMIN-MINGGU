import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/useAuth';
import TopBar from '../components/TopBar';

function hitungTenure(profile) {
  const sumber = profile.member_sejak || profile.tanggal_daftar;
  const mulai = new Date(sumber);
  const now = new Date();
  const bulan = (now.getFullYear() - mulai.getFullYear()) * 12 + (now.getMonth() - mulai.getMonth());
  if (bulan < 1) return 'Baru gabung bulan ini';
  return `Member sejak ${mulai.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })} (${bulan} bulan)`;
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

  useEffect(() => {
    if (profile) setNamaTampil(profile.nama);
  }, [profile]);

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
    const { error } = await supabase
      .from('profiles')
      .update({ nama: namaBaru.trim() })
      .eq('id', profile.id);
    setMenyimpan(false);
    if (error) {
      setSimpanMsg('Gagal ganti nama: ' + error.message);
      return;
    }
    setNamaTampil(namaBaru.trim());
    setModeEdit(false);
  }

  async function simpanTipe(tipeBaru) {
    setSimpanMsg('');
    const { error } = await supabase.from('profiles').update({ tipe: tipeBaru }).eq('id', profile.id);
    if (error) setSimpanMsg('Gagal ganti status: ' + error.message);
    else location.reload();
  }

  async function simpanLevelSelf(levelBaru) {
    setSimpanMsg('');
    // Ini cuma update level_self (usulan sendiri) — level_final tetap keputusan admin,
    // gak kesentuh sama sekali dari sini.
    const { error } = await supabase
      .from('profiles')
      .update({ level_self: levelBaru })
      .eq('id', profile.id);
    if (error) setSimpanMsg('Gagal ganti level: ' + error.message);
    else location.reload();
  }

  if (loading || !profile) return null;

  return (
    <div className="wrap">
      <TopBar profile={profile} />

      {modeEdit ? (
        <form onSubmit={simpanNama} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 4 }}>
          <div style={{ flex: 1 }}>
            <label style={{ marginTop: 0 }}>Nama</label>
            <input value={namaBaru} onChange={(e) => setNamaBaru(e.target.value)} autoFocus />
          </div>
          <button type="submit" disabled={menyimpan}>{menyimpan ? '...' : 'Simpan'}</button>
          <button type="button" className="secondary" onClick={() => setModeEdit(false)}>Batal</button>
        </form>
      ) : (
        <div className="card-row" style={{ marginBottom: 4 }}>
          <h1 style={{ margin: 0 }}>{namaTampil}</h1>
          <button
            className="secondary"
            onClick={() => { setNamaBaru(namaTampil); setModeEdit(true); }}
            aria-label="Ganti nama"
            title="Ganti nama"
            style={{ padding: '6px 10px', fontSize: 14, lineHeight: 1 }}
          >
            ✏️
          </button>
        </div>
      )}
      {simpanMsg && <p className="error">{simpanMsg}</p>}
      <p className="subtle">{hitungTenure(profile)}</p>

      <div className="stat">
        <div className="item">
          <span className="label">Status</span>
          <select
            value={profile.tipe}
            onChange={(e) => simpanTipe(e.target.value)}
            style={{ width: 'auto', marginTop: 2 }}
          >
            <option value="member">Member</option>
            <option value="harian">Harian</option>
          </select>
        </div>
        <div className="item">
          <span className="label">Level (usulan)</span>
          <select
            value={profile.level_self || ''}
            onChange={(e) => simpanLevelSelf(e.target.value)}
            style={{ width: 'auto', marginTop: 2 }}
          >
            <option value="">-</option>
            <option value="A1">A1</option>
            <option value="A2">A2</option>
            <option value="B1">B1</option>
            <option value="B2">B2</option>
            <option value="C">C</option>
          </select>
          <div className="subtle" style={{ fontSize: 11, marginTop: 4 }}>
            Final: {profile.level_final || '-'} {profile.status_approval !== 'approved' && '(menunggu admin)'}
          </div>
        </div>
        <div className="item">
          <span className="label">Status akun</span>
          <span className="num">{profile.status_approval === 'approved' ? 'Terverifikasi' : 'Menunggu review'}</span>
        </div>
      </div>

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
              {r.status_hadir === 'hadir' ? 'Hadir' : r.status_hadir === 'no_show' ? 'No-show' : r.status_daftar}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
