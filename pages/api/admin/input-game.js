import { supabaseAdmin, getProfileFromRequest, isAdmin } from '../../../lib/supabaseAdmin';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const profile = await getProfileFromRequest(req);
  if (!isAdmin(profile)) return res.status(403).json({ error: 'Khusus admin' });

  const { sesi_id, lapangan, player_ids } = req.body;
  if (!sesi_id || !lapangan || !Array.isArray(player_ids) || player_ids.length === 0) {
    return res.status(400).json({ error: 'Data tidak lengkap' });
  }

  const { data: gameBaru, error: gameError } = await supabaseAdmin
    .from('game')
    .insert({ sesi_id, lapangan, input_by: profile.id })
    .select()
    .single();

  if (gameError) return res.status(500).json({ error: gameError.message });

  const rows = player_ids.map((player_id) => ({ game_id: gameBaru.id, player_id }));
  const { error: gpError } = await supabaseAdmin.from('game_pemain').insert(rows);
  if (gpError) return res.status(500).json({ error: gpError.message });

  // Naikkan jumlah_game masing-masing pemain di pendaftaran_sesi untuk sesi ini
  for (const player_id of player_ids) {
    const { data: pendaftaran } = await supabaseAdmin
      .from('pendaftaran_sesi')
      .select('id, jumlah_game')
      .eq('sesi_id', sesi_id)
      .eq('player_id', player_id)
      .single();

    if (pendaftaran) {
      await supabaseAdmin
        .from('pendaftaran_sesi')
        .update({ jumlah_game: (pendaftaran.jumlah_game || 0) + 1 })
        .eq('id', pendaftaran.id);
    }
  }

  return res.status(200).json({ data: gameBaru });
}
