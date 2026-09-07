import { supabaseAdmin, getProfileFromRequest, isAdmin } from '../../../lib/supabaseAdmin';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const profile = await getProfileFromRequest(req);
  if (!isAdmin(profile)) return res.status(403).json({ error: 'Khusus admin' });

  const { sesi_id, lapangan, player_ids } = req.body;
  if (!sesi_id || !lapangan || !Array.isArray(player_ids) || player_ids.length === 0) {
    return res.status(400).json({ error: 'Data tidak lengkap' });
  }

  // Pastikan lapangan ini lagi kosong (gak ada yang berstatus 'main' di situ untuk sesi ini)
  const { data: sedangMain } = await supabaseAdmin
    .from('pendaftaran_sesi')
    .select('id')
    .eq('sesi_id', sesi_id)
    .eq('status_main', 'main')
    .eq('lapangan_sekarang', lapangan);

  if (sedangMain && sedangMain.length > 0) {
    return res.status(400).json({ error: `Lapangan ${lapangan} masih dipakai. Selesaikan dulu game yang lagi jalan.` });
  }

  // Catat sebagai game baru (histori) — waktu_input = saat game ini dimulai
  const { data: gameBaru, error: gameError } = await supabaseAdmin
    .from('game')
    .insert({ sesi_id, lapangan, input_by: profile.id })
    .select()
    .single();

  if (gameError) return res.status(500).json({ error: gameError.message });

  const rows = player_ids.map((player_id) => ({ game_id: gameBaru.id, player_id }));
  await supabaseAdmin.from('game_pemain').insert(rows);

  // Pindahkan pemain-pemain ini dari antrian ke status 'main' di lapangan tsb
  await supabaseAdmin
    .from('pendaftaran_sesi')
    .update({ status_main: 'main', lapangan_sekarang: lapangan })
    .eq('sesi_id', sesi_id)
    .in('player_id', player_ids);

  return res.status(200).json({ data: gameBaru });
}
