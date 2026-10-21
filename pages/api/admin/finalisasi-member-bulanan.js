import { supabaseAdmin, getProfileFromRequest, isAdmin } from '../../../lib/supabaseAdmin';
import { prosesSesiMember } from '../../../lib/memberBulanan';

// Dipanggil saat admin membuka halaman peserta konfirmasi member. Proses jalan SEKALI per sesi
// (setelah deadline). Membuka halaman bulan lama tidak mengubah apa pun.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const profile = await getProfileFromRequest(req);
  if (!isAdmin(profile)) return res.status(403).json({ error: 'Khusus admin' });

  const { sesi_member_bulanan_id } = req.body;
  if (!sesi_member_bulanan_id) return res.status(400).json({ error: 'sesi_member_bulanan_id wajib diisi' });

  const { data: sesi, error: errSesi } = await supabaseAdmin
    .from('sesi_member_bulanan').select('*').eq('id', sesi_member_bulanan_id).single();
  if (errSesi || !sesi) return res.status(404).json({ error: 'Sesi tidak ditemukan' });

  const hasil = await prosesSesiMember(sesi);
  if (hasil.error) {
    const pesan = String(hasil.error).includes('diproses_pada')
      ? 'Kolom diproses_pada belum ada. Jalankan migrasi_perbaikan_okt.sql di Supabase dulu.'
      : hasil.error;
    return res.status(500).json({ error: pesan });
  }
  return res.status(200).json({ ok: true, ...hasil });
}
