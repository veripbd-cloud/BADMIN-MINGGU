import { supabaseAdmin, getProfileFromRequest, isAdmin } from '../../../lib/supabaseAdmin';
import { koreksiPesertaMember } from '../../../lib/memberBulanan';
import { jalankanBerbatas } from '../../../lib/aksiPeserta';

// Koreksi kesalahan admin: keluarkan satu atau banyak peserta dari sesi konfirmasi member.
// Tagihan yang belum dibayar ikut dihapus; yang sudah lunas dilewati (dikoreksi lewat Kas).
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const profile = await getProfileFromRequest(req);
  if (!isAdmin(profile)) return res.status(403).json({ error: 'Khusus admin' });

  const { sesi_member_bulanan_id, player_ids } = req.body || {};
  const daftar = Array.isArray(player_ids) ? [...new Set(player_ids)] : [];
  if (!sesi_member_bulanan_id || daftar.length === 0) {
    return res.status(400).json({ error: 'sesi_member_bulanan_id dan player_ids wajib diisi' });
  }
  if (daftar.length > 200) return res.status(400).json({ error: 'Terlalu banyak sekaligus (maksimal 200)' });

  const { data: sesi } = await supabaseAdmin
    .from('sesi_member_bulanan').select('id').eq('id', sesi_member_bulanan_id).single();
  if (!sesi) return res.status(404).json({ error: 'Sesi tidak ditemukan' });

  const detail = {};
  await jalankanBerbatas(daftar, 4, async (pid) => {
    detail[pid] = await koreksiPesertaMember(sesi_member_bulanan_id, pid);
    return detail[pid].ok;
  });

  const hasil = daftar.map((pid) => ({ player_id: pid, ...detail[pid] }));
  const berhasil = hasil.filter((h) => h.ok).length;
  return res.status(200).json({ hasil, berhasil, gagal: hasil.length - berhasil });
}
