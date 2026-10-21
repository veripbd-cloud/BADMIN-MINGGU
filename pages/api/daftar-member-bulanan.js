import { supabaseAdmin, getProfileFromRequest } from '../../lib/supabaseAdmin';
import { hitungTagihanMember, buatOutstandingIuran } from '../../lib/memberBulanan';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const profile = await getProfileFromRequest(req);
  if (!profile) return res.status(401).json({ error: 'Belum login' });

  const { sesi_member_bulanan_id } = req.body;
  if (!sesi_member_bulanan_id) return res.status(400).json({ error: 'sesi_member_bulanan_id wajib diisi' });

  const { data: sesi } = await supabaseAdmin
    .from('sesi_member_bulanan').select('*').eq('id', sesi_member_bulanan_id).single();
  if (!sesi) return res.status(404).json({ error: 'Sesi tidak ditemukan' });

  if (new Date() > new Date(sesi.deadline_daftar)) {
    return res.status(400).json({ error: 'Sudah lewat deadline pendaftaran. Hubungi admin kalau perlu diproses manual.' });
  }

  const { data: barisLama } = await supabaseAdmin
    .from('pendaftaran_member_bulanan').select('*')
    .eq('sesi_member_bulanan_id', sesi_member_bulanan_id).eq('player_id', profile.id).maybeSingle();

  if (barisLama && barisLama.status_daftar !== 'batal') {
    return res.status(400).json({ error: 'Kamu sudah terdaftar untuk bulan ini.' });
  }

  // Hitung tagihan DULU: kalau harga subsidi belum diisi admin, jangan daftarkan.
  const tagihan = await hitungTagihanMember(profile.id, sesi);
  if (tagihan.error) return res.status(400).json({ error: tagihan.error });

  let baru;
  if (barisLama) {
    const { data } = await supabaseAdmin
      .from('pendaftaran_member_bulanan')
      .update({ status_daftar: 'terdaftar', waktu_daftar: new Date().toISOString() })
      .eq('id', barisLama.id).select().single();
    baru = data;
  } else {
    const { data } = await supabaseAdmin
      .from('pendaftaran_member_bulanan')
      .insert({ sesi_member_bulanan_id, player_id: profile.id })
      .select().single();
    baru = data;
  }
  if (!baru) return res.status(500).json({ error: 'Gagal menyimpan pendaftaran.' });

  try {
    await buatOutstandingIuran({
      pendaftaran: baru, player_id: profile.id, sesi, nominal: tagihan.nominal, subsidi: tagihan.subsidi,
    });
  } catch (e) {
    await supabaseAdmin.from('pendaftaran_member_bulanan').update({ status_daftar: 'batal' }).eq('id', baru.id);
    return res.status(500).json({ error: 'Gagal membuat tagihan iuran: ' + e.message });
  }

  return res.status(200).json({ data: baru, nominal: tagihan.nominal, subsidi: tagihan.subsidi });
}
