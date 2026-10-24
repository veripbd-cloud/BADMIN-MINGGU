import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';
import { useAuth, getAccessToken } from '../../lib/useAuth';
import TopBar from '../../components/TopBar';
import Memuat from '../../components/Memuat';
import { tampilToast } from '../../components/Toast';

const DAFTAR_LAPANGAN = ['A6', 'A7', 'A9', 'A10'];

function namaPeserta(p, profiles) {
  return profiles[p.player_id]?.nama || p.nama_guest || 'Guest';
}

function HeaderCollapse({ children, terbuka, onToggle }) {
  return (
    <div onClick={onToggle} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
      <h2 style={{ margin: 0 }}>{children}</h2>
      <span style={{ fontSize: 12, lineHeight: 1 }}>{terbuka ? '▲' : '▼'}</span>
    </div>
  );
}

export default function DetailSesi() {
  const router = useRouter();
  const { id } = router.query;
  const { profile, loading } = useAuth();
  const [sesi, setSesi] = useState(null);
  const [semuaPendaftaran, setSemuaPendaftaran] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [pilihanPerLapangan, setPilihanPerLapangan] = useState({});
  const [namaGuestBaru, setNamaGuestBaru] = useState('');
  const [msg, setMsg] = useState('');

  const [bukaMember, setBukaMember] = useState(false);
  const [bukaHarian, setBukaHarian] = useState(false);
  const [bukaGuest, setBukaGuest] = useState(false);
  const [bukaAntrian, setBukaAntrian] = useState(false);
  const [barSiap, setBarSiap] = useState(false);

  const isAdmin = profile && (profile.role === 'admin' || profile.role === 'super_admin');

  async function load() {
    if (!id) return;
    const { data: sesiData } = await supabase.from('sesi').select('*').eq('id', id).single();
    setSesi(sesiData);

    if (sesiData && isAdmin) {
      const sudahLewat = new Date() > new Date(sesiData.tanggal + 'T10:00:00+07:00');
      if (sudahLewat) {
        const token = await getAccessToken();
        await fetch('/api/admin/auto-noshow', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ sesi_id: id }),
        });
      }
    }

    const { data: pendaftaranData } = await supabase
      .from('pendaftaran_sesi')
      .select('*')
      .eq('sesi_id', id)
      .order('waktu_daftar', { ascending: true });
    setSemuaPendaftaran(pendaftaranData || []);

    const ids = (pendaftaranData || []).map((p) => p.player_id).filter(Boolean);
    if (ids.length) {
      const { data: profilesData } = await supabase.from('profiles').select('*').in('id', ids);
      const map = {};
      (profilesData || []).forEach((pr) => { map[pr.id] = pr; });
      setProfiles(map);
    }
  }

  useEffect(() => { load(); }, [id, isAdmin]);

  // Bar kapasitas "mengisi" pelan-pelan sekali saat halaman pertama tampil
  useEffect(() => {
    if (!sesi) return undefined;
    const t = setTimeout(() => setBarSiap(true), 60);
    return () => clearTimeout(t);
  }, [sesi]);

  const terdaftarMember = semuaPendaftaran.filter((p) => p.status_daftar === 'terdaftar' && p.tipe_slot === 'member');
  const terdaftarHarian = semuaPendaftaran.filter((p) => p.status_daftar === 'terdaftar' && p.tipe_slot === 'harian');
  const terdaftarGuest = semuaPendaftaran.filter((p) => p.status_daftar === 'terdaftar' && p.tipe_slot === 'guest');
  const batalMember = semuaPendaftaran.filter((p) => p.status_daftar === 'batal' && p.tipe_slot === 'member');
  const waitingMember = semuaPendaftaran.filter((p) => p.status_daftar === 'waiting_list' && p.tipe_slot === 'member');
  const waitingHarian = semuaPendaftaran.filter((p) => p.status_daftar === 'waiting_list' && p.tipe_slot === 'harian');
  const semuaTerdaftar = [...terdaftarMember, ...terdaftarHarian, ...terdaftarGuest];

  const totalMemberSesi = terdaftarMember.length + batalMember.length;
  const totalHarianGuest = terdaftarHarian.length + terdaftarGuest.length;
  const totalTerisi = terdaftarMember.length + totalHarianGuest;

  const antrianMenunggu = semuaTerdaftar
    .filter((p) => p.waktu_checkin && p.status_main !== 'main')
    .sort((a, b) => new Date(a.waktu_checkin) - new Date(b.waktu_checkin));

  // Yang masih perlu ditandai di atas, yang sudah "Tidak Hadir" di bawah
  const belumCheckin = semuaTerdaftar
    .filter((p) => !p.waktu_checkin)
    .sort((a, b) => (a.status_hadir === 'no_show') - (b.status_hadir === 'no_show'));

  function pemainDiLapangan(kodeLapangan) {
    return semuaTerdaftar.filter((p) => p.status_main === 'main' && p.lapangan_sekarang === kodeLapangan);
  }

  async function apiCall(url, body, pesanSukses) {
    const token = await getAccessToken();
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const pesan = json.error || `Gagal (kode ${res.status})`;
      setMsg(pesan);
      tampilToast(pesan, 'error');
    } else if (pesanSukses) {
      tampilToast(pesanSukses);
    }
    return { ok: res.ok, json };
  }

  async function tandaiHadir(pendaftaran_id, status_hadir) {
    await apiCall('/api/admin/tandai-hadir', { pendaftaran_id, status_hadir }, status_hadir === 'no_show' ? 'Ditandai tidak hadir ✓' : 'Ditandai hadir ✓');
    load();
  }

  async function hadirGabungan(pendaftaran_id) {
    await apiCall('/api/admin/checkin', { pendaftaran_id });
    await apiCall('/api/admin/tandai-hadir', { pendaftaran_id, status_hadir: 'hadir' }, 'Hadir ✓');
    load();
  }

  async function ralatHadir(pendaftaran_id) {
    if (!confirm('Ralat status hadir/tidak-hadir ini? Outstanding yang belum dibayar (kalau ada) akan ikut dihapus.')) return;
    await apiCall('/api/admin/ralat-hadir', { pendaftaran_id }, 'Status diralat ✓');
    load();
  }

  async function promosikan(pendaftaran_id) {
    await apiCall('/api/admin/promosikan-manual', { pendaftaran_id }, 'Dinaikkan dari waiting list ✓');
    load();
  }

  async function batalkanAdmin(pendaftaran_id) {
    if (!confirm('Batalkan pendaftaran ini? Slot akan otomatis coba dikasih ke waiting list tipe yang sama dulu.')) return;
    await apiCall('/api/admin/batalkan-pendaftaran', { pendaftaran_id }, 'Pendaftaran dibatalkan ✓');
    load();
  }

  async function tambahGuest(e) {
    e.preventDefault();
    if (!namaGuestBaru.trim()) return;
    setMsg('');
    const hasil = await apiCall('/api/admin/tambah-guest', { sesi_id: id, nama_guest: namaGuestBaru.trim() }, 'Guest ditambahkan ✓');
    if (hasil.ok) setNamaGuestBaru('');
    load();
  }

  function togglePilihan(kodeLapangan, pendaftaran_id) {
    setPilihanPerLapangan((prev) => {
      const current = prev[kodeLapangan] || [];
      const next = current.includes(pendaftaran_id) ? current.filter((x) => x !== pendaftaran_id) : [...current, pendaftaran_id];
      return { ...prev, [kodeLapangan]: next };
    });
  }

  async function mulaiMain(kodeLapangan) {
    const pilihan = pilihanPerLapangan[kodeLapangan] || [];
    if (pilihan.length === 0) { setMsg('Pilih minimal 1 pemain dari antrian dulu'); return; }
    setMsg('');
    await apiCall('/api/admin/mulai-main', { sesi_id: id, lapangan: kodeLapangan, pendaftaran_ids: pilihan }, 'Game dimulai ✓');
    setPilihanPerLapangan((prev) => ({ ...prev, [kodeLapangan]: [] }));
    load();
  }

  async function selesaiMain(kodeLapangan) {
    setMsg('');
    await apiCall('/api/admin/selesai-main', { sesi_id: id, lapangan: kodeLapangan }, 'Game selesai ✓');
    load();
  }

  async function batalMain(kodeLapangan) {
    if (!confirm('Batalkan? Pemain balik ke posisi antrian semula, jumlah main mereka TIDAK nambah.')) return;
    setMsg('');
    await apiCall('/api/admin/batal-main', { sesi_id: id, lapangan: kodeLapangan }, 'Game dibatalkan ✓');
    load();
  }

  if (loading || !sesi) return <Memuat />;

  const sesiBerakhir = new Date() > new Date(sesi.tanggal + 'T10:00:00+07:00');
  const bisaAdminKontrol = isAdmin && !sesiBerakhir;

  const slotKosong = Math.max(0, sesi.kuota_total - totalTerisi);
  const persenTerisi = sesi.kuota_total > 0 ? Math.min(100, Math.round((totalTerisi / sesi.kuota_total) * 100)) : 0;
  const jumlahWaiting = waitingMember.length + waitingHarian.length;

  // Susun daftar pemain jadi teks rapi lalu buka WhatsApp (pilih grup/kontak di sana)
  function bagikanWA() {
    const hari = new Date(sesi.tanggal + 'T00:00:00+07:00').toLocaleDateString('id-ID', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta',
    });
    const baris = [];
    baris.push(`*${sesi.label || sesi.tanggal}*`);
    baris.push(`${hari} · 07.00–10.00 WIB`);
    baris.push(`Terisi ${totalTerisi}/${sesi.kuota_total} · ${slotKosong} slot kosong`);
    const tulis = (judul, arr) => {
      if (arr.length === 0) return;
      baris.push('');
      baris.push(`*${judul} (${arr.length})*`);
      arr.forEach((p, i) => baris.push(`${i + 1}. ${namaPeserta(p, profiles)}`));
    };
    tulis('Member', terdaftarMember);
    tulis('Harian', terdaftarHarian);
    tulis('Guest', terdaftarGuest);
    tulis('Waiting list', [...waitingMember, ...waitingHarian]);
    window.open('https://wa.me/?text=' + encodeURIComponent(baris.join('\n')), '_blank');
  }

  return (
    <div className="wrap">
      <TopBar profile={profile} />
      <h1>{sesi.label || sesi.tanggal}</h1>
      <p className="subtle">
        Deadline batal: {new Date(sesi.deadline_batal).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB
        {' · '}Terdaftar: {terdaftarMember.length} member / {totalHarianGuest} harian & guest
        <span style={{ fontSize: 10 }}> (total {totalTerisi}/{sesi.kuota_total})</span>
      </p>
      <div style={{ margin: '4px 0 14px' }}>
        <div style={{ height: 6, borderRadius: 999, background: '#ffffff1a', overflow: 'hidden' }}>
          <div
            style={{
              height: '100%', borderRadius: 999,
              width: `${barSiap ? persenTerisi : 0}%`,
              background: slotKosong === 0 ? '#b5493a' : '#e8b64c',
              transition: 'width 0.9s cubic-bezier(0.22, 0.61, 0.36, 1)',
            }}
          />
        </div>
        <div className="card-row" style={{ marginTop: 8 }}>
          <span className="subtle" style={{ fontSize: 11 }}>
            {totalTerisi}/{sesi.kuota_total} terisi · {slotKosong} slot kosong{jumlahWaiting > 0 ? ` · ${jumlahWaiting} waiting list` : ''}
          </span>
          <button className="secondary" style={{ padding: '5px 12px' }} onClick={bagikanWA}>Bagikan ke WhatsApp</button>
        </div>
      </div>
      {sesiBerakhir && <p className="badge done" style={{ display: 'inline-block', marginBottom: 10 }}>Sesi sudah berakhir (lewat jam 10:00) — kontrol admin dikunci</p>}
      {msg && <p className="error">{msg}</p>}

      <HeaderCollapse terbuka={bukaMember} onToggle={() => setBukaMember(!bukaMember)}>
        Terdaftar — Member ({terdaftarMember.length}/{totalMemberSesi})
      </HeaderCollapse>
      {bukaMember && (
        <ListPeserta items={terdaftarMember} profiles={profiles} isAdmin={bisaAdminKontrol} onHadir={hadirGabungan} onTandai={tandaiHadir} onBatalkan={batalkanAdmin} onRalat={ralatHadir} />
      )}

      <HeaderCollapse terbuka={bukaHarian} onToggle={() => setBukaHarian(!bukaHarian)}>
        Terdaftar — Harian ({terdaftarHarian.length})
      </HeaderCollapse>
      {bukaHarian && (
        <ListPeserta items={terdaftarHarian} profiles={profiles} isAdmin={bisaAdminKontrol} onHadir={hadirGabungan} onTandai={tandaiHadir} onBatalkan={batalkanAdmin} onRalat={ralatHadir} />
      )}

      <HeaderCollapse terbuka={bukaGuest} onToggle={() => setBukaGuest(!bukaGuest)}>
        Guest ({terdaftarGuest.length})
      </HeaderCollapse>
      {bukaGuest && (
        <>
          <p className="subtle" style={{ fontSize: 11 }}>Pemain dadakan yang ditambahkan langsung oleh admin, tanpa perlu akun. Ikut kena tagihan sama seperti harian saat ditandai Hadir.</p>
          <ListPeserta items={terdaftarGuest} profiles={profiles} isAdmin={bisaAdminKontrol} onHadir={hadirGabungan} onTandai={tandaiHadir} onBatalkan={batalkanAdmin} onRalat={ralatHadir} />
        </>
      )}
      {isAdmin && (
        <form className="card" onSubmit={tambahGuest} style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <label style={{ marginTop: 0 }}>Nama guest baru</label>
            <input value={namaGuestBaru} onChange={(e) => setNamaGuestBaru(e.target.value)} placeholder="misal: Teman si Andi" />
          </div>
          <button type="submit" disabled={!bisaAdminKontrol}>Tambah Guest</button>
        </form>
      )}

      {(waitingMember.length > 0 || waitingHarian.length > 0) && (
        <>
          <h2>Waiting List (Sesi)</h2>
          {waitingMember.map((p, idx) => (
            <div className="card" key={p.id}>
              <div className="card-row">
                <span>#{idx + 1} {namaPeserta(p, profiles)} <span className="badge">member</span></span>
                {bisaAdminKontrol && <button className="secondary" onClick={() => promosikan(p.id)}>Naikkan</button>}
              </div>
            </div>
          ))}
          {waitingHarian.map((p, idx) => (
            <div className="card" key={p.id}>
              <div className="card-row">
                <span>#{idx + 1} {namaPeserta(p, profiles)} <span className="badge">harian</span></span>
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
              const terpilihDiLapanganLain = new Set(
                Object.entries(pilihanPerLapangan).filter(([k]) => k !== kode).flatMap(([, ids]) => ids)
              );
              const antrianBuatKartuIni = antrianMenunggu.filter((p) => !terpilihDiLapanganLain.has(p.id));

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
                            {namaPeserta(p, profiles)} <span className="subtle" style={{ fontSize: 12 }}>({p.jumlah_game}x sebelumnya)</span>
                          </div>
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button disabled={!bisaAdminKontrol} onClick={() => selesaiMain(kode)}>Selesai Main</button>
                        <button className="secondary" disabled={!bisaAdminKontrol} onClick={() => batalMain(kode)}>Batal</button>
                      </div>
                    </>
                  )}

                  {kosong && (
                    <>
                      <p className="subtle" style={{ fontSize: 12, margin: '0 0 6px' }}>Pilih dari antrian:</p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                        {antrianBuatKartuIni.length === 0 && <span className="subtle" style={{ fontSize: 13 }}>Antrian kosong.</span>}
                        {antrianBuatKartuIni.map((p) => {
                          const terpilih = (pilihanPerLapangan[kode] || []).includes(p.id);
                          return (
                            <button
                              key={p.id} type="button" className={terpilih ? '' : 'secondary'}
                              style={{ fontSize: 13, padding: '6px 10px' }}
                              onClick={() => togglePilihan(kode, p.id)}
                            >
                              {namaPeserta(p, profiles)}
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

          <HeaderCollapse terbuka={bukaAntrian} onToggle={() => setBukaAntrian(!bukaAntrian)}>
            Antrian Menunggu ({antrianMenunggu.length})
          </HeaderCollapse>
          {bukaAntrian && (
            <>
              {antrianMenunggu.length === 0 && <div className="empty">Tidak ada yang sedang menunggu.</div>}
              {antrianMenunggu.map((p, idx) => (
                <div className="card" key={p.id}>
                  <div className="card-row">
                    <span>{idx + 1}. {namaPeserta(p, profiles)} — {p.jumlah_game}x main</span>
                    <span className="badge">sejak {new Date(p.waktu_checkin).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' })} WIB</span>
                  </div>
                </div>
              ))}
            </>
          )}

          {belumCheckin.length > 0 && (
            <>
              <h2>Belum Check-in</h2>
              {belumCheckin.map((p) => (
                <div className="card" key={p.id}>
                  <div className="card-row">
                    <span>{namaPeserta(p, profiles)}</span>
                    {p.status_hadir === 'no_show' ? (
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <span className="badge warn">Tidak Hadir</span>
                        {bisaAdminKontrol && <button className="secondary" onClick={() => ralatHadir(p.id)}>Ralat</button>}
                      </div>
                    ) : (
                      <button className="secondary" disabled={!bisaAdminKontrol} onClick={() => hadirGabungan(p.id)}>Hadir</button>
                    )}
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

function ListPeserta({ items, profiles, isAdmin, onHadir, onTandai, onBatalkan, onRalat }) {
  if (items.length === 0) return <div className="empty">Belum ada.</div>;
  return items.map((p) => {
    return (
      <div className="card" key={p.id}>
        <div className="card-row">
          <div>
            <strong>{namaPeserta(p, profiles)}</strong>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
              {p.waktu_checkin ? `Check-in ${new Date(p.waktu_checkin).toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB` : 'Belum check-in'}
              {' · '}{p.jumlah_game}x main
              {p.status_main === 'main' && p.lapangan_sekarang && ` · Sedang di ${p.lapangan_sekarang}`}
              {p.status_hadir && ` · ${p.status_hadir === 'hadir' ? 'Hadir' : 'Tidak Hadir'}`}
            </div>
          </div>
          {isAdmin && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {!p.status_hadir ? (
                <>
                  <button className="secondary" onClick={() => onHadir(p.id)}>Hadir</button>
                  <button className="danger" onClick={() => onTandai(p.id, 'no_show')}>Tidak Hadir</button>
                </>
              ) : (
                <button className="secondary" onClick={() => onRalat(p.id)}>Ralat</button>
              )}
              <button className="danger" onClick={() => onBatalkan(p.id)}>Cancel</button>
            </div>
          )}
        </div>
      </div>
    );
  });
}
