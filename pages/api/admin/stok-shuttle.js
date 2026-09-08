import { supabaseAdmin, getProfileFromRequest, isAdmin } from '../../../lib/supabaseAdmin';

export default async function handler(req, res) {
  const profile = await getProfileFromRequest(req);

  if (req.method === 'GET') {
    const { data } = await supabaseAdmin
      .from('stok_shuttle_log')
      .select('saldo_setelah')
      .order('waktu', { ascending: false })
      .limit(1)
      .maybeSingle();
    return res.status(200).json({ jumlah_piece: data?.saldo_setelah || 0 });
  }

  if (req.method !== 'POST') return res.status(405).end();
  if (!isAdmin(profile)) return res.status(403).json({ error: 'Khusus admin' });

  const { arah, slop, piece } = req.body; // arah: 'tambah' | 'kurangi'
  const rawDelta = (parseInt(slop || 0, 10) * 12) + parseInt(piece || 0, 10);
  if (!rawDelta || rawDelta <= 0) return res.status(400).json({ error: 'Jumlah harus lebih dari 0' });

  const { data: terakhir } = await supabaseAdmin
    .from('stok_shuttle_log')
    .select('saldo_setelah')
    .order('waktu', { ascending: false })
    .limit(1)
    .maybeSingle();
  const sekarang = terakhir?.saldo_setelah || 0;

  const signedDelta = arah === 'kurangi' ? -rawDelta : rawDelta;
  const baru = Math.max(0, sekarang + signedDelta);
  const deltaBenerTerapkan = baru - sekarang; // bisa beda dari signedDelta kalau ke-floor ke 0

  const { error } = await supabaseAdmin.from('stok_shuttle_log').insert({
    arah,
    slop: parseInt(slop || 0, 10),
    piece: parseInt(piece || 0, 10),
    delta_piece: deltaBenerTerapkan,
    saldo_setelah: baru,
    input_by: profile.id,
  });

  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ jumlah_piece: baru });
}
