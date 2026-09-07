import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';
import { useAuth, getAccessToken } from '../../lib/useAuth';
import TopBar from '../../components/TopBar';

const DAFTAR_LAPANGAN = ['A6', 'A7', 'A9', 'A10'];

export default function DetailSesi() {
  const router = useRouter();
  const { id } = router.query;
  const { profile, loading } = useAuth();
  const [sesi, setSesi] = useState(null);
  const [pendaftaran, setPendaftaran] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [pilihanPerLapangan, setPilihanPerLapangan] = useState({});
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
  const semuaTerdaftar = [...terdaftarMember, ...terdaftarHarian];

  const antrianMenunggu = semuaTerdaftar
    .filter((p) => p.waktu_checkin && p.status_main === 'menunggu')
    .sort((a, b) => {
      if (a.jumlah_game !== b.jumlah_game) return a.jumlah_game - b.jumlah_game;
      return new Date(a.waktu_checkin) - new Date(b.waktu_checkin);
    });

  const belumCheckin = semuaTerdaftar.filter((p) => !p.waktu_checkin);

  function pemainDiLapangan(kodeLapangan) {
    return semuaTerdaftar.filter((p) => p.status_main === 'main' && p.lapangan_sekarang === kodeLapangan);
  }

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

  function togglePilihan(kodeLapangan, player_id) {
    setPilihanPerLapangan((prev) => {
      const current = prev[kodeLapangan] || [];
      const next = current.includes(player_id)
        ? current.filter((x) => x !== player_id)
        : [...current, player_id];
      return { ...prev, [kodeLapangan]: next };
    });
  }

  async function mulaiMain(kodeLapangan) {
    const pilihan = pilihanPerLapangan[kodeLapangan] || [];
    if (pilihan.length === 0) { setMsg('Pilih minimal 1 pemain dari antrian dulu'); return; }
    setMsg('');
    await apiCall('/api/admin/mulai-main', { sesi_id: id, lapangan: kodeLapangan, player_ids: pilihan });
    setPilihanPerLapangan((prev) => ({ ...prev, [kodeLapangan]: [] }));
    load();
  }

  async function selesaiMain(kodeLapangan) {
    setMsg('');
    await apiCall('/api/admin/selesai-main', { sesi_id: id, lapangan: kodeLapangan });
    load();
  }

  if (loading || !sesi) return null;

  const sesiBerakhir = new Date() > new Date(sesi.tanggal + 'T10:00:00');
  const bisaAdminKontrol = isAdmin && !sesiBerakhir;

  return (
    <div className="wrap">
      <TopBar profile={profile} />
      <h1>{sesi.label || sesi.tanggal}</h1>
      <p className="subtle">
        Deadline batal: {new Date(sesi.deadline_batal).toLocaleString('id-ID')} · Kuota: {sesi.kuota_member} member / {sesi.kuota_harian} harian
      </p>
      {sesiBerakhir && <p className="badge done" style={{ display: 'inline-block', marginBottom: 10 }}>Sesi sudah berakhir (lewat jam 10:00) — kontrol admin dikunci</p>}
      {msg && <p className="error">{msg}</p>}

      <h2>Terdaftar — Member ({terdaftarMember.length}/{sesi.kuota_member})</h2>
      <ListPeserta items={terdaftarMember} profiles={profiles} isAdmin={bisaAdminKontrol} onCheckin={checkin} onTandai={tandaiHadir} />

      <h2>Terdaftar — Harian ({terdaftarHarian.length}/{sesi.kuota_harian})</h2>
      <ListPeserta items={terdaftarHarian} profiles={profiles} isAdmin={bisaAdminKontrol} onCheckin={checkin} onTandai={tandaiHadir} />

      {(waitingMember.length > 0 || waitingHarian.length > 0) && (
        <>
          <h2>Waiting List (Sesi)</h2>
          {waitingMember.map((p, idx) => (
            <div className="card" key={p.id}>
              <div className="card-row">
                <span>#{idx + 1} {profiles[p.player_id]?.nama} <span className="badge">member</span></span>
                {bisaAdminKontrol && <button className="secondary" onClick={() => promosikan(p.id)}>Naikkan</button>}
              </div>
            </div>
          ))}
          {waitingHarian.map((p, idx) => (
            <div className="card" key={p.id}>
              <div className="card-row">
                <span>#{idx + 1} {profiles[p.player_id]?.nama} <span className="badge">harian</span></span>
                {bisaAdminKontrol && <button className="secondary" onClick={() => promosikan(p.id)}>Naikkan</button>}
              </div>
            </div>
          ))}
        </>
      )}

      {isAdmin && (
        <>
          <h2>Lapangan</h2>
          <p className="subtle">Klik pemain dari antrian di bawah kartu lapangan buat mulai main, atau klik Selesai kalau game-nya udah kelar.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12, marginBottom: 12 }}>
            {DAFTAR_LAPANGAN.map((kode) => {
              const pemain = pemainDiLapangan(kode);
              const kosong = pemain.length === 0;
              return (
                <div className="card" key={kode}>
                  <div className="card-row" style={{ marginBottom: 8 }}>
                    <strong>Lapangan {kode}</strong>
                    <span className={`badge ${kosong ? '' : 'open'}`}>{kosong ? 'Kosong' : 'Sedang main'}</span>
                  </div>

                  {!kosong && (
                    <>
                      <div style={{ marginBottom: 10 }}>
                        {pemain.map((p) => (
                          <div key={p.id} style={{ fontSize: 14, marginBottom: 4 }}>
                            {profiles[p.player_id]?.nama} <span className="subtle" style={{ fontSize: 12 }}>({p.jumlah_game}x sebelumnya)</span>
                          </div>
                        ))}
                      </div>
                      <button disabled={!bisaAdminKontrol} onClick={() => selesaiMain(kode)}>Selesai Main</button>
                    </>
                  )}

                  {kosong && (
                    <>
                      <p className="subtle" style={{ fontSize: 12, margin: '0 0 6px' }}>Pilih dari antrian:</p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                        {antrianMenunggu.length === 0 && <span className="subtle" style={{ fontSize: 13 }}>Antrian kosong.</span>}
                        {antrianMenunggu.map((p) => {
                          const terpilih = (pilihanPerLapangan[kode] || []).includes(p.player_id);
                          return (
                            <button
                              key={p.id}
                              type="button"
                              className={terpilih ? '' : 'secondary'}
                              style={{ fontSize: 13, padding: '6px 10px' }}
                              onClick={() => togglePilihan(kode, p.player_id)}
                            >
                              {profiles[p.player_id]?.nama}
                            </button>
                          );
                        })}
                      </div>
                      <button
                        className="secondary"
                        disabled={!bisaAdminKontrol || !(pilihanPerLapangan[kode] || []).length}
                        onClick={() => mulaiMain(kode)}
                      >
                        Mulai Main
                      </button>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          <h2>Antrian Menunggu ({antrianMenunggu.length})</h2>
          {antrianMenunggu.length === 0 && <div className="empty">Tidak ada yang sedang menunggu.</div>}
          {antrianMenunggu.map((p, idx) => (
            <div className="card" key={p.id}>
              <div className="card-row">
                <span>{idx + 1}. {profiles[p.player_id]?.nama} — {p.jumlah_game}x main</span>
                <span className="badge">sejak {new Date(p.waktu_checkin).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </div>
          ))}

          {belumCheckin.length > 0 && (
            <>
              <h2>Belum Check-in</h2>
              {belumCheckin.map((p) => (
                <div className="card" key={p.id}>
                  <div className="card-row">
                    <span>{profiles[p.player_id]?.nama}</span>
                    <button className="secondary" disabled={!bisaAdminKontrol} onClick={() => checkin(p.id)}>Check-in</button>
                  </div>
                </div>
              ))}
            </>
          )}
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
              {p.status_main === 'main' && p.lapangan_sekarang && ` · Sedang di ${p.lapangan_sekarang}`}
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
