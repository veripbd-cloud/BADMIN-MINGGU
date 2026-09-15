import { supabaseAdmin, getProfileFromRequest, isAdmin } from '../../../lib/supabaseAdmin';

// Kuartal TETAP dimulai Oktober: Okt-Nov-Des, Jan-Feb-Mar, Apr-Mei-Jun, Jul-Agu-Sep.
// Return: { months: [{bulan,tahun} x3], isLastMonth: bool } — subsidi cuma dihitung
// di bulan TERAKHIR tiap kuartal (Des, Mar, Jun, Sep).
function getQuarterInfo(bulan, tahun) {
  const idxDariOkt = (bulan - 10 + 12) % 12; // Okt=0, Nov=1, ..., Sep=11
  const posDiKuartal = idxDariOkt % 3; // 0,1,2 -> posisi bulan ini di kuartalnya
  const months = [];
  for (let i = -posDiKuartal; i <= (2 - posDiKuartal); i++) {
    let m = bulan + i;
    let y = tahun;
    while (m > 12) { m -= 12; y += 1; }
    while (m < 1) { m += 12; y -= 1; }
    months.push({ bulan: m, tahun: y });
  }
  return { months, isLastMonth: posDiKuartal === 2 };
}

// Eligible subsidi kalau: ini bulan TERAKHIR kuartal, DAN member itu "terdaftar" (gak batal)
// di sesi konfirmasi member bulanan buat KETIGA bulan di kuartal itu.
async function cekEligibleQuarter(player_id, bulan, tahun) {
  const { months, isLastMonth } = getQuarterInfo(bulan, tahun);
  if (!isLastMonth) return false;

  for (const m of months) {
    const { data: sesiBulan } = await supabaseAdmin
      .from('sesi_member_bulanan')
      .select('id')
      .eq('bulan', m.bulan)
      .eq('tahun', m.tahun)
      .maybeSingle();
    if (!sesiBulan) return false; // sesi konfirmasi bulan itu belum pernah dibuka

    const { data: pendaftaran } = await supabaseAdmin
      .from('pendaftaran_member_bulanan')
      .select('status_daftar')
      .eq('sesi_member_bulanan_id', sesiBulan.id)
      .eq('player_id', player_id)
      .maybeSingle();
    if (!pendaftaran || pendaftaran.status_daftar !== 'terdaftar') return false;
  }
  return true;
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
    const eligible = await cekEligibleQuarter(m.id, bulan, tahun);
    if (eligible) {
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
