import { supabaseAdmin, getProfileFromRequest, isAdmin } from '../../../lib/supabaseAdmin';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { data, error } = await supabaseAdmin.from('pengaturan').select('*');
    if (error) return res.status(500).json({ error: error.message });
    const obj = {};
    (data || []).forEach((row) => { obj[row.key] = row.value; });
    return res.status(200).json({ data: obj });
  }

  if (req.method === 'POST') {
    const profile = await getProfileFromRequest(req);
    if (!isAdmin(profile)) return res.status(403).json({ error: 'Khusus admin' });

    const gagal = [];
    for (const [key, value] of Object.entries(req.body || {})) {
      const { error } = await supabaseAdmin
        .from('pengaturan')
        .upsert({ key, value: String(value ?? ''), updated_at: new Date().toISOString() });
      if (error) gagal.push(`${key}: ${error.message}`);
    }
    if (gagal.length > 0) {
      return res.status(500).json({ error: 'Ada pengaturan yang gagal tersimpan — ' + gagal.join('; ') });
    }
    return res.status(200).json({ ok: true });
  }

  return res.status(405).end();
}
