import { supabaseAdmin, getProfileFromRequest, isAdmin } from '../../../lib/supabaseAdmin';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const profile = await getProfileFromRequest(req);
  if (!isAdmin(profile)) return res.status(403).json({ error: 'Khusus admin' });

  // Sekarang pakai pendaftaran_id (bukan player_id) supaya guest (tanpa akun/player_id) juga bisa main
  const { sesi_id, lapangan, pendaftaran_ids } = req.body;
  if (!sesi_id || !lapangan || !Array.isArray(pendaftaran_ids) || pendaftaran_ids.length === 0) {
    return res.status(400).json({ error: 'Data tidak lengkap' });
  }

  const { data: sedangMain } = await supabaseAdmin
    .from('pendaftaran_sesi')
    .select('id')
    .eq('sesi_id', sesi_id)
    .eq('status_main', 'main')
    .eq('lapangan_sekarang', lapangan);

  if (sedangMain && sedangMain.length > 0) {
    return res.status(400).json({ error: `Lapangan ${lapangan} masih dipakai. Selesaikan dulu game yang lagi jalan.` });
  }

  const { data: gameBaru, error: gameError } = await supabaseAdmin
    .from('game')
    .insert({ sesi_id, lapangan, input_by: profile.id })
    .select()
    .single();

  if (gameError) return res.status(500).json({ error: gameError.message });

  // Ambil player_id (kalau ada) dari tiap pendaftaran, buat dicatat di histori game_pemain
  const { data: baris } = await supabaseAdmin
    .from('pendaftaran_sesi')
    .select('id, player_id')
    .in('id', pendaftaran_ids);

  const rows = (baris || []).map((b) => ({
    game_id: gameBaru.id,
    player_id: b.player_id, // null buat guest, itu gak masalah (kolom sudah nullable)
    pendaftaran_sesi_id: b.id,
  }));
  await supabaseAdmin.from('game_pemain').insert(rows);

  await supabaseAdmin
    .from('pendaftaran_sesi')
    .update({ status_main: 'main', lapangan_sekarang: lapangan })
    .in('id', pendaftaran_ids);

  return res.status(200).json({ data: gameBaru });
}
