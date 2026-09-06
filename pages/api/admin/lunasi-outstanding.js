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

  await supabaseAdmin
    .from('outstanding')
    .update({ status: 'lunas', tanggal_lunas: new Date().toISOString() })
    .eq('id', outstanding_id);

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
