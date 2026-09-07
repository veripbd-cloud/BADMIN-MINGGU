import { supabaseAdmin, getProfileFromRequest, isAdmin } from '../../../lib/supabaseAdmin';

// Beda dari batal-sesi.js (yang cuma bisa dipakai player buat batalin punya sendiri,
// dan kena aturan deadline): endpoint ini khusus admin, bisa membatalkan pendaftaran
// SIAPAPUN, kapanpun (termasuk lewat deadline), untuk kasus misalnya member sudah
// konfirmasi dari awal tidak akan hadir.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const profile = await getProfileFromRequest(req);
  if (!isAdmin(profile)) return res.status(403).json({ error: 'Khusus admin' });

  const { pendaftaran_id } = req.body;
  const { data: pendaftaran } = await supabaseAdmin
    .from('pendaftaran_sesi')
    .select('*')
    .eq('id', pendaftaran_id)
    .single();

  if (!pendaftaran) return res.status(404).json({ error: 'Tidak ditemukan' });
  if (pendaftaran.status_daftar === 'batal') {
    return res.status(400).json({ error: 'Pendaftaran ini sudah batal sebelumnya' });
  }

  const statusSebelumnya = pendaftaran.status_daftar;

  await supabaseAdmin
    .from('pendaftaran_sesi')
    .update({ status_daftar: 'batal' })
    .eq('id', pendaftaran_id);

  // Kalau yang dibatalkan tadi mengisi slot "terdaftar", secara default tetap coba
  // promosikan antrian dengan TIPE YANG SAMA duluan (member -> member, harian -> harian).
  // Kalau admin mau kasih slot itu ke tipe lain (misal slot member dikasih ke harian),
  // itu dilakukan manual lewat tombol "Naikkan" di waiting list tipe lain setelahnya.
  if (statusSebelumnya === 'terdaftar') {
    const { data: waitingTerdepan } = await supabaseAdmin
      .from('pendaftaran_sesi')
      .select('*')
      .eq('sesi_id', pendaftaran.sesi_id)
      .eq('tipe_slot', pendaftaran.tipe_slot)
      .eq('status_daftar', 'waiting_list')
      .order('waktu_daftar', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (waitingTerdepan) {
      await supabaseAdmin
        .from('pendaftaran_sesi')
        .update({ status_daftar: 'terdaftar' })
        .eq('id', waitingTerdepan.id);
    }
  }

  return res.status(200).json({ ok: true });
}
