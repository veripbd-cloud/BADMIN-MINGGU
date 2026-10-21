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
  const [hasilProses, setHasilProses] = useState(null);
  const [msg, setMsg] = useState('');

  const isAdmin = profile && (profile.role === 'admin' || profile.role === 'super_admin');

  async function load() {
    if (!id) return;
    const { data: sesiData } = await supabase.from('sesi_member_bulanan').select('*').eq('id', id).single();
    setSesi(sesiData);

    // Setelah deadline: turunkan member yang tidak daftar. Jalan SEKALI per sesi,
    // jadi membuka halaman bulan lama aman (tidak mengubah apa pun).
    if (sesiData && isAdmin && new Date() > new Date(sesiData.deadline_daftar)) {
      const token = await getAccessToken();
      const res = await fetch('/api/admin/finalisasi-member-bulanan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ sesi_member_bulanan_id: id }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok) setHasilProses(json);
      else setMsg(json.error || `Gagal memproses (kode ${res.status})`);
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

      {hasilProses?.diturunkan > 0 && (
        <p className="subtle">{hasilProses.diturunkan} member diturunkan jadi harian karena gak daftar bulan ini.</p>
      )}
      {(hasilProses?.sudah || hasilProses?.dilewati) && (
        <p className="subtle" style={{ fontSize: 11 }}>
          Sesi ini sudah diproses sebelumnya, jadi halaman ini hanya untuk melihat daftar peserta.
        </p>
      )}

      <h2>Daftar Peserta</h2>
      {pendaftaran.length === 0 && <div className="empty">Belum ada yang daftar.</div>}
      {pendaftaran.map((p) => {
        const o = outstandingMap[p.id];
        const label = !o ? 'Tanpa tagihan' : o.status === 'lunas' ? 'Lunas' : 'Belum Lunas';
        const kelas = !o ? '' : o.status === 'lunas' ? 'open' : 'warn';
        return (
          <div className="card" key={p.id}>
            <div className="card-row">
              <span>
                {profiles[p.player_id]?.nama || '—'}
                {o && <span className="subtle" style={{ fontSize: 11 }}> · Rp{o.nominal.toLocaleString('id-ID')}</span>}
              </span>
              <span className={`badge ${kelas}`}>{label}</span>
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
