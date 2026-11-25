import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';
import { useAuth, getAccessToken } from '../../lib/useAuth';
import TopBar from '../../components/TopBar';
import Memuat from '../../components/Memuat';
import { tampilToast } from '../../components/Toast';
import { BilahAksi, DuaKolom, BarisKompak } from '../../components/DaftarPilih';
import { urutkanAZ } from '../../lib/aksiPeserta';

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
  const [calon, setCalon] = useState([]);
  const [memproses, setMemproses] = useState(false);
  const [bukaTambah, setBukaTambah] = useState(false);

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

    if (isAdmin) {
      const { data: semua } = await supabase
        .from('profiles').select('id, nama, tipe').eq('status_approval', 'approved').order('nama');
      const sudah = new Set((pendaftaranData || []).map((p) => p.player_id));
      setCalon((semua || []).filter((u) => !sudah.has(u.id)));
    }

    const ids = (pendaftaranData || []).map((p) => p.player_id);
    if (ids.length) {
      const { data: profilesData } = await supabase.from('profiles').select('*').in('id', ids);
      const map = {};
      (profilesData || []).forEach((pr) => { map[pr.id] = pr; });
      setProfiles(map);

      // Status tagihan hanya untuk admin, diambil lewat server
      if (isAdmin) {
        const token = await getAccessToken();
        const resO = await fetch(`/api/admin/outstanding-member-bulanan?sesi_member_bulanan_id=${id}`, {
          headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
        });
        const jsonO = await resO.json().catch(() => ({}));
        const oMap = {};
        (jsonO.outstanding || []).forEach((o) => { oMap[o.referensi_id] = o; });
        setOutstandingMap(oMap);
      }
    }
  }

  // Tambah BANYAK peserta sekaligus: satu permintaan ke server (bukan satu-satu)
  async function tambahPeserta(playerIds) {
    if (playerIds.length === 0) return false;
    setMemproses(true);
    setMsg('');
    const token = await getAccessToken();
    const res = await fetch('/api/admin/tambah-peserta-member', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ sesi_member_bulanan_id: id, player_ids: playerIds }),
    });
    const json = await res.json().catch(() => ({}));
    setMemproses(false);
    if (!res.ok) {
      const pesan = json.error || `Gagal menambah peserta (kode ${res.status})`;
      setMsg(pesan);
      tampilToast(pesan, 'error');
      return false;
    }
    if (json.berhasil > 0) tampilToast(`${json.berhasil} peserta ditambahkan ✓`);
    if (json.gagal > 0) {
      const alasan = [...new Set((json.hasil || []).filter((h) => !h.ok).map((h) => h.error))].join('; ');
      setMsg(`${json.gagal} gagal ditambahkan: ${alasan}`);
      tampilToast(`${json.gagal} gagal ditambahkan`, 'error');
    }
    await load();
    return true;
  }

  // KOREKSI kesalahan admin: keluarkan peserta dari sesi ini (tagihan belum dibayar ikut dihapus)
  async function koreksiPeserta(playerIds) {
    if (playerIds.length === 0) return false;
    if (!confirm(`Koreksi ${playerIds.length} peserta? Mereka dikeluarkan dari sesi ini dan tagihan yang belum dibayar dihapus. (Yang sudah lunas tidak diubah.)`)) return false;
    setMemproses(true);
    setMsg('');
    const token = await getAccessToken();
    const res = await fetch('/api/admin/koreksi-peserta-member', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ sesi_member_bulanan_id: id, player_ids: playerIds }),
    });
    const json = await res.json().catch(() => ({}));
    setMemproses(false);
    if (!res.ok) {
      const pesan = json.error || `Gagal mengoreksi (kode ${res.status})`;
      setMsg(pesan);
      tampilToast(pesan, 'error');
      return false;
    }
    if (json.berhasil > 0) tampilToast(`${json.berhasil} peserta dikoreksi ✓`);
    if (json.gagal > 0) {
      const alasan = [...new Set((json.hasil || []).filter((h) => !h.ok).map((h) => h.error))].join('; ');
      setMsg(`${json.gagal} dilewati: ${alasan}`);
      tampilToast(`${json.gagal} dilewati`, 'error');
    }
    await load();
    return true;
  }

  useEffect(() => { load(); }, [id, isAdmin]);

  if (loading || !sesi) return <Memuat />;

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

      {isAdmin && (
        <div className="card">
          <div className="card-row" style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => setBukaTambah(!bukaTambah)}>
            <strong>Tambah peserta ({calon.length} calon)</strong>
            <span style={{ fontSize: 12, lineHeight: 1 }}>{bukaTambah ? '▲' : '▼'}</span>
          </div>
          {bukaTambah && (
            <>
              <p className="subtle" style={{ fontSize: 11, margin: '8px 0 10px' }}>
                Pilih satu atau banyak pemain sekaligus (admin tetap boleh walau deadline sudah lewat). Tagihan iuran
                otomatis muncul di Kas; tandai lunas di sana (harian otomatis naik jadi member).
              </p>
              <DaftarCalon calon={calon} sibuk={memproses} onTambah={tambahPeserta} />
            </>
          )}
        </div>
      )}

      <h2>Daftar Peserta ({pendaftaran.length})</h2>
      <DaftarPesertaBulanan
        items={pendaftaran}
        profiles={profiles}
        outstandingMap={outstandingMap}
        bisaKontrol={!!isAdmin}
        sibuk={memproses}
        onKoreksi={koreksiPeserta}
      />
      <p className="subtle" style={{ marginTop: 16 }}>
        Buat tandain lunas, prosesnya di halaman <strong>Kas & Shuttlecock</strong> (bagian Outstanding).
      </p>
    </div>
  );
}

