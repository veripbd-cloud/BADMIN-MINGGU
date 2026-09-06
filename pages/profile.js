import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/useAuth';
import TopBar from '../components/TopBar';

function hitungTenure(tanggal_daftar) {
  const mulai = new Date(tanggal_daftar);
  const now = new Date();
  const bulan = (now.getFullYear() - mulai.getFullYear()) * 12 + (now.getMonth() - mulai.getMonth());
  if (bulan < 1) return 'Baru gabung bulan ini';
  return `Member sejak ${mulai.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })} (${bulan} bulan)`;
}

export default function Profile() {
  const { profile, loading } = useAuth();
  const [riwayat, setRiwayat] = useState([]);
  const [outstanding, setOutstanding] = useState([]);

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

  if (loading || !profile) return null;

  return (
    <div className="wrap">
      <TopBar profile={profile} />
      <h1>{profile.nama}</h1>
      <p className="subtle">{hitungTenure(profile.tanggal_daftar)}</p>

      <div className="stat">
        <div className="item">
          <span className="num">{profile.tipe === 'member' ? 'Member' : 'Harian'}</span>
          <span className="label">Status</span>
        </div>
        <div className="item">
          <span className="num">{profile.level_final || 'Belum di-review'}</span>
          <span className="label">Level</span>
        </div>
        <div className="item">
          <span className="num">{profile.status_approval === 'approved' ? 'Terverifikasi' : 'Menunggu review'}</span>
          <span className="label">Status akun</span>
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
