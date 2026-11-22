import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';
import { useAuth, getAccessToken } from '../../lib/useAuth';
import TopBar from '../../components/TopBar';
import Memuat from '../../components/Memuat';
import { tampilToast } from '../../components/Toast';
import { kelompokkanPeserta, bisaDiaksi, jalankanBerbatas } from '../../lib/aksiPeserta';

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
  const [memproses, setMemproses] = useState(false);

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

  async function promosikan(pendaftaran_id) {
    await apiCall('/api/admin/promosikan-manual', { pendaftaran_id }, 'Dinaikkan dari waiting list ✓');
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

  // Jalankan satu aksi untuk BANYAK peserta sekaligus (dipilih lewat kotak centang).
  // Mengembalikan true kalau aksinya dijalankan, false kalau dibatalkan lewat konfirmasi.
  async function jalankanAksi(aksi, ids) {
    const sasaran = semuaTerdaftar.filter((p) => ids.includes(p.id) && bisaDiaksi(aksi, p));
    const dilewati = ids.length - sasaran.length;
    if (sasaran.length === 0) {
      tampilToast('Tidak ada yang bisa diproses untuk aksi ini', 'error');
      return false;
    }

    // Konfirmasi "yakin?" dipertahankan untuk Cancel (dan Ralat)
    if (aksi === 'cancel' && !confirm(`Batalkan ${sasaran.length} pendaftaran? Slot akan otomatis dicoba diberikan ke waiting list.`)) return false;
    if (aksi === 'ralat' && !confirm(`Ralat status ${sasaran.length} orang? Outstanding yang belum dibayar (kalau ada) akan ikut dihapus.`)) return false;

    setMemproses(true);
    setMsg('');

    const satu = async (pid) => {
      if (aksi === 'hadir') {
        const a = await apiCall('/api/admin/checkin', { pendaftaran_id: pid });
        if (!a.ok) return false;
        const b = await apiCall('/api/admin/tandai-hadir', { pendaftaran_id: pid, status_hadir: 'hadir' });
        return b.ok;
      }
      if (aksi === 'tidak_hadir') return (await apiCall('/api/admin/tandai-hadir', { pendaftaran_id: pid, status_hadir: 'no_show' })).ok;
      if (aksi === 'ralat') return (await apiCall('/api/admin/ralat-hadir', { pendaftaran_id: pid })).ok;
      return (await apiCall('/api/admin/batalkan-pendaftaran', { pendaftaran_id: pid })).ok;
    };

    // Cancel satu per satu (tiap cancel menaikkan waiting list, jangan balapan); lainnya 4 sekaligus
    const hasil = await jalankanBerbatas(sasaran.map((p) => p.id), aksi === 'cancel' ? 1 : 4, satu);
    const berhasil = hasil.filter(Boolean).length;
    setMemproses(false);

    const kata = { hadir: 'ditandai hadir', tidak_hadir: 'ditandai tidak hadir', ralat: 'diralat', cancel: 'dibatalkan' }[aksi];
    if (berhasil > 0) tampilToast(`${berhasil} orang ${kata} ✓${dilewati > 0 ? ` (${dilewati} dilewati)` : ''}`);
    if (berhasil < sasaran.length) tampilToast(`${sasaran.length - berhasil} gagal diproses`, 'error');
    await load();
    return true;
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
        <DaftarPeserta items={terdaftarMember} profiles={profiles} bisaKontrol={bisaAdminKontrol} sibuk={memproses} onAksi={jalankanAksi} />
      )}

      <HeaderCollapse terbuka={bukaHarian} onToggle={() => setBukaHarian(!bukaHarian)}>
        Terdaftar — Harian ({terdaftarHarian.length})
      </HeaderCollapse>
      {bukaHarian && (
        <DaftarPeserta items={terdaftarHarian} profiles={profiles} bisaKontrol={bisaAdminKontrol} sibuk={memproses} onAksi={jalankanAksi} />
      )}

      <HeaderCollapse terbuka={bukaGuest} onToggle={() => setBukaGuest(!bukaGuest)}>
        Guest ({terdaftarGuest.length})
      </HeaderCollapse>
      {bukaGuest && (
        <>
          <p className="subtle" style={{ fontSize: 11 }}>Pemain dadakan yang ditambahkan langsung oleh admin, tanpa perlu akun. Ikut kena tagihan sama seperti harian saat ditandai Hadir.</p>
          <DaftarPeserta items={terdaftarGuest} profiles={profiles} bisaKontrol={bisaAdminKontrol} sibuk={memproses} onAksi={jalankanAksi} />
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
        </>
      )}
    </div>
  );
}

// Kotak centang sendiri (bukan input bawaan, karena gaya input global akan merusak bentuknya)
function KotakCentang({ aktif }) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: 18, height: 18, flex: 'none', borderRadius: 5,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        border: `1.5px solid ${aktif ? '#e8b64c' : '#ffffff66'}`,
        background: aktif ? '#e8b64c' : 'transparent',
        color: '#0d1a15', fontSize: 12, fontWeight: 700, lineHeight: 1,
        transition: 'background 0.15s, border-color 0.15s',
      }}
    >
      {aktif ? '✓' : ''}
    </span>
  );
}

