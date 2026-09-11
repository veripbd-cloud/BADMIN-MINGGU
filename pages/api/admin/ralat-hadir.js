import { supabaseAdmin, getProfileFromRequest, isAdmin } from '../../../lib/supabaseAdmin';

// Buat kasus salah pencet (misal admin gak sengaja klik "Hadir"/"Tidak Hadir").
// Ini reset status_hadir balik kosong, DAN hapus outstanding terkait KALAU BELUM DIBAYAR.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const profile = await getProfileFromRequest(req);
  if (!isAdmin(profile)) return res.status(403).json({ error: 'Khusus admin' });

  const { pendaftaran_id } = req.body;
  if (!pendaftaran_id) return res.status(400).json({ error: 'pendaftaran_id wajib diisi' });

  const { error } = await supabaseAdmin
    .from('pendaftaran_sesi')
    .update({ status_hadir: null })
    .eq('id', pendaftaran_id);

  if (error) return res.status(500).json({ error: error.message });

  // Hapus outstanding yang tercatat dari penandaan hadir/tidak-hadir ini, KALAU belum dibayar.
  // Kalau udah lunas (udah kebayar & tercatat masuk kas), TIDAK dihapus otomatis.
  await supabaseAdmin
    .from('outstanding')
    .delete()
    .eq('sumber', 'tagihan_harian')
    .eq('referensi_id', pendaftaran_id)
    .eq('status', 'belum_lunas');

  return res.status(200).json({ ok: true });
}
