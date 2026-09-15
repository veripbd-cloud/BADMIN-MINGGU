import { supabaseAdmin, getProfileFromRequest, isAdmin } from '../../../lib/supabaseAdmin';

// Dipanggil otomatis (kayak auto-noshow) begitu admin buka halaman detail sesi member
// bulanan yang deadline-nya udah lewat. Member yang GAK terdaftar di bulan ini otomatis
// diturunkan jadi "harian". Aman dipanggil berkali-kali (idempotent).
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const profile = await getProfileFromRequest(req);
  if (!isAdmin(profile)) return res.status(403).json({ error: 'Khusus admin' });

  const { sesi_member_bulanan_id } = req.body;
  if (!sesi_member_bulanan_id) return res.status(400).json({ error: 'sesi_member_bulanan_id wajib diisi' });

  const { data: sesi } = await supabaseAdmin
    .from('sesi_member_bulanan')
    .select('*')
    .eq('id', sesi_member_bulanan_id)
    .single();
  if (!sesi) return res.status(404).json({ error: 'Sesi tidak ditemukan' });

  if (new Date() <= new Date(sesi.deadline_daftar)) {
    return res.status(200).json({ ok: true, diturunkan: 0, alasan: 'belum lewat deadline' });
  }

  const { data: semuaMember } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('tipe', 'member');

  const { data: yangTerdaftar } = await supabaseAdmin
    .from('pendaftaran_member_bulanan')
    .select('player_id')
    .eq('sesi_member_bulanan_id', sesi_member_bulanan_id)
    .eq('status_daftar', 'terdaftar');

  const idTerdaftar = new Set((yangTerdaftar || []).map((p) => p.player_id));
  const yangDiturunkan = (semuaMember || []).filter((m) => !idTerdaftar.has(m.id));

  for (const m of yangDiturunkan) {
    await supabaseAdmin.from('profiles').update({ tipe: 'harian' }).eq('id', m.id);
  }

  return res.status(200).json({ ok: true, diturunkan: yangDiturunkan.length });
}
