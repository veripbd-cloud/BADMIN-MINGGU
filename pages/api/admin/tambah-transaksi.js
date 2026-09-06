import { supabaseAdmin, getProfileFromRequest, isAdmin } from '../../../lib/supabaseAdmin';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const profile = await getProfileFromRequest(req);
  if (!isAdmin(profile)) return res.status(403).json({ error: 'Khusus admin' });

  const { jenis, kategori, nominal, keterangan, player_id, tanggal } = req.body;
  if (!jenis || !nominal) return res.status(400).json({ error: 'Data tidak lengkap' });

  const { data, error } = await supabaseAdmin
    .from('transaksi_kas')
    .insert({
      jenis,
      kategori: kategori || null,
      nominal: parseInt(nominal, 10),
      keterangan: keterangan || null,
      player_id: player_id || null,
      input_by: profile.id,
      tanggal: tanggal || new Date().toISOString().slice(0, 10),
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ data });
}
