import { supabaseAdmin, getProfileFromRequest, isAdmin } from '../../../lib/supabaseAdmin';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const profile = await getProfileFromRequest(req);
  if (!isAdmin(profile)) return res.status(403).json({ error: 'Khusus admin' });

  const { outstanding_id } = req.body;
  const { data: outstanding } = await supabaseAdmin
    .from('outstanding')
    .select('*')
    .eq('id', outstanding_id)
    .single();

  if (!outstanding) return res.status(404).json({ error: 'Tidak ditemukan' });

  if (outstanding.status === 'lunas') {
    // Sudah pernah diproses (misal klik dobel) -> jangan catat transaksi lagi
    return res.status(200).json({ ok: true, sudahLunasSebelumnya: true });
  }

  // Update KONDISIONAL: hanya berhasil kalau statusnya masih 'belum_lunas' saat ini juga.
  // Ini mencegah race condition kalau tombol keklik dobel hampir bersamaan.
  const { data: hasilUpdate, error: updateError } = await supabaseAdmin
    .from('outstanding')
    .update({ status: 'lunas', tanggal_lunas: new Date().toISOString() })
    .eq('id', outstanding_id)
    .eq('status', 'belum_lunas')
    .select();

  if (updateError) return res.status(500).json({ error: updateError.message });

  // Kalau tidak ada baris yang ke-update (karena klik lain barusan sudah lebih dulu memprosesnya),
  // jangan catat transaksi kas lagi.
  if (!hasilUpdate || hasilUpdate.length === 0) {
    return res.status(200).json({ ok: true, sudahLunasSebelumnya: true });
  }

  await supabaseAdmin.from('transaksi_kas').insert({
    jenis: 'pemasukan',
    kategori: 'pelunasan_outstanding',
    nominal: outstanding.nominal,
    keterangan: `Pelunasan outstanding: ${outstanding.keterangan || ''}`,
    player_id: outstanding.player_id,
    input_by: profile.id,
  });

  return res.status(200).json({ ok: true });
}
