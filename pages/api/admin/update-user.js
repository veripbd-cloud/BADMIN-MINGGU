import { supabaseAdmin, getProfileFromRequest, isAdmin } from '../../../lib/supabaseAdmin';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const profile = await getProfileFromRequest(req);
  if (!isAdmin(profile)) return res.status(403).json({ error: 'Khusus admin' });

  const { player_id, nama, tanggal_daftar, tipe, level_self, level_final, email, password } = req.body;
  if (!player_id) return res.status(400).json({ error: 'player_id wajib diisi' });

  // --- Update kolom di tabel profiles (kalau ada yang dikirim) ---
  const updateProfil = {};
  if (nama !== undefined && nama !== '') updateProfil.nama = nama;
  if (tanggal_daftar !== undefined && tanggal_daftar !== '') updateProfil.tanggal_daftar = tanggal_daftar;
  if (tipe !== undefined && tipe !== '') updateProfil.tipe = tipe;
  if (level_self !== undefined) updateProfil.level_self = level_self || null;
  if (level_final !== undefined) updateProfil.level_final = level_final || null;

  if (Object.keys(updateProfil).length > 0) {
    const { error } = await supabaseAdmin.from('profiles').update(updateProfil).eq('id', player_id);
    if (error) return res.status(500).json({ error: 'Gagal update profil: ' + error.message });
  }

  // --- Update email/password di sistem auth (kalau ada yang dikirim) ---
  const updateAuth = {};
  if (email !== undefined && email !== '') updateAuth.email = email;
  if (password !== undefined && password !== '') updateAuth.password = password;

  if (Object.keys(updateAuth).length > 0) {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(player_id, updateAuth);
    if (error) return res.status(500).json({ error: 'Gagal update login: ' + error.message });
  }

  return res.status(200).json({ ok: true });
}
