import { supabaseAdmin, getProfileFromRequest } from '../../lib/supabaseAdmin';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const profile = await getProfileFromRequest(req);
  if (!profile) return res.status(401).json({ error: 'Belum login' });

  const { sesi_id } = req.body;
  if (!sesi_id) return res.status(400).json({ error: 'sesi_id wajib diisi' });

  const { data: sesi } = await supabaseAdmin.from('sesi').select('*').eq('id', sesi_id).single();
  if (!sesi) return res.status(404).json({ error: 'Sesi tidak ditemukan' });

  // Cek baris pendaftaran yang sudah pernah ada untuk kombinasi sesi+player ini (apapun statusnya)
  const { data: barisLama } = await supabaseAdmin
    .from('pendaftaran_sesi')
    .select('*')
    .eq('sesi_id', sesi_id)
    .eq('player_id', profile.id)
    .maybeSingle();

  if (barisLama && barisLama.status_daftar !== 'batal') {
    return res.status(400).json({ error: 'Kamu sudah terdaftar di sesi ini.' });
  }

  const tipe_slot = profile.tipe;
  const kuota = tipe_slot === 'member' ? sesi.kuota_member : sesi.kuota_harian;

  const { count: terdaftarCount } = await supabaseAdmin
    .from('pendaftaran_sesi')
    .select('*', { count: 'exact', head: true })
    .eq('sesi_id', sesi_id)
    .eq('tipe_slot', tipe_slot)
    .eq('status_daftar', 'terdaftar');

  const status_daftar = (terdaftarCount ?? 0) < kuota ? 'terdaftar' : 'waiting_list';

  let baru, error;

  if (barisLama) {
    ({ data: baru, error } = await supabaseAdmin
      .from('pendaftaran_sesi')
      .update({
        tipe_slot,
        status_daftar,
        waktu_daftar: new Date().toISOString(),
        status_hadir: null,
        waktu_checkin: null,
        status_main: null,
        lapangan_sekarang: null,
      })
      .eq('id', barisLama.id)
      .select()
      .single());
  } else {
    ({ data: baru, error } = await supabaseAdmin
      .from('pendaftaran_sesi')
      .insert({
        sesi_id,
        player_id: profile.id,
        tipe_slot,
        status_daftar,
        waktu_daftar: new Date().toISOString(),
      })
      .select()
      .single());
  }

  if (error) return res.status(500).json({ error: error.message });

  return res.status(200).json({ data: baru });
}
