import { supabaseAdmin, getProfileFromRequest, isAdmin } from '../../../lib/supabaseAdmin';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const profile = await getProfileFromRequest(req);
  if (!isAdmin(profile)) return res.status(403).json({ error: 'Khusus admin' });

  const { player_id, member_sejak } = req.body;
  if (!player_id || !member_sejak) return res.status(400).json({ error: 'Data tidak lengkap' });

  const { error } = await supabaseAdmin
    .from('profiles')
    .update({ member_sejak })
    .eq('id', player_id);

  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ ok: true });
}
