import { supabaseAdmin, getProfileFromRequest } from '../../lib/supabaseAdmin';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const profile = await getProfileFromRequest(req);
  if (!profile) return res.status(401).json({ error: 'Belum login' });

  const isAdminRole = profile.role === 'admin' || profile.role === 'super_admin';
  if (profile.status_approval !== 'approved' && !isAdminRole) {
    return res.status(403).json({ error: 'Akun kamu masih menunggu approval admin.' });
  }

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

  const tipe_slot = profile.tipe; // 'member' atau 'harian'

  // KOLAM BERSAMA: max 30 orang total (member + harian, TIDAK termasuk guest yang punya
  // kuota terpisah sendiri). Member otomatis udah "ambil tempat duluan" pas sesi dibikin
  // (auto-join), jadi kalau member narik diri (batal), otomatis nambah ruang buat harian
  // tanpa pernah melebihi 30 total.
  const { count: totalTerdaftar } = await supabaseAdmin
    .from('pendaftaran_sesi')
    .select('*', { count: 'exact', head: true })
    .eq('sesi_id', sesi_id)
    .eq('status_daftar', 'terdaftar')
    .neq('tipe_slot', 'guest');

  const status_daftar = (totalTerdaftar ?? 0) < sesi.kuota_total ? 'terdaftar' : 'waiting_list';

  let baru, error;

  if (barisLama) {
    // Sudah pernah batal sebelumnya -> daftar ulang dengan cara UPDATE baris yang sama,
    // bukan bikin baris baru (baris lama unik per sesi+player, jadi ini yang aman)
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
