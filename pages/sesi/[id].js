import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';
import { useAuth, getAccessToken } from '../../lib/useAuth';
import TopBar from '../../components/TopBar';

export default function DetailSesi() {
  const router = useRouter();
  const { id } = router.query;
  const { profile, loading } = useAuth();
  const [sesi, setSesi] = useState(null);
  const [pendaftaran, setPendaftaran] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [lapangan, setLapangan] = useState(1);
  const [pilihanPemain, setPilihanPemain] = useState([]);
  const [msg, setMsg] = useState('');

  const isAdmin = profile && (profile.role === 'admin' || profile.role === 'super_admin');

  async function load() {
    if (!id) return;
    const { data: sesiData } = await supabase.from('sesi').select('*').eq('id', id).single();
    setSesi(sesiData);

    const { data: pendaftaranData } = await supabase
      .from('pendaftaran_sesi')
      .select('*')
      .eq('sesi_id', id)
      .neq('status_daftar', 'batal')
      .order('waktu_daftar', { ascending: true });
    setPendaftaran(pendaftaranData || []);

    const ids = (pendaftaranData || []).map((p) => p.player_id);
    if (ids.length) {
      const { data: profilesData } = await supabase.from('profiles').select('*').in('id', ids);
      const map = {};
      (profilesData || []).forEach((pr) => { map[pr.id] = pr; });
      setProfiles(map);
    }
  }

  useEffect(() => { load(); }, [id]);

  const terdaftarMember = pendaftaran.filter((p) => p.status_daftar === 'terdaftar' && p.tipe_slot === 'member');
  const terdaftarHarian = pendaftaran.filter((p) => p.status_daftar === 'terdaftar' && p.tipe_slot === 'harian');
  const waitingMember = pendaftaran.filter((p) => p.status_daftar === 'waiting_list' && p.tipe_slot === 'member');
  const waitingHarian = pendaftaran.filter((p) => p.status_daftar === 'waiting_list' && p.tipe_slot === 'harian');

  // Rekomendasi next-up: sudah check-in, urutkan jumlah_game paling sedikit lalu waktu_checkin paling lama
  const sudahCheckin = [...terdaftarMember, ...terdaftarHarian]
    .filter((p) => p.waktu_checkin)
    .sort((a, b) => {
      if (a.jumlah_game !== b.jumlah_game) return a.jumlah_game - b.jumlah_game;
      return new Date(a.waktu_checkin) - new Date(b.waktu_checkin);
    });

  async function apiCall(url, body) {
    const token = await getAccessToken();
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) setMsg(json.error);
    return { ok: res.ok, json };
  }

  async function checkin(pendaftaran_id) {
    await apiCall('/api/admin/checkin', { pendaftaran_id });
    load();
  }

  async function tandaiHadir(pendaftaran_id, status_hadir) {
    await apiCall('/api/admin/tandai-hadir', { pendaftaran_id, status_hadir });
    load();
  }

  async function promosikan(pendaftaran_id) {
    await apiCall('/api/admin/promosikan-manual', { pendaftaran_id });
    load();
  }

  function togglePemain(player_id) {
    setPilihanPemain((prev) =>
      prev.includes(player_id) ? prev.filter((x) => x !== player_id) : [...prev, player_id]
    );
  }

  async function submitGame() {
    if (pilihanPemain.length === 0) { setMsg('Pilih minimal 1 pemain'); return; }
    await apiCall('/api/admin/input-game', { sesi_id: id, lapangan, player_ids: pilihanPemain });
    setPilihanPemain([]);
    load();
  }

  if (loading || !sesi) return null;

  return (
    <div className="wrap">
      <TopBar profile={profile} />
      <h1>{sesi.label || sesi.tanggal}</h1>
      <p className="subtle">
        Deadline batal: {new Date(sesi.deadline_batal).toLocaleString('id-ID')} · Kuota: {sesi.kuota_member} member / {sesi.kuota_harian} harian
      </p>
      {msg && <p className="error">{msg}</p>}

      <h2>Terdaftar — Member ({terdaftarMember.length}/{sesi.kuota_member})</h2>
      <ListPeserta items={terdaftarMember} profiles={profiles} isAdmin={isAdmin} onCheckin={checkin} onTandai={tandaiHadir} />

      <h2>Terdaftar — Harian ({terdaftarHarian.length}/{sesi.kuota_harian})</h2>
      <ListPeserta items={terdaftarHarian} profiles={profiles} isAdmin={isAdmin} onCheckin={checkin} onTandai={tandaiHadir} />

      {(waitingMember.length > 0 || waitingHarian.length > 0) && (
        <>
          <h2>Waiting List</h2>
          {waitingMember.map((p, idx) => (
            <div className="card" key={p.id}>
              <div className="card-row">
                <span>#{idx + 1} {profiles[p.player_id]?.nama} <span className="badge">member</span></span>
                {isAdmin && <button className="secondary" onClick={() => promosikan(p.id)}>Naikkan</button>}
              </div>
            </div>
          ))}
          {waitingHarian.map((p, idx) => (
            <div className="card" key={p.id}>
              <div className="card-row">
                <span>#{idx + 1} {profiles[p.player_id]?.nama} <span className="badge">harian</span></span>
                {isAdmin && <button className="secondary" onClick={() => promosikan(p.id)}>Naikkan</button>}
              </div>
            </div>
          ))}
        </>
      )}

      {isAdmin && (
        <>
          <h2>Rekomendasi Next-Up</h2>
          <p className="subtle">Urutan saran berdasarkan jumlah game paling sedikit & lama menunggu sejak check-in. Keputusan final tetap di admin.</p>
          {sudahCheckin.length === 0 && <div className="empty">Belum ada yang check-in.</div>}
          {sudahCheckin.slice(0, 8).map((p, idx) => (
            <div className="card" key={p.id}>
              <div className="card-row">
                <span>{idx + 1}. {profiles[p.player_id]?.nama} — {p.jumlah_game}x main</span>
                <span className="badge">sejak {new Date(p.waktu_checkin).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </div>
          ))}

          <h2>Input Game Selesai</h2>
          <div className="card">
            <label>Lapangan</label>
            <select value={lapangan} onChange={(e) => setLapangan(parseInt(e.target.value, 10))}>
              <option value={1}>Lapangan 1</option>
              <option value={2}>Lapangan 2</option>
              <option value={3}>Lapangan 3</option>
              <option value={4}>Lapangan 4</option>
            </select>
            <label>Pilih pemain yang baru main</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
              {[...terdaftarMember, ...terdaftarHarian].map((p) => (
                <button
                  key={p.id}
                  className={pilihanPemain.includes(p.player_id) ? '' : 'secondary'}
                  onClick={() => togglePemain(p.player_id)}
                  type="button"
                >
                  {profiles[p.player_id]?.nama}
                </button>
              ))}
            </div>
            <div className="form-actions">
              <button onClick={submitGame}>Simpan Game</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function ListPeserta({ items, profiles, isAdmin, onCheckin, onTandai }) {
  if (items.length === 0) return <div className="empty">Belum ada.</div>;
  return items.map((p) => {
    const prof = profiles[p.player_id];
    return (
      <div className="card" key={p.id}>
        <div className="card-row">
          <div>
            <strong>{prof?.nama}</strong>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
              {p.waktu_checkin ? `Check-in ${new Date(p.waktu_checkin).toLocaleTimeString('id-ID')}` : 'Belum check-in'}
              {' · '}{p.jumlah_game}x main
              {p.status_hadir && ` · ${p.status_hadir === 'hadir' ? 'Hadir' : 'No-show'}`}
            </div>
          </div>
          {isAdmin && (
            <div style={{ display: 'flex', gap: 6 }}>
              {!p.waktu_checkin && <button className="secondary" onClick={() => onCheckin(p.id)}>Check-in</button>}
              {!p.status_hadir && (
                <>
                  <button className="secondary" onClick={() => onTandai(p.id, 'hadir')}>Hadir</button>
                  <button className="danger" onClick={() => onTandai(p.id, 'no_show')}>No-show</button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    );
  });
}
