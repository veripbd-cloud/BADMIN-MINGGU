import { supabaseAdmin, getProfileFromRequest, isAdmin } from '../../../lib/supabaseAdmin';
import { prosesSesiTertunggak } from '../../../lib/memberBulanan';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const profile = await getProfileFromRequest(req);
  if (!isAdmin(profile)) return res.status(403).json({ error: 'Khusus admin' });

  // Pastikan status member sudah rapi (yang tidak konfirmasi bulan ini sudah jadi harian)
  // SEBELUM auto-join, supaya cuma member aktif yang otomatis masuk sesi.
  await prosesSesiTertunggak();

  const { tanggal, label, kuota_total, kuota_member, kuota_harian, deadline_batal } = req.body;
  if (!tanggal || !deadline_batal) {
    return res.status(400).json({ error: 'tanggal & deadline_batal wajib diisi' });
  }

  const { data, error } = await supabaseAdmin
    .from('sesi')
    .insert({
      tanggal,
      label: label || null,
      kuota_total: parseInt(kuota_total || '30', 10),
      kuota_member: parseInt(kuota_member || '20', 10),
      kuota_harian: parseInt(kuota_harian || '10', 10),
      deadline_batal,
      status: 'buka',
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  // Auto-daftarkan SEMUA member yang statusnya sudah approved (member baru yang baru
  // di-approve juga otomatis ikut, gak ada perlakuan beda dari member lama).
  const { data: semuaMember } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('tipe', 'member')
    .eq('status_approval', 'approved');

  if (semuaMember && semuaMember.length > 0) {
    const rows = semuaMember.map((m) => ({
      sesi_id: data.id,
      player_id: m.id,
      tipe_slot: 'member',
      status_daftar: 'terdaftar',
      waktu_daftar: new Date().toISOString(),
    }));
    const { error: errJoin } = await supabaseAdmin.from('pendaftaran_sesi').insert(rows);
    if (errJoin) {
      await supabaseAdmin.from('sesi').delete().eq('id', data.id);
      return res.status(500).json({ error: 'Gagal mendaftarkan member otomatis, sesi dibatalkan: ' + errJoin.message });
    }
  }

  return res.status(200).json({ data, jumlah_member_auto_join: semuaMember?.length || 0 });
}
