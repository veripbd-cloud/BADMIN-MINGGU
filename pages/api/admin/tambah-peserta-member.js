import { supabaseAdmin, getProfileFromRequest, isAdmin } from '../../../lib/supabaseAdmin';
import { tambahPesertaMember } from '../../../lib/memberBulanan';
import { jalankanBerbatas } from '../../../lib/aksiPeserta';

const STATUS = { tidak_ada: 404, sudah: 400, harga: 400, simpan: 500, tagihan: 500 };

// Admin menambah satu atau BANYAK peserta ke sesi konfirmasi member (boleh setelah deadline).
// Banyak sekaligus: kirim player_ids (daftar). Satu: player_id (cara lama tetap jalan).
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const profile = await getProfileFromRequest(req);
  if (!isAdmin(profile)) return res.status(403).json({ error: 'Khusus admin' });

  const { sesi_member_bulanan_id, player_id, player_ids } = req.body || {};
  const massal = Array.isArray(player_ids);
  const daftar = massal ? [...new Set(player_ids)] : (player_id ? [player_id] : []);
  if (!sesi_member_bulanan_id || daftar.length === 0) {
    return res.status(400).json({ error: 'sesi_member_bulanan_id dan player_id / player_ids wajib diisi' });
  }
  if (daftar.length > 200) return res.status(400).json({ error: 'Terlalu banyak sekaligus (maksimal 200)' });

  const { data: sesi } = await supabaseAdmin
    .from('sesi_member_bulanan').select('*').eq('id', sesi_member_bulanan_id).single();
  if (!sesi) return res.status(404).json({ error: 'Sesi tidak ditemukan' });

  const detail = {};
  await jalankanBerbatas(daftar, 4, async (pid) => {
    detail[pid] = await tambahPesertaMember(sesi, pid);
    return detail[pid].ok;
  });

  if (!massal) {
    const r = detail[daftar[0]];
    if (!r.ok) return res.status(STATUS[r.kode] || 400).json({ error: r.error });
    return res.status(200).json({ nominal: r.nominal, subsidi: r.subsidi });
  }

  const hasil = daftar.map((pid) => ({ player_id: pid, ...detail[pid] }));
  const berhasil = hasil.filter((h) => h.ok).length;
  return res.status(200).json({ hasil, berhasil, gagal: hasil.length - berhasil });
}
