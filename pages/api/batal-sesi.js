import { supabaseAdmin, getProfileFromRequest } from '../../lib/supabaseAdmin';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const profile = await getProfileFromRequest(req);
  if (!profile) return res.status(401).json({ error: 'Belum login' });

  const { pendaftaran_id } = req.body;
  if (!pendaftaran_id) return res.status(400).json({ error: 'pendaftaran_id wajib diisi' });

  const { data: pendaftaran } = await supabaseAdmin
    .from('pendaftaran_sesi')
    .select('*, sesi:sesi_id(*)')
    .eq('id', pendaftaran_id)
    .single();

  if (!pendaftaran) return res.status(404).json({ error: 'Pendaftaran tidak ditemukan' });
  if (pendaftaran.player_id !== profile.id) {
    return res.status(403).json({ error: 'Bukan pendaftaran milikmu' });
  }

  const now = new Date();
  const deadline = new Date(pendaftaran.sesi.deadline_batal);
  const statusSebelumnya = pendaftaran.status_daftar;

  if (now > deadline && statusSebelumnya === 'terdaftar') {
    return res.status(400).json({
      error: 'Sudah lewat deadline pembatalan. Kalau tidak hadir, akan tercatat no-show.',
    });
  }

  // Tandai batal
  const { error: updateError } = await supabaseAdmin
    .from('pendaftaran_sesi')
    .update({ status_daftar: 'batal' })
    .eq('id', pendaftaran_id);

  if (updateError) return res.status(500).json({ error: updateError.message });

  // Kalau yang batal sebelumnya mengisi slot "terdaftar" (bukan waiting_list),
  // promosikan orang PALING DEPAN di waiting list SESI INI (global, gak dibatasi tipe lagi).
  // Ini yang bikin "member narik diri otomatis nambah slot buat harian" jalan sendiri:
  // gak ada lagi "waiting list member" (semua member udah auto-join dari awal), jadi
  // slot yang kebuka otomatis kepakai sama harian paling depan di antrian, tanpa
  // pernah melebihi total kuota (30) sesi ini.
  if (statusSebelumnya === 'terdaftar') {
    const { data: waitingTerdepan } = await supabaseAdmin
      .from('pendaftaran_sesi')
      .select('*')
      .eq('sesi_id', pendaftaran.sesi_id)
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