// Calon peserta: cari nama, pilih banyak, lalu Tambah
function DaftarCalon({ calon, sibuk, onTambah }) {
  const [cari, setCari] = useState('');
  const [pilihan, setPilihan] = useState(() => new Set());

  if (calon.length === 0) return <div className="empty">Semua pemain sudah terdaftar.</div>;

  const tampil = urutkanAZ(calon.filter((u) => (u.nama || '').toLowerCase().includes(cari.trim().toLowerCase())), (u) => u.nama || '');
  const terpilih = calon.filter((u) => pilihan.has(u.id));
  const semua = tampil.length > 0 && tampil.every((u) => pilihan.has(u.id));

  function toggle(id) {
    setPilihan((lama) => {
      const baru = new Set(lama);
      if (baru.has(id)) baru.delete(id); else baru.add(id);
      return baru;
    });
  }
  function toggleSemua() {
    setPilihan((lama) => {
      const baru = new Set(lama);
      if (semua) tampil.forEach((u) => baru.delete(u.id)); else tampil.forEach((u) => baru.add(u.id));
      return baru;
    });
  }
  async function jalankan() {
    const dijalankan = await onTambah(terpilih.map((u) => u.id));
    if (dijalankan) setPilihan(new Set());
  }

  return (
    <div>
      <input placeholder="Cari nama…" value={cari} onChange={(e) => setCari(e.target.value)} style={{ marginBottom: 10 }} />
      <BilahAksi
        semuaTerpilih={semua}
        onToggleSemua={toggleSemua}
        ringkasan={sibuk ? 'Memproses…' : terpilih.length > 0 ? `${terpilih.length} dipilih` : 'Pilih semua'}
      >
        <button style={{ padding: '6px 12px' }} disabled={sibuk || terpilih.length === 0} onClick={jalankan}>Tambah</button>
      </BilahAksi>
      {tampil.length === 0 && <div className="empty">Tidak ada yang cocok.</div>}
      <DuaKolom
        grup={[
          { kunci: 'member', judul: 'Member', garis: '#9ed6b0', data: tampil.filter((u) => u.tipe === 'member') },
          { kunci: 'harian', judul: 'Harian', garis: '#ffffff33', data: tampil.filter((u) => u.tipe !== 'member') },
        ].filter((g) => g.data.length > 0)}
        renderBaris={(u, g) => (
          <BarisKompak label={u.nama} terpilih={pilihan.has(u.id)} bisaPilih onToggle={() => toggle(u.id)} garis={g.garis} />
        )}
      />
    </div>
  );
}

// Peserta sesi ini. Admin: kotak centang + tombol Koreksi (untuk kesalahan isi), dikelompokkan menurut status bayar.
function DaftarPesertaBulanan({ items, profiles, outstandingMap, bisaKontrol, sibuk, onKoreksi }) {
  const [pilihan, setPilihan] = useState(() => new Set());
  if (items.length === 0) return <div className="empty">Belum ada yang daftar.</div>;

  const terpilihList = items.filter((p) => pilihan.has(p.id));
  const semua = terpilihList.length === items.length;
  const statusBayar = (p) => {
    const o = outstandingMap[p.id];
    if (!o) return 'tanpa';
    return o.status === 'lunas' ? 'lunas' : 'belum';
  };
  const definisi = [
    { kunci: 'belum', judul: 'Belum lunas', warna: '#e8988c', garis: '#b5493a' },
    { kunci: 'lunas', judul: 'Lunas', warna: '#9ed6b0', garis: '#9ed6b0' },
    { kunci: 'tanpa', judul: 'Tanpa tagihan', warna: undefined, garis: '#ffffff33' },
  ];
  const namaDari = (p) => profiles[p.player_id]?.nama || '';
  const grup = bisaKontrol
    ? definisi.map((g) => ({ ...g, data: urutkanAZ(items.filter((p) => statusBayar(p) === g.kunci), namaDari) })).filter((g) => g.data.length > 0)
    : [{ kunci: 'semua', judul: null, warna: undefined, garis: '#ffffff33', data: urutkanAZ(items, namaDari) }];

  function toggle(id) {
    setPilihan((lama) => {
      const baru = new Set(lama);
      if (baru.has(id)) baru.delete(id); else baru.add(id);
      return baru;
    });
  }
  async function jalankan() {
    const dijalankan = await onKoreksi(terpilihList.map((p) => p.player_id));
    if (dijalankan) setPilihan(new Set());
  }

  return (
    <div style={{ marginBottom: 8 }}>
      {bisaKontrol && (
        <BilahAksi
          semuaTerpilih={semua}
          onToggleSemua={() => setPilihan(semua ? new Set() : new Set(items.map((p) => p.id)))}
          ringkasan={sibuk ? 'Memproses…' : terpilihList.length > 0 ? `${terpilihList.length} dipilih` : 'Pilih semua'}
        >
          <button className="danger" style={{ padding: '6px 12px' }} disabled={sibuk || terpilihList.length === 0} onClick={jalankan}>Koreksi</button>
        </BilahAksi>
      )}
      <DuaKolom
        grup={grup}
        renderBaris={(p, g) => (
          <BarisKompak
            label={namaDari(p) || '—'}
            terpilih={pilihan.has(p.id)}
            bisaPilih={bisaKontrol}
            onToggle={() => toggle(p.id)}
            garis={g.garis}
          />
        )}
      />
    </div>
  );
}
