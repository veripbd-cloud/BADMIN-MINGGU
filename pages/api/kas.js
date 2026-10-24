import { supabaseAdmin, getProfileFromRequest, isAdmin } from '../../lib/supabaseAdmin';

const HALAMAN = 30;
const UKURAN_CHUNK = 1000; // batas Supabase per permintaan; diambil bertahap supaya tidak ada yang terlewat

async function ambilSemuaTransaksi() {
  const semua = [];
  for (let dari = 0; dari < 500000; dari += UKURAN_CHUNK) {
    const { data, error } = await supabaseAdmin
      .from('transaksi_kas')
      .select('id, tanggal, created_at, jenis, nominal, keterangan, player_id, nama_guest')
      .order('tanggal', { ascending: true })
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(dari, dari + UKURAN_CHUNK - 1);
    if (error) throw new Error(error.message);
    semua.push(...(data || []));
    if (!data || data.length < UKURAN_CHUNK) break;
  }
  return semua;
}

// Kas: cuma untuk member dan admin. Saldo dihitung dari SEMUA transaksi (tanpa batas baris);
// yang dikirim ke halaman hanya 30 baris per permintaan, lengkap dengan saldo setelah tiap baris.
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  if (req.method !== 'GET') return res.status(405).end();

  const profile = await getProfileFromRequest(req);
  if (!profile) return res.status(401).json({ error: 'Belum login' });
  if (!(profile.tipe === 'member' || isAdmin(profile))) {
    return res.status(403).json({ error: 'Halaman kas khusus member' });
  }

  let semua;
  try {
    semua = await ambilSemuaTransaksi();
  } catch (e) {
    return res.status(500).json({ error: 'Gagal membaca kas: ' + e.message });
  }

  // Urut dari yang terlama; hitung saldo berjalan dan saldo awal/akhir tiap hari
  let saldo = 0;
  const hariInfo = {};
  const berjalan = semua.map((t) => {
    const delta = t.jenis === 'pemasukan' ? t.nominal : -t.nominal;
    if (!hariInfo[t.tanggal]) hariInfo[t.tanggal] = { awal: saldo, akhir: saldo };
    saldo += delta;
    hariInfo[t.tanggal].akhir = saldo;
    return { ...t, saldo_setelah: saldo };
  });

  const offset = Math.max(0, parseInt(req.query?.offset || '0', 10) || 0);
  const terbaruDulu = [...berjalan].reverse();
  const halaman = terbaruDulu.slice(offset, offset + HALAMAN);

  const ids = [...new Set(halaman.map((t) => t.player_id).filter(Boolean))];
  const nama = {};
  if (ids.length) {
    const { data: pemain } = await supabaseAdmin.from('profiles').select('id, nama').in('id', ids);
    (pemain || []).forEach((p) => { nama[p.id] = p.nama; });
  }

  const hari = {};
  halaman.forEach((t) => { hari[t.tanggal] = hariInfo[t.tanggal]; });

  return res.status(200).json({
    saldo,
    total: berjalan.length,
    offset,
    ada_lagi: offset + HALAMAN < berjalan.length,
    hari,
    transaksi: halaman.map((t) => ({
      id: t.id,
      tanggal: t.tanggal,
      jenis: t.jenis,
      nominal: t.nominal,
      keterangan: t.keterangan,
      pemain: t.player_id ? (nama[t.player_id] || null) : (t.nama_guest || null),
      saldo_setelah: t.saldo_setelah,
    })),
  });
}
