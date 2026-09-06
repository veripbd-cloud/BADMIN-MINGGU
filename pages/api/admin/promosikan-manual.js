import { supabaseAdmin, getProfileFromRequest, isAdmin } from '../../../lib/supabaseAdmin';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const profile = await getProfileFromRequest(req);
  if (!isAdmin(profile)) return res.status(403).json({ error: 'Khusus admin' });

  const { pendaftaran_id } = req.body;
  const { data: target } = await supabaseAdmin
    .from('pendaftaran_sesi')
    .select('*')
    .eq('id', pendaftaran_id)
    .single();

  if (!target || target.status_daftar !== 'waiting_list') {
    return res.status(400).json({ error: 'Pendaftaran ini tidak sedang di waiting list' });
  }

  const { error } = await supabaseAdmin
    .from('pendaftaran_sesi')
    .update({ status_daftar: 'terdaftar' })
    .eq('id', pendaftaran_id);

  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ ok: true });
}
