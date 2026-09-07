import { supabaseAdmin, getProfileFromRequest, isAdmin } from '../../../lib/supabaseAdmin';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const profile = await getProfileFromRequest(req);
  if (!isAdmin(profile)) return res.status(403).json({ error: 'Khusus admin' });

  const { tanggal, label, kuota_total, kuota_member, kuota_harian, deadline_batal } = req.body;
  if (!tanggal || !deadline_batal) {
    return res.status(400).json({ error: 'tanggal & deadline_batal wajib diisi' });
  }

  const { data, error } = await supabaseAdmin
    .from('sesi')
    .insert({
      tanggal,
      label: label || null,
      kuota_total: parseInt(kuota_total || '30', 10),
      kuota_member: parseInt(kuota_member || '20', 10),
      kuota_harian: parseInt(kuota_harian || '10', 10),
      deadline_batal,
      status: 'buka',
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ data });
}
