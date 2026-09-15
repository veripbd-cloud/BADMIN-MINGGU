import { supabaseAdmin, getProfileFromRequest } from '../../lib/supabaseAdmin';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const profile = await getProfileFromRequest(req);
  if (!profile) return res.status(401).json({ error: 'Belum login' });

  const { pendaftaran_id } = req.body;
  if (!pendaftaran_id) return res.status(400).json({ error: 'pendaftaran_id wajib diisi' });

  const { data: pendaftaran } = await supabaseAdmin
    .from('pendaftaran_member_bulanan')
    .select('*')
    .eq('id', pendaftaran_id)
    .single();

  if (!pendaftaran) return res.status(404).json({ error: 'Pendaftaran tidak ditemukan' });
  if (pendaftaran.player_id !== profile.id) return res.status(403).json({ error: 'Bukan pendaftaran milikmu' });

  await supabaseAdmin
    .from('pendaftaran_member_bulanan')
    .update({ status_daftar: 'batal' })
    .eq('id', pendaftaran_id);

  // Hapus outstanding-nya kalau belum dibayar
  await supabaseAdmin
    .from('outstanding')
    .delete()
    .eq('sumber', 'tagihan_bulanan_member')
    .eq('referensi_id', pendaftaran_id)
    .eq('status', 'belum_lunas');

  return res.status(200).json({ ok: true });
}
