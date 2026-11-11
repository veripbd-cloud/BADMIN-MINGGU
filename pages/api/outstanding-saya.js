import { supabaseAdmin, getProfileFromRequest } from '../../lib/supabaseAdmin';

// Tagihan belum lunas milik pemain yang sedang login (untuk halaman Profil).
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  if (req.method !== 'GET') return res.status(405).end();

  const profile = await getProfileFromRequest(req);
  if (!profile) return res.status(401).json({ error: 'Belum login' });

  const { data, error } = await supabaseAdmin
    .from('outstanding').select('*').eq('player_id', profile.id).eq('status', 'belum_lunas');
  if (error) return res.status(500).json({ error: error.message });

  return res.status(200).json({
    outstanding: (data || []).map((x) => ({ id: x.id, nominal: x.nominal, keterangan: x.keterangan })),
  });
}
