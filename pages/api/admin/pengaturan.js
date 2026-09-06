import { supabaseAdmin, getProfileFromRequest, isAdmin } from '../../../lib/supabaseAdmin';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { data } = await supabaseAdmin.from('pengaturan').select('*');
    const obj = {};
    (data || []).forEach((row) => { obj[row.key] = row.value; });
    return res.status(200).json({ data: obj });
  }

  if (req.method === 'POST') {
    const profile = await getProfileFromRequest(req);
    if (!isAdmin(profile)) return res.status(403).json({ error: 'Khusus admin' });

    const updates = req.body; // { key: value, ... }
    for (const [key, value] of Object.entries(updates)) {
      await supabaseAdmin
        .from('pengaturan')
        .upsert({ key, value: String(value), updated_at: new Date().toISOString() });
    }
    return res.status(200).json({ ok: true });
  }

  return res.status(405).end();
}
