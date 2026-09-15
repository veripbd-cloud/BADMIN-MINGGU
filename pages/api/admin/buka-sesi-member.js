import { supabaseAdmin, getProfileFromRequest, isAdmin } from '../../../lib/supabaseAdmin';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const profile = await getProfileFromRequest(req);
  if (!isAdmin(profile)) return res.status(403).json({ error: 'Khusus admin' });

  const { bulan, tahun, label } = req.body;
  if (!bulan || !tahun) return res.status(400).json({ error: 'bulan & tahun wajib diisi' });

  // Deadline = 2 hari sejak dibuka, jam 23:59 WIB di hari ke-2 itu.
  // Dihitung pakai UTC math + offset eksplisit +07:00, gak gantung timezone device admin.
  const sekarang = new Date();
  const duaHariLagi = new Date(sekarang.getTime() + 2 * 24 * 60 * 60 * 1000);
  const yyyy = duaHariLagi.getUTCFullYear();
  const mm = String(duaHariLagi.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(duaHariLagi.getUTCDate()).padStart(2, '0');
  const deadline = new Date(`${yyyy}-${mm}-${dd}T23:59:00+07:00`);

  const { data, error } = await supabaseAdmin
    .from('sesi_member_bulanan')
    .insert({
      bulan: parseInt(bulan, 10),
      tahun: parseInt(tahun, 10),
      label: label || null,
      dibuka_pada: sekarang.toISOString(),
      deadline_daftar: deadline.toISOString(),
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ data });
}
