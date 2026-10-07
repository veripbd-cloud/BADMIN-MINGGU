import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';
import { useAuth, getAccessToken } from '../../lib/useAuth';
import TopBar from '../../components/TopBar';

const NAMA_BULAN = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

export default function DetailMemberBulanan() {
  const router = useRouter();
  const { id } = router.query;
  const { profile, loading } = useAuth();
  const [sesi, setSesi] = useState(null);
  const [pendaftaran, setPendaftaran] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [outstandingMap, setOutstandingMap] = useState({});
  const [hasilFinalisasi, setHasilFinalisasi] = useState(null);
  const [msg, setMsg] = useState('');

  const isAdmin = profile && (profile.role === 'admin' || profile.role === 'super_admin');

  async function load() {
    if (!id) return;
    const { data: sesiData } = await supabase.from('sesi_member_bulanan').select('*').eq('id', id).single();
    setSesi(sesiData);

    if (sesiData && isAdmin && new Date() > new Date(sesiData.deadline_daftar)) {
      const token = await getAccessToken();
      const res = await fetch('/api/admin/finalisasi-member-bulanan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ sesi_member_bulanan_id: id }),
      });
      const json = await res.json();
      if (res.ok) setHasilFinalisasi(json);
      else setMsg(json.error);
    }

    const { data: pendaftaranData } = await supabase
      .from('pendaftaran_member_bulanan').select('*')
      .eq('sesi_member_bulanan_id', id).eq('status_daftar', 'terdaftar')
      .order('waktu_daftar', { ascending: true });
    setPendaftaran(pendaftaranData || []);

    const ids = (pendaftaranData || []).map((p) => p.player_id);
    if (ids.length) {
      const { data: profilesData } = await supabase.from('profiles').select('*').in('id', ids);
      const map = {};
      (profilesData || []).forEach((pr) => { map[pr.id] = pr; });
      setProfiles(map);

      const { data: outstandingData } = await supabase
        .from('outstanding').select('*')
        .eq('sumber', 'tagihan_bulanan_member').in('referensi_id', (pendaftaranData || []).map((p) => p.id));
      const oMap = {};
      (outstandingData || []).forEach((o) => { oMap[o.referensi_id] = o; });
      setOutstandingMap(oMap);
    }
  }

  useEffect(() => { load(); }, [id, isAdmin]);

  if (loading || !sesi) return null;

  return (
    <div className="wrap">
      <TopBar profile={profile} />
      <h1>{sesi.label || `${NAMA_BULAN[sesi.bulan]} ${sesi.tahun}`}</h1>
      <p className="subtle">
        Deadline: {new Date(sesi.deadline_daftar).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB
        {' · '}Terdaftar: {pendaftaran.length} orang
      </p>
      {msg && <p className="error">{msg}</p>}

      {hasilFinalisasi?.subsidi && (
        <div className="card">
          <p style={{ margin: 0 }}><strong>Hasil hitung subsidi kuartal ini:</strong></p>
          <p style={{ margin: '4px 0' }}>Tier: <strong>{hasilFinalisasi.subsidi.tier === 'gratis_100' ? 'Gratis 100%' : hasilFinalisasi.subsidi.tier === 'diskon_50' ? 'Diskon 50%' : '-'}</strong></p>
          <p style={{ margin: '4px 0' }}>Eligible: {hasilFinalisasi.subsidi.jumlah_eligible} · Tidak eligible: {hasilFinalisasi.subsidi.jumlah_tidak_eligible}</p>
          <p style={{ margin: '4px 0' }}>Sisa kas terhitung: Rp{hasilFinalisasi.subsidi.sisa_kas_dihitung?.toLocaleString('id-ID')}</p>
          <p className="subtle" style={{ fontSize: 11, marginTop: 6, marginBottom: 0 }}>
            Outstanding member yang eligible udah otomatis disesuaikan (dihapus kalau gratis, dipotong setengah kalau diskon).
          </p>
        </div>
      )}
      {hasilFinalisasi && !hasilFinalisasi.subsidi && hasilFinalisasi.diturunkan > 0 && (
        <p className="subtle">{hasilFinalisasi.diturunkan} member diturunkan jadi harian karena gak daftar bulan ini.</p>
      )}

      <h2>Daftar Peserta</h2>
      {pendaftaran.length === 0 && <div className="empty">Belum ada yang daftar.</div>}
      {pendaftaran.map((p) => {
        const outstanding = outstandingMap[p.id];
        const sudahLunas = outstanding ? outstanding.status === 'lunas' : false;
        return (
          <div className="card" key={p.id}>
            <div className="card-row">
              <span>{profiles[p.player_id]?.nama || '—'}</span>
              <span className={`badge ${sudahLunas ? 'open' : 'warn'}`}>{sudahLunas ? 'Lunas' : 'Belum Lunas'}</span>
            </div>
          </div>
        );
      })}
      <p className="subtle" style={{ marginTop: 16 }}>
        Buat tandain lunas, prosesnya di halaman <strong>Kas & Shuttlecock</strong> (bagian Outstanding).
      </p>
    </div>
  );
}
