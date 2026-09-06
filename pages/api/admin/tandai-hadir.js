import { supabaseAdmin, getProfileFromRequest, isAdmin } from '../../../lib/supabaseAdmin';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const profile = await getProfileFromRequest(req);
  if (!isAdmin(profile)) return res.status(403).json({ error: 'Khusus admin' });

  const { pendaftaran_id, status_hadir } = req.body; // 'hadir' | 'no_show'
  if (!['hadir', 'no_show'].includes(status_hadir)) {
    return res.status(400).json({ error: 'status_hadir tidak valid' });
  }

  const { data: pendaftaran } = await supabaseAdmin
    .from('pendaftaran_sesi')
    .select('*')
    .eq('id', pendaftaran_id)
    .single();

  if (!pendaftaran) return res.status(404).json({ error: 'Tidak ditemukan' });

  const { error } = await supabaseAdmin
    .from('pendaftaran_sesi')
    .update({ status_hadir })
    .eq('id', pendaftaran_id);

  if (error) return res.status(500).json({ error: error.message });

  // Aturan: no-show HARIAN -> kena outstanding Rp35rb (harga bisa berubah, ambil dari pengaturan)
  // no-show MEMBER -> tidak ada penalti finansial (sudah bayar flat bulanan)
  if (status_hadir === 'no_show' && pendaftaran.tipe_slot === 'harian') {
    const { data: hargaSetting } = await supabaseAdmin
      .from('pengaturan')
      .select('value')
      .eq('key', 'harga_harian')
      .single();

    const nominal = parseInt(hargaSetting?.value || '35000', 10);

    // Hindari duplikat outstanding kalau endpoint ini dipanggil ulang
    const { data: sudahAda } = await supabaseAdmin
      .from('outstanding')
      .select('id')
      .eq('sumber', 'no_show_harian')
      .eq('referensi_id', pendaftaran_id)
      .maybeSingle();

    if (!sudahAda) {
      await supabaseAdmin.from('outstanding').insert({
        player_id: pendaftaran.player_id,
        sumber: 'no_show_harian',
        referensi_id: pendaftaran_id,
        nominal,
        keterangan: 'Daftar sesi tapi tidak hadir & tidak batal sebelum deadline',
        status: 'belum_lunas',
      });
    }
  }

  return res.status(200).json({ ok: true });
}