function metaPeserta(p, kunci) {
  if (kunci === 'tidak') return 'Tidak hadir';
  if (kunci === 'sudah') {
    const jam = new Date(p.waktu_checkin).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' });
    const lapangan = p.status_main === 'main' && p.lapangan_sekarang ? ` · di ${p.lapangan_sekarang}` : '';
    return `${jam} · ${p.jumlah_game}x main${lapangan}`;
  }
  return p.jumlah_game > 0 ? `${p.jumlah_game}x main` : '';
}

// Daftar peserta ala Gmail: tombol aksi di atas, kotak centang per nama, bisa pilih banyak sekaligus.
function DaftarPeserta({ items, profiles, bisaKontrol, sibuk, onAksi }) {
  const [pilihan, setPilihan] = useState(() => new Set());
  if (items.length === 0) return <div className="empty">Belum ada.</div>;

  const terpilihList = items.filter((p) => pilihan.has(p.id));
  const jumlahTerpilih = terpilihList.length;
  const semuaTerpilih = jumlahTerpilih === items.length;
  const adaHadir = terpilihList.some((p) => bisaDiaksi('hadir', p));
  const adaRalat = terpilihList.some((p) => bisaDiaksi('ralat', p));

  function toggle(id) {
    setPilihan((lama) => {
      const baru = new Set(lama);
      if (baru.has(id)) baru.delete(id); else baru.add(id);
      return baru;
    });
  }
  function toggleSemua() {
    setPilihan(semuaTerpilih ? new Set() : new Set(items.map((p) => p.id)));
  }
  async function jalankan(aksi) {
    const dijalankan = await onAksi(aksi, terpilihList.map((p) => p.id));
    if (dijalankan) setPilihan(new Set());
  }

  const { belum, sudah, tidakHadir } = kelompokkanPeserta(items);
  const grup = [
    { kunci: 'belum', judul: 'Belum check-in', data: belum, garis: '#ffffff33', redup: false },
    { kunci: 'sudah', judul: 'Sudah check-in', data: sudah, garis: '#9ed6b0', redup: false },
    { kunci: 'tidak', judul: 'Tidak hadir', data: tidakHadir, garis: '#b5493a', redup: true },
  ].filter((g) => g.data.length > 0);

  const tombol = { padding: '6px 12px' };

  return (
    <div style={{ marginBottom: 8 }}>
      {bisaKontrol && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '6px 2px 10px', marginBottom: 6, borderBottom: '1px solid #ffffff1a' }}>
          <div
            role="checkbox"
            aria-checked={semuaTerpilih}
            onClick={toggleSemua}
            style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}
          >
            <KotakCentang aktif={semuaTerpilih} />
            <span className="subtle" style={{ fontSize: 11 }}>
              {sibuk ? 'Memproses…' : jumlahTerpilih > 0 ? `${jumlahTerpilih} dipilih` : 'Pilih semua'}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginLeft: 'auto' }}>
            <button className="secondary" style={tombol} disabled={sibuk || !adaHadir} onClick={() => jalankan('hadir')}>Hadir</button>
            <button className="danger" style={tombol} disabled={sibuk || !adaHadir} onClick={() => jalankan('tidak_hadir')}>Tidak Hadir</button>
            <button className="secondary" style={tombol} disabled={sibuk || !adaRalat} onClick={() => jalankan('ralat')}>Ralat</button>
            <button className="danger" style={tombol} disabled={sibuk || jumlahTerpilih === 0} onClick={() => jalankan('cancel')}>Cancel</button>
          </div>
        </div>
      )}

      {grup.map((g) => (
        <div key={g.kunci}>
          <p className="subtle" style={{ fontSize: 11, fontWeight: 600, margin: '12px 0 6px' }}>{g.judul} ({g.data.length})</p>
          {g.data.map((p) => {
            const terpilih = pilihan.has(p.id);
            const meta = metaPeserta(p, g.kunci);
            return (
              <div
                key={p.id}
                role={bisaKontrol ? 'checkbox' : undefined}
                aria-checked={bisaKontrol ? terpilih : undefined}
                onClick={bisaKontrol ? () => toggle(p.id) : undefined}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
                  padding: '8px 12px', marginBottom: 6, borderRadius: 10,
                  border: `1px solid ${terpilih ? '#e8b64c' : '#ffffff1a'}`,
                  borderLeft: `3px solid ${terpilih ? '#e8b64c' : g.garis}`,
                  background: terpilih ? '#e8b64c26' : '#16302691',
                  cursor: bisaKontrol ? 'pointer' : 'default',
                  opacity: g.redup && !terpilih ? 0.7 : 1,
                  userSelect: 'none',
                  transition: 'background 0.15s, border-color 0.15s',
                }}
              >
                {bisaKontrol && <KotakCentang aktif={terpilih} />}
                <span style={{ flex: '1 1 auto', fontSize: 13, fontWeight: terpilih ? 700 : 500, color: terpilih ? '#e8b64c' : undefined }}>
                  {namaPeserta(p, profiles)}
                </span>
                {meta && (
                  <span style={{ marginLeft: 'auto', fontSize: 11, color: g.kunci === 'tidak' ? '#e8988c' : 'var(--muted)' }}>{meta}</span>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
