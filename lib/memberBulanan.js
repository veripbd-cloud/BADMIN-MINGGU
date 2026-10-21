import { supabaseAdmin } from './supabaseAdmin';

export const BULAN_KUARTAL_AKHIR = [12, 3, 6, 9];

// Kuartal TETAP dimulai Oktober: Okt-Nov-Des, Jan-Feb-Mar, Apr-Mei-Jun, Jul-Agu-Sep.
export function getQuarterInfo(bulan, tahun) {
  const idxDariOkt = (bulan - 10 + 12) % 12;
  const posDiKuartal = idxDariOkt % 3;
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

// Fungsi murni (gampang dites): tentukan nominal iuran.
// bulanTerdaftar = himpunan teks "tahun-bulan" untuk bulan SEBELUMNYA yang pemain ini terdaftar.
export function tentukanNominal({ bulan, tahun, bulanTerdaftar, hargaNormal, hargaSubsidi }) {
  if (!BULAN_KUARTAL_AKHIR.includes(bulan)) return { nominal: hargaNormal, subsidi: false };
  const { months } = getQuarterInfo(bulan, tahun);
  const sebelumnya = months.filter((m) => !(m.bulan === bulan && m.tahun === tahun));
  const eligible = sebelumnya.every((m) => bulanTerdaftar.has(`${m.tahun}-${m.bulan}`));
  return eligible ? { nominal: hargaSubsidi, subsidi: true } : { nominal: hargaNormal, subsidi: false };
}

async function ambilHarga() {
  const { data } = await supabaseAdmin
    .from('pengaturan').select('key, value').in('key', ['harga_member_bulanan', 'harga_member_subsidi']);
  const map = {};
  (data || []).forEach((r) => { map[r.key] = r.value; });
  const subsidiMentah = map.harga_member_subsidi;
  const kosong = subsidiMentah === undefined || subsidiMentah === null || String(subsidiMentah).trim() === '';
  return {
    hargaNormal: parseInt(map.harga_member_bulanan || '100000', 10),
    hargaSubsidi: kosong ? null : parseInt(subsidiMentah, 10),
  };
}

async function ambilBulanTerdaftar(player_id, months) {
  const tahunList = [...new Set(months.map((m) => m.tahun))];
  const { data: sesiList } = await supabaseAdmin
    .from('sesi_member_bulanan').select('id, bulan, tahun').in('tahun', tahunList);
  const cocok = (sesiList || []).filter((s) => months.some((m) => m.bulan === s.bulan && m.tahun === s.tahun));
  if (cocok.length === 0) return new Set();

  const { data: pendaftaran } = await supabaseAdmin
    .from('pendaftaran_member_bulanan').select('sesi_member_bulanan_id')
    .eq('player_id', player_id).eq('status_daftar', 'terdaftar')
    .in('sesi_member_bulanan_id', cocok.map((s) => s.id));
  const idTerdaftar = new Set((pendaftaran || []).map((p) => p.sesi_member_bulanan_id));

  const hasil = new Set();
  cocok.forEach((s) => { if (idTerdaftar.has(s.id)) hasil.add(`${s.tahun}-${s.bulan}`); });
  return hasil;
}

// Berapa yang harus ditagih ke pemain ini untuk sesi konfirmasi member ini?
export async function hitungTagihanMember(player_id, sesi) {
  const { hargaNormal, hargaSubsidi } = await ambilHarga();
  if (!BULAN_KUARTAL_AKHIR.includes(sesi.bulan)) return { nominal: hargaNormal, subsidi: false };

  if (hargaSubsidi === null) {
    return { error: 'Harga member bulanan (Subsidi) belum diisi admin di Pengaturan.' };
  }
  const { months } = getQuarterInfo(sesi.bulan, sesi.tahun);
  const bulanTerdaftar = await ambilBulanTerdaftar(player_id, months);
  return tentukanNominal({ bulan: sesi.bulan, tahun: sesi.tahun, bulanTerdaftar, hargaNormal, hargaSubsidi });
}

// Bikin outstanding iuran (kalau nominal 0 = gratis, gak perlu ditagih)
export async function buatOutstandingIuran({ pendaftaran, player_id, sesi, nominal, subsidi }) {
  if (nominal <= 0) return null;
  const { data: ada } = await supabaseAdmin
    .from('outstanding').select('id')
    .eq('sumber', 'tagihan_bulanan_member').eq('referensi_id', pendaftaran.id).maybeSingle();
  if (ada) return ada;

  const label = sesi.label || `${sesi.bulan}/${sesi.tahun}`;
  const { data, error } = await supabaseAdmin
    .from('outstanding')
    .insert({
      player_id,
      sumber: 'tagihan_bulanan_member',
      referensi_id: pendaftaran.id,
      nominal,
      keterangan: `Iuran member ${label}${subsidi ? ' (harga subsidi)' : ''}`,
      status: 'belum_lunas',
    })
    .select().single();
  if (error) throw new Error(error.message);
  return data;
}

// Proses SEKALI per sesi konfirmasi member: turunkan member yang tidak mendaftar jadi harian.
// Sesi yang sudah diproses / sudah ada sesi yang lebih baru = hanya untuk dilihat, tidak mengubah apa pun.
export async function prosesSesiMember(sesi) {
  if (sesi.diproses_pada) return { sudah: true, diturunkan: 0 };
  if (new Date() <= new Date(sesi.deadline_daftar)) return { belum: true, diturunkan: 0 };

  const { data: semuaSesi, error: errSesi } = await supabaseAdmin
    .from('sesi_member_bulanan').select('id, bulan, tahun');
  if (errSesi) return { error: errSesi.message };

  const sekarangIso = new Date().toISOString();
  const adaYangLebihBaru = (semuaSesi || []).some(
    (s) => s.tahun > sesi.tahun || (s.tahun === sesi.tahun && s.bulan > sesi.bulan)
  );

  const { data: klaim, error: errKlaim } = await supabaseAdmin
    .from('sesi_member_bulanan').update({ diproses_pada: sekarangIso })
    .eq('id', sesi.id).is('diproses_pada', null).select('id');
  if (errKlaim) return { error: errKlaim.message };
  if (!klaim || klaim.length === 0) return { sudah: true, diturunkan: 0 };
  if (adaYangLebihBaru) return { dilewati: true, diturunkan: 0 };

  const { data: semuaMember } = await supabaseAdmin.from('profiles').select('id').eq('tipe', 'member');
  const { data: terdaftar } = await supabaseAdmin
    .from('pendaftaran_member_bulanan').select('player_id')
    .eq('sesi_member_bulanan_id', sesi.id).eq('status_daftar', 'terdaftar');
  const idTerdaftar = new Set((terdaftar || []).map((p) => p.player_id));
  const ids = (semuaMember || []).filter((m) => !idTerdaftar.has(m.id)).map((m) => m.id);

  if (ids.length > 0) {
    const { error } = await supabaseAdmin.from('profiles').update({ tipe: 'harian' }).in('id', ids);
    if (error) {
      await supabaseAdmin.from('sesi_member_bulanan').update({ diproses_pada: null }).eq('id', sesi.id);
      return { error: error.message };
    }
  }
  return { diturunkan: ids.length };
}

// Dipanggil sebelum bikin sesi baru: pastikan status member sudah rapi. Gak boleh mengganggu proses utama.
export async function prosesSesiTertunggak() {
  try {
    const { data, error } = await supabaseAdmin
      .from('sesi_member_bulanan').select('*')
      .is('diproses_pada', null).lt('deadline_daftar', new Date().toISOString());
    if (error || !data || data.length === 0) return;
    const urut = [...data].sort((a, b) => a.tahun - b.tahun || a.bulan - b.bulan);
    for (const s of urut.slice(0, -1)) {
      await supabaseAdmin.from('sesi_member_bulanan')
        .update({ diproses_pada: new Date().toISOString() }).eq('id', s.id).is('diproses_pada', null);
    }
    await prosesSesiMember(urut[urut.length - 1]);
  } catch (e) { /* abaikan */ }
}
