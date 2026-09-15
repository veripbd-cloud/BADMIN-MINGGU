import { supabaseAdmin, getProfileFromRequest, isAdmin } from '../../../lib/supabaseAdmin';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const profile = await getProfileFromRequest(req);
  if (!isAdmin(profile)) return res.status(403).json({ error: 'Khusus admin' });

  const { outstanding_id } = req.body;
  const { data: outstanding } = await supabaseAdmin
    .from('outstanding')
    .select('*')
    .eq('id', outstanding_id)
    .single();

  if (!outstanding) return res.status(404).json({ error: 'Tidak ditemukan' });

  if (outstanding.status === 'lunas') {
    // Sudah pernah diproses (misal klik dobel) -> jangan catat transaksi lagi
    return res.status(200).json({ ok: true, sudahLunasSebelumnya: true });
  }

  // Update KONDISIONAL: hanya berhasil kalau statusnya masih 'belum_lunas' saat ini juga.
  // Ini mencegah race condition kalau tombol keklik dobel hampir bersamaan.
  const { data: hasilUpdate, error: updateError } = await supabaseAdmin
    .from('outstanding')
    .update({ status: 'lunas', tanggal_lunas: new Date().toISOString() })
    .eq('id', outstanding_id)
    .eq('status', 'belum_lunas')
    .select();

  if (updateError) return res.status(500).json({ error: updateError.message });

  // Kalau tidak ada baris yang ke-update (karena klik lain barusan sudah lebih dulu memprosesnya),
  // jangan catat transaksi kas lagi.
  if (!hasilUpdate || hasilUpdate.length === 0) {
    return res.status(200).json({ ok: true, sudahLunasSebelumnya: true });
  }

  await supabaseAdmin.from('transaksi_kas').insert({
    jenis: 'pemasukan',
    kategori: 'pelunasan_outstanding',
    nominal: outstanding.nominal,
    keterangan: `Pelunasan outstanding: ${outstanding.keterangan || ''}`,
    player_id: outstanding.player_id,
    nama_guest: outstanding.nama_guest || null,
    input_by: profile.id,
  });

  // Kalau ini pelunasan iuran member bulanan DAN orangnya masih tercatat "harian" di
  // profil, otomatis upgrade jadi "member" + set tanggal_daftar ke awal bulan itu
  // (biar "Member sejak" di profil dia nunjukin sejak bulan dia beneran mulai jadi member).
  if (outstanding.sumber === 'tagihan_bulanan_member' && outstanding.player_id) {
    const { data: pendaftaranMember } = await supabaseAdmin
      .from('pendaftaran_member_bulanan')
      .select('*, sesi:sesi_member_bulanan_id(bulan, tahun)')
      .eq('id', outstanding.referensi_id)
      .maybeSingle();

    if (pendaftaranMember?.sesi) {
      const { data: prof } = await supabaseAdmin
        .from('profiles').select('tipe').eq('id', outstanding.player_id).single();

      if (prof && prof.tipe === 'harian') {
        const { bulan, tahun } = pendaftaranMember.sesi;
        const tanggalMulai = `${tahun}-${String(bulan).padStart(2, '0')}-01`;
        await supabaseAdmin
          .from('profiles')
          .update({ tipe: 'member', tanggal_daftar: tanggalMulai })
          .eq('id', outstanding.player_id);
      }
    }
  }

  return res.status(200).json({ ok: true });
}
