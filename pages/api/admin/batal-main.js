import { supabaseAdmin, getProfileFromRequest, isAdmin } from '../../../lib/supabaseAdmin';

// Beda dari selesai-main.js: ini buat kasus SALAH PENCET (pilih orang yang keliru,
// atau salah lapangan). Pemain balik ke antrian TANPA nambah jumlah_game dan TANPA
// reset waktu_checkin -> posisi antrian mereka tetap kayak semula (seolah-olah gak
// pernah "mulai main" sama sekali). Histori game yang salah mulai itu juga dihapus,
// biar gak ngotorin data (dianggap gak pernah beneran kejadian).
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const profile = await getProfileFromRequest(req);
  if (!isAdmin(profile)) return res.status(403).json({ error: 'Khusus admin' });

  const { sesi_id, lapangan } = req.body;
  if (!sesi_id || !lapangan) return res.status(400).json({ error: 'Data tidak lengkap' });

  const { data: pemainDiLapangan } = await supabaseAdmin
    .from('pendaftaran_sesi')
    .select('id')
    .eq('sesi_id', sesi_id)
    .eq('status_main', 'main')
    .eq('lapangan_sekarang', lapangan);

  if (!pemainDiLapangan || pemainDiLapangan.length === 0) {
    return res.status(400).json({ error: 'Tidak ada yang sedang main di lapangan ini' });
  }

  await supabaseAdmin
    .from('pendaftaran_sesi')
    .update({ status_main: 'menunggu', lapangan_sekarang: null })
    .in('id', pemainDiLapangan.map((p) => p.id));

  // Hapus histori game yang salah mulai ini (yang paling baru dibuat buat sesi+lapangan ini)
  const { data: gameTerakhir } = await supabaseAdmin
    .from('game')
    .select('id')
    .eq('sesi_id', sesi_id)
    .eq('lapangan', lapangan)
    .order('waktu_input', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (gameTerakhir) {
    await supabaseAdmin.from('game_pemain').delete().eq('game_id', gameTerakhir.id);
    await supabaseAdmin.from('game').delete().eq('id', gameTerakhir.id);
  }

  return res.status(200).json({ ok: true });
}
