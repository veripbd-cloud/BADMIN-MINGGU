import { supabaseAdmin, getProfileFromRequest, isAdmin } from '../../../lib/supabaseAdmin';

// Status tagihan iuran tiap peserta satu sesi konfirmasi member. Khusus admin.
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  if (req.method !== 'GET') return res.status(405).end();

  const profile = await getProfileFromRequest(req);
  if (!isAdmin(profile)) return res.status(403).json({ error: 'Khusus admin' });

  const sesiId = req.query?.sesi_member_bulanan_id;
  if (!sesiId) return res.status(400).json({ error: 'sesi_member_bulanan_id wajib diisi' });

  const { data: pendaftaran, error: errP } = await supabaseAdmin
    .from('pendaftaran_member_bulanan').select('id').eq('sesi_member_bulanan_id', sesiId);
  if (errP) return res.status(500).json({ error: errP.message });

  const ids = (pendaftaran || []).map((p) => p.id);
  if (ids.length === 0) return res.status(200).json({ outstanding: [] });

  const { data, error } = await supabaseAdmin
    .from('outstanding').select('referensi_id, nominal, status')
    .eq('sumber', 'tagihan_bulanan_member').in('referensi_id', ids);
  if (error) return res.status(500).json({ error: error.message });

  return res.status(200).json({ outstanding: data || [] });
}
