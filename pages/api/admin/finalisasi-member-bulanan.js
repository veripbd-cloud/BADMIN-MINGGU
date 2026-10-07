import { supabaseAdmin, getProfileFromRequest, isAdmin } from '../../../lib/supabaseAdmin';

const BULAN_KUARTAL_AKHIR = [12, 3, 6, 9];

function getQuarterInfo(bulan, tahun) {
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

async function cekEligibleQuarter(player_id, bulan, tahun) {
  const { months, isLastMonth } = getQuarterInfo(bulan, tahun);
  if (!isLastMonth) return false;
  for (const m of months) {
    const { data: sesiBulan } = await supabaseAdmin
      .from('sesi_member_bulanan').select('id').eq('bulan', m.bulan).eq('tahun', m.tahun).maybeSingle();
    if (!sesiBulan) return false;
    const { data: pendaftaran } = await supabaseAdmin
      .from('pendaftaran_member_bulanan').select('status_daftar')
      .eq('sesi_member_bulanan_id', sesiBulan.id).eq('player_id', player_id).maybeSingle();
    if (!pendaftaran || pendaftaran.status_daftar !== 'terdaftar') return false;
  }
  return true;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const profile = await getProfileFromRequest(req);
  if (!isAdmin(profile)) return res.status(403).json({ error: 'Khusus admin' });

  const { sesi_member_bulanan_id } = req.body;
  if (!sesi_member_bulanan_id) return res.status(400).json({ error: 'sesi_member_bulanan_id wajib diisi' });

  const { data: sesi } = await supabaseAdmin
    .from('sesi_member_bulanan').select('*').eq('id', sesi_member_bulanan_id).single();
  if (!sesi) return res.status(404).json({ error: 'Sesi tidak ditemukan' });

  if (new Date() <= new Date(sesi.deadline_daftar)) {
    return res.status(200).json({ ok: true, diturunkan: 0, subsidi: null, alasan: 'belum lewat deadline' });
  }

  const { data: semuaMember } = await supabaseAdmin.from('profiles').select('id').eq('tipe', 'member');
  const { data: yangTerdaftar } = await supabaseAdmin
    .from('pendaftaran_member_bulanan').select('player_id')
    .eq('sesi_member_bulanan_id', sesi_member_bulanan_id).eq('status_daftar', 'terdaftar');

  const idTerdaftar = new Set((yangTerdaftar || []).map((p) => p.player_id));
  const yangDiturunkan = (semuaMember || []).filter((m) => !idTerdaftar.has(m.id));
  for (const m of yangDiturunkan) {
    await supabaseAdmin.from('profiles').update({ tipe: 'harian' }).eq('id', m.id);
  }

  let hasilSubsidi = null;

  if (BULAN_KUARTAL_AKHIR.includes(sesi.bulan)) {
    const { data: hargaSetting } = await supabaseAdmin
      .from('pengaturan').select('value').eq('key', 'harga_member_bulanan').single();
    const hargaMember = parseInt(hargaSetting?.value || '100000', 10);

    const { data: biayaLapanganSetting } = await supabaseAdmin
      .from('pengaturan').select('value').eq('key', 'biaya_lapangan_bulanan').single();
    const biayaLapangan = parseInt(biayaLapanganSetting?.value || '2000000', 10);

    const { data: biayaBolaSetting } = await supabaseAdmin
      .from('pengaturan').select('value').eq('key', 'biaya_bola_bulan_ini').maybeSingle();
    const biayaBola = parseInt(biayaBolaSetting?.value || '0', 10);

    const { data: anggotaSekarang } = await supabaseAdmin.from('profiles').select('id').eq('tipe', 'member');

    const eligibleList = [];
    const tidakEligibleList = [];
    for (const m of anggotaSekarang || []) {
      const eligible = await cekEligibleQuarter(m.id, sesi.bulan, sesi.tahun);
      if (eligible) eligibleList.push(m); else tidakEligibleList.push(m);
    }

    const { data: transaksiBulanIni } = await supabaseAdmin
      .from('transaksi_kas').select('*')
      .gte('tanggal', `${sesi.tahun}-${String(sesi.bulan).padStart(2, '0')}-01`)
      .lte('tanggal', `${sesi.tahun}-${String(sesi.bulan).padStart(2, '0')}-31`);
    const totalMasukLain = (transaksiBulanIni || [])
      .filter((t) => t.jenis === 'pemasukan').reduce((sum, t) => sum + t.nominal, 0);

    const totalTidakEligible = tidakEligibleList.length * hargaMember;
    const sisaKas = totalMasukLain + totalTidakEligible - biayaBola - biayaLapangan;
    const totalKalau50 = eligibleList.length * (hargaMember / 2);

    let tier = null;
    if (eligibleList.length > 0) {
      tier = (sisaKas - totalKalau50 >= 0) ? 'gratis_100' : 'diskon_50';
    }

    for (const m of eligibleList) {
      const nominalBaru = tier === 'gratis_100' ? 0 : Math.floor(hargaMember / 2);

      await supabaseAdmin.from('tagihan_bulanan').upsert({
        player_id: m.id, bulan: sesi.bulan, tahun: sesi.tahun,
        nominal_tagihan: nominalBaru, tier_subsidi: tier,
        status_bayar: nominalBaru === 0 ? 'lunas' : 'belum_lunas',
      }, { onConflict: 'player_id,bulan,tahun' });

      const { data: pendaftaranBulanIni } = await supabaseAdmin
        .from('pendaftaran_member_bulanan').select('id')
        .eq('sesi_member_bulanan_id', sesi_member_bulanan_id).eq('player_id', m.id).maybeSingle();

      if (pendaftaranBulanIni) {
        const { data: outstandingLama } = await supabaseAdmin
          .from('outstanding').select('*')
          .eq('sumber', 'tagihan_bulanan_member').eq('referensi_id', pendaftaranBulanIni.id).maybeSingle();

        if (outstandingLama && outstandingLama.status === 'belum_lunas') {
          if (nominalBaru === 0) {
            await supabaseAdmin.from('outstanding').delete().eq('id', outstandingLama.id);
          } else {
            await supabaseAdmin.from('outstanding')
              .update({ nominal: nominalBaru, keterangan: `${outstandingLama.keterangan} (diskon 50% subsidi)` })
              .eq('id', outstandingLama.id);
          }
        }
      }
    }

    hasilSubsidi = {
      tier, jumlah_eligible: eligibleList.length, jumlah_tidak_eligible: tidakEligibleList.length,
      sisa_kas_dihitung: sisaKas,
    };
  }

  return res.status(200).json({ ok: true, diturunkan: yangDiturunkan.length, subsidi: hasilSubsidi });
}
