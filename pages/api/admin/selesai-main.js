import { supabaseAdmin, getProfileFromRequest, isAdmin } from '../../../lib/supabaseAdmin';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const profile = await getProfileFromRequest(req);
  if (!isAdmin(profile)) return res.status(403).json({ error: 'Khusus admin' });

  const { sesi_id, lapangan } = req.body;
  if (!sesi_id || !lapangan) return res.status(400).json({ error: 'Data tidak lengkap' });

  const { data: pemainDiLapangan } = await supabaseAdmin
    .from('pendaftaran_sesi')
    .select('id, jumlah_game')
    .eq('sesi_id', sesi_id)
    .eq('status_main', 'main')
    .eq('lapangan_sekarang', lapangan);

  if (!pemainDiLapangan || pemainDiLapangan.length === 0) {
    return res.status(400).json({ error: 'Tidak ada yang sedang main di lapangan ini' });
  }

  const now = new Date().toISOString();

  for (const p of pemainDiLapangan) {
    await supabaseAdmin
      .from('pendaftaran_sesi')
      .update({
        status_main: 'menunggu',
        lapangan_sekarang: null,
        jumlah_game: (p.jumlah_game || 0) + 1,
        waktu_checkin: now, // reset waktu antrian -> otomatis masuk paling bawah antrian
      })
      .eq('id', p.id);
  }

  return res.status(200).json({ ok: true });
}
