import { supabaseAdmin, getProfileFromRequest, isAdmin } from '../../../lib/supabaseAdmin';
import { hitungTagihanMember, buatOutstandingIuran } from '../../../lib/memberBulanan';

// Admin menambah peserta ke sesi konfirmasi member (misal yang telat daftar setelah deadline).
// Lewat jalur yang sama dengan pendaftaran biasa: tagihan iuran (harga normal/subsidi sesuai riwayat)
// muncul di Kas, lalu ditandai lunas di sana (harian otomatis naik jadi member).
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const profile = await getProfileFromRequest(req);
  if (!isAdmin(profile)) return res.status(403).json({ error: 'Khusus admin' });

  const { sesi_member_bulanan_id, player_id } = req.body || {};
  if (!sesi_member_bulanan_id || !player_id) {
    return res.status(400).json({ error: 'sesi_member_bulanan_id dan player_id wajib diisi' });
  }

  const { data: sesi } = await supabaseAdmin
    .from('sesi_member_bulanan').select('*').eq('id', sesi_member_bulanan_id).single();
  if (!sesi) return res.status(404).json({ error: 'Sesi tidak ditemukan' });

  const { data: pemain } = await supabaseAdmin
    .from('profiles').select('id').eq('id', player_id).maybeSingle();
  if (!pemain) return res.status(404).json({ error: 'Pemain tidak ditemukan' });

  const { data: lama } = await supabaseAdmin
    .from('pendaftaran_member_bulanan').select('*')
    .eq('sesi_member_bulanan_id', sesi_member_bulanan_id).eq('player_id', player_id).maybeSingle();
  if (lama && lama.status_daftar === 'terdaftar') {
    return res.status(400).json({ error: 'Pemain ini sudah terdaftar di sesi tersebut.' });
  }

  const tagihan = await hitungTagihanMember(player_id, sesi);
  if (tagihan.error) return res.status(400).json({ error: tagihan.error });

  let baru;
  if (lama) {
    const { data } = await supabaseAdmin
      .from('pendaftaran_member_bulanan')
      .update({ status_daftar: 'terdaftar', waktu_daftar: new Date().toISOString() })
      .eq('id', lama.id).select().single();
    baru = data;
  } else {
    const { data } = await supabaseAdmin
      .from('pendaftaran_member_bulanan')
      .insert({ sesi_member_bulanan_id, player_id, status_daftar: 'terdaftar' })
      .select().single();
    baru = data;
  }
  if (!baru) return res.status(500).json({ error: 'Gagal menyimpan pendaftaran.' });

  try {
    await buatOutstandingIuran({ pendaftaran: baru, player_id, sesi, nominal: tagihan.nominal, subsidi: tagihan.subsidi });
  } catch (e) {
    if (lama) {
      await supabaseAdmin.from('pendaftaran_member_bulanan').update({ status_daftar: 'batal' }).eq('id', baru.id);
    } else {
      await supabaseAdmin.from('pendaftaran_member_bulanan').delete().eq('id', baru.id);
    }
    return res.status(500).json({ error: 'Gagal membuat tagihan iuran: ' + e.message });
  }

  return res.status(200).json({ data: baru, nominal: tagihan.nominal, subsidi: tagihan.subsidi });
}
