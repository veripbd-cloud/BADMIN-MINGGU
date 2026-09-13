import { supabaseAdmin, getProfileFromRequest, isAdmin } from '../../../lib/supabaseAdmin';

// Dipanggil otomatis (bukan diklik admin) begitu halaman detail sesi dibuka dan sesinya
// udah lewat jam 10:00. Nyari harian/guest yang statusnya "terdaftar" tapi status_hadir
// masih kosong (gak pernah diklik Hadir/Tidak Hadir sama sekali) -> otomatis dianggap
// no-show + kena outstanding. Aman dipanggil berkali-kali (idempotent, cuma proses yang
// masih kosong).
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const profile = await getProfileFromRequest(req);
  if (!isAdmin(profile)) return res.status(403).json({ error: 'Khusus admin' });

  const { sesi_id } = req.body;
  if (!sesi_id) return res.status(400).json({ error: 'sesi_id wajib diisi' });

  const { data: sesi } = await supabaseAdmin.from('sesi').select('*').eq('id', sesi_id).single();
  if (!sesi) return res.status(404).json({ error: 'Sesi tidak ditemukan' });

  const sudahLewat = new Date() > new Date(sesi.tanggal + 'T10:00:00+07:00');
  if (!sudahLewat) return res.status(200).json({ ok: true, diproses: 0 });

  const { data: belumDitandai } = await supabaseAdmin
    .from('pendaftaran_sesi')
    .select('*')
    .eq('sesi_id', sesi_id)
    .eq('status_daftar', 'terdaftar')
    .in('tipe_slot', ['harian', 'guest'])
    .is('status_hadir', null);

  if (!belumDitandai || belumDitandai.length === 0) {
    return res.status(200).json({ ok: true, diproses: 0 });
  }

  const { data: hargaSetting } = await supabaseAdmin
    .from('pengaturan').select('value').eq('key', 'harga_harian').single();
  const nominal = parseInt(hargaSetting?.value || '35000', 10);

  for (const p of belumDitandai) {
    await supabaseAdmin.from('pendaftaran_sesi').update({ status_hadir: 'no_show' }).eq('id', p.id);

    const { data: sudahAda } = await supabaseAdmin
      .from('outstanding')
      .select('id')
      .eq('sumber', 'tagihan_harian')
      .eq('referensi_id', p.id)
      .maybeSingle();

    if (!sudahAda) {
      await supabaseAdmin.from('outstanding').insert({
        player_id: p.player_id,
        nama_guest: p.nama_guest || null,
        sumber: 'tagihan_harian',
        referensi_id: p.id,
        nominal,
        keterangan: 'Sesi sudah berakhir, tidak pernah ditandai hadir (otomatis no-show)',
        status: 'belum_lunas',
      });
    }
  }

  return res.status(200).json({ ok: true, diproses: belumDitandai.length });
}
