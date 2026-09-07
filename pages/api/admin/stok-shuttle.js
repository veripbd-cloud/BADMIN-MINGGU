import { supabaseAdmin, getProfileFromRequest, isAdmin } from '../../../lib/supabaseAdmin';

const KEY = 'stok_shuttle_piece';

export default async function handler(req, res) {
  const profile = await getProfileFromRequest(req);

  if (req.method === 'GET') {
    const { data } = await supabaseAdmin.from('pengaturan').select('value').eq('key', KEY).maybeSingle();
    return res.status(200).json({ jumlah_piece: parseInt(data?.value || '0', 10) });
  }

  if (req.method !== 'POST') return res.status(405).end();
  if (!isAdmin(profile)) return res.status(403).json({ error: 'Khusus admin' });

  const { arah, slop, piece } = req.body; // arah: 'tambah' | 'kurangi'
  const deltaPiece = (parseInt(slop || 0, 10) * 12) + parseInt(piece || 0, 10);
  if (!deltaPiece || deltaPiece <= 0) return res.status(400).json({ error: 'Jumlah harus lebih dari 0' });

  const { data: current } = await supabaseAdmin.from('pengaturan').select('value').eq('key', KEY).maybeSingle();
  const sekarang = parseInt(current?.value || '0', 10);

  const baru = arah === 'kurangi'
    ? Math.max(0, sekarang - deltaPiece)
    : sekarang + deltaPiece;

  const { error } = await supabaseAdmin
    .from('pengaturan')
    .upsert({ key: KEY, value: String(baru), updated_at: new Date().toISOString() });

  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ jumlah_piece: baru });
}
