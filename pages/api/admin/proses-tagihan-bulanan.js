import { supabaseAdmin, getProfileFromRequest, isAdmin } from '../../../lib/supabaseAdmin';

// Hitung berapa bulan berturut-turut SEBELUM (bulan, tahun) yang sudah lunas
// tanpa putus, DAN belum "dipakai" untuk siklus subsidi sebelumnya.
// Pendekatan: mundur bulan demi bulan dari (bulan-1, tahun) selama statusnya 'lunas'.
// Kalau ketemu bulan yang tier_subsidi-nya sudah 'diskon_50' atau 'gratis_100',
// berhenti di situ (siklus baru dimulai SETELAH bulan subsidi terakhir).
async function hitungBulanBerturutLunas(player_id, bulan, tahun) {
  let count = 0;
  let m = bulan - 1;
  let y = tahun;

  for (let i = 0; i < 24; i++) { // batas aman 24 bulan ke belakang
    if (m === 0) { m = 12; y -= 1; }

    const { data: tagihan } = await supabaseAdmin
      .from('tagihan_bulanan')
      .select('*')
      .eq('player_id', player_id)
      .eq('bulan', m)
      .eq('tahun', y)
      .maybeSingle();

    if (!tagihan || tagihan.status_bayar !== 'lunas') break;

    count += 1;

    if (tagihan.tier_subsidi === 'diskon_50' || tagihan.tier_subsidi === 'gratis_100') {
      break; // siklus reset setelah bulan yang sudah kena subsidi
    }

    m -= 1;
  }

  return count;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const profile = await getProfileFromRequest(req);
  if (!isAdmin(profile)) return res.status(403).json({ error: 'Khusus admin' });

  const { bulan, tahun, biaya_bola } = req.body; // biaya_bola: pengeluaran bola bulan ini (admin input manual)
  if (!bulan || !tahun) return res.status(400).json({ error: 'bulan & tahun wajib diisi' });

  const { data: settingHarga } = await supabaseAdmin
    .from('pengaturan')
    .select('value')
    .eq('key', 'harga_member_bulanan')
    .single();
  const hargaMember = parseInt(settingHarga?.value || '100000', 10);

  const { data: settingLapangan } = await supabaseAdmin
    .from('pengaturan')
    .select('value')
    .eq('key', 'biaya_lapangan_bulanan')
    .single();
  const biayaLapangan = parseInt(settingLapangan?.value || '2000000', 10);

  // Ambil semua member aktif
  const { data: members } = await supabaseAdmin
    .from('profiles')
    .select('id, nama, tipe, tanggal_daftar')
    .eq('tipe', 'member');

  const eligibleList = [];
  const tidakEligibleList = [];

  for (const m of members || []) {
    const bulanBerturut = await hitungBulanBerturutLunas(m.id, bulan, tahun);
    // Eligible kalau sudah genap 2 bulan berturut lunas sebelum bulan ini
    // (artinya bulan ini adalah bulan ke-3 dalam siklus)
    if (bulanBerturut >= 2) {
      eligibleList.push(m);
    } else {
      tidakEligibleList.push(m);
    }
  }

  // Total kas masuk bulan ini = pembayaran penuh dari member TIDAK eligible + estimasi harian
  // (harian dihitung dari transaksi_kas kategori iuran_harian bulan berjalan)
  const awalBulan = `${tahun}-${String(bulan).padStart(2, '0')}-01`;
  const akhirBulan = `${tahun}-${String(bulan).padStart(2, '0')}-31`;

  const { data: transaksiBulanIni } = await supabaseAdmin
    .from('transaksi_kas')
    .select('*')
    .gte('tanggal', awalBulan)
    .lte('tanggal', akhirBulan);

  const totalMasukLain = (transaksiBulanIni || [])
    .filter((t) => t.jenis === 'pemasukan')
    .reduce((sum, t) => sum + t.nominal, 0);

  const totalMemberTidakEligible = tidakEligibleList.length * hargaMember;
  const pengeluaranBola = parseInt(biaya_bola || 0, 10);

  // sisa_kas = seluruh pemasukan bulan ini (termasuk member yang bayar lunas) - bola - lapangan
  const sisaKas = totalMasukLain + totalMemberTidakEligible - pengeluaranBola - biayaLapangan;

  const totalKalau50 = eligibleList.length * (hargaMember / 2);

  let tierUntukEligible;
  if (eligibleList.length === 0) {
    tierUntukEligible = null;
  } else if (sisaKas - totalKalau50 >= 0) {
    tierUntukEligible = 'gratis_100';
  } else {
    tierUntukEligible = 'diskon_50';
  }

  const hasil = [];

  // Simpan tagihan untuk member TIDAK eligible (bayar penuh)
  for (const m of tidakEligibleList) {
    const { data: row } = await supabaseAdmin
      .from('tagihan_bulanan')
      .upsert({
        player_id: m.id,
        bulan, tahun,
        nominal_tagihan: hargaMember,
        tier_subsidi: 'tidak_eligible',
        status_bayar: 'belum_lunas',
      }, { onConflict: 'player_id,bulan,tahun' })
      .select()
      .single();
    hasil.push(row);
  }

  // Simpan tagihan untuk member ELIGIBLE (sesuai tier hasil hitung)
  for (const m of eligibleList) {
    const nominal = tierUntukEligible === 'gratis_100' ? 0 : Math.floor(hargaMember / 2);
    const { data: row } = await supabaseAdmin
      .from('tagihan_bulanan')
      .upsert({
        player_id: m.id,
        bulan, tahun,
        nominal_tagihan: nominal,
        tier_subsidi: tierUntukEligible,
        status_bayar: nominal === 0 ? 'lunas' : 'belum_lunas', // gratis = otomatis lunas
      }, { onConflict: 'player_id,bulan,tahun' })
      .select()
      .single();
    hasil.push(row);
  }

  return res.status(200).json({
    tier_untuk_eligible: tierUntukEligible,
    jumlah_eligible: eligibleList.length,
    jumlah_tidak_eligible: tidakEligibleList.length,
    sisa_kas_dihitung: sisaKas,
    tagihan: hasil,
  });
}
