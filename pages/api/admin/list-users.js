import { supabaseAdmin, getProfileFromRequest, isAdmin } from '../../../lib/supabaseAdmin';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const profile = await getProfileFromRequest(req);
  if (!isAdmin(profile)) return res.status(403).json({ error: 'Khusus admin' });

  const { data: profiles } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .order('nama', { ascending: true });

  // Ambil email dari sistem auth (gak kesimpen di tabel profiles)
  const { data: authData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
  const emailMap = {};
  (authData?.users || []).forEach((u) => { emailMap[u.id] = u.email; });

  const hasil = (profiles || []).map((p) => ({ ...p, email: emailMap[p.id] || '-' }));

  return res.status(200).json({ data: hasil });
}
