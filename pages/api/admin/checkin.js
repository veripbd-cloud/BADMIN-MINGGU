import { supabaseAdmin, getProfileFromRequest, isAdmin } from '../../../lib/supabaseAdmin';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const profile = await getProfileFromRequest(req);
  if (!isAdmin(profile)) return res.status(403).json({ error: 'Khusus admin' });

  const { pendaftaran_id } = req.body;

  const { error } = await supabaseAdmin
    .from('pendaftaran_sesi')
    .update({ waktu_checkin: new Date().toISOString() })
    .eq('id', pendaftaran_id);

  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ ok: true });
}
