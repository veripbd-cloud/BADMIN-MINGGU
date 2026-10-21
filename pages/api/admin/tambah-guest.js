import { supabaseAdmin, getProfileFromRequest, isAdmin } from '../../../lib/supabaseAdmin';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const profile = await getProfileFromRequest(req);
  if (!isAdmin(profile)) return res.status(403).json({ error: 'Khusus admin' });

  const { sesi_id, nama_guest } = req.body;
  if (!sesi_id || !nama_guest || !nama_guest.trim()) {
    return res.status(400).json({ error: 'Nama guest wajib diisi' });
  }

  const { data: kuotaSetting } = await supabaseAdmin
    .from('pengaturan')
    .select('value')
    .eq('key', 'kuota_guest')
    .maybeSingle();
  const kuotaGuest = parseInt(kuotaSetting?.value || '3', 10);

  const { count: jumlahGuestSekarang } = await supabaseAdmin
    .from('pendaftaran_sesi')
    .select('*', { count: 'exact', head: true })
    .eq('sesi_id', sesi_id)
    .eq('tipe_slot', 'guest')
    .neq('status_daftar', 'batal');

  if ((jumlahGuestSekarang ?? 0) >= kuotaGuest) {
    return res.status(400).json({ error: `Kuota guest sudah penuh (maks ${kuotaGuest} orang).` });
  }

  // Kolam 30 orang berlaku untuk SEMUA (member + harian + guest)
  const { data: sesiInfo } = await supabaseAdmin.from('sesi').select('kuota_total').eq('id', sesi_id).single();
  if (!sesiInfo) return res.status(404).json({ error: 'Sesi tidak ditemukan' });
  const { count: totalTerdaftar } = await supabaseAdmin
    .from('pendaftaran_sesi')
    .select('*', { count: 'exact', head: true })
    .eq('sesi_id', sesi_id)
    .eq('status_daftar', 'terdaftar');
  if ((totalTerdaftar ?? 0) >= sesiInfo.kuota_total) {
    return res.status(400).json({ error: `Kapasitas sesi sudah penuh (${sesiInfo.kuota_total} orang, termasuk member, harian, dan guest).` });
  }

  const { data, error } = await supabaseAdmin
    .from('pendaftaran_sesi')
    .insert({
      sesi_id,
      player_id: null,
      nama_guest: nama_guest.trim(),
      tipe_slot: 'guest',
      status_daftar: 'terdaftar',
      waktu_daftar: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ data });
}
