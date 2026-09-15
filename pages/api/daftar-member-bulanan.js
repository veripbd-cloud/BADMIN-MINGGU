import { supabaseAdmin, getProfileFromRequest } from '../../lib/supabaseAdmin';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const profile = await getProfileFromRequest(req);
  if (!profile) return res.status(401).json({ error: 'Belum login' });

  const { sesi_member_bulanan_id } = req.body;
  if (!sesi_member_bulanan_id) return res.status(400).json({ error: 'sesi_member_bulanan_id wajib diisi' });

  const { data: sesi } = await supabaseAdmin
    .from('sesi_member_bulanan')
    .select('*')
    .eq('id', sesi_member_bulanan_id)
    .single();
  if (!sesi) return res.status(404).json({ error: 'Sesi tidak ditemukan' });

  if (new Date() > new Date(sesi.deadline_daftar)) {
    return res.status(400).json({ error: 'Sudah lewat deadline pendaftaran. Hubungi admin kalau perlu diproses manual.' });
  }

  const { data: barisLama } = await supabaseAdmin
    .from('pendaftaran_member_bulanan')
    .select('*')
    .eq('sesi_member_bulanan_id', sesi_member_bulanan_id)
    .eq('player_id', profile.id)
    .maybeSingle();

  if (barisLama && barisLama.status_daftar !== 'batal') {
    return res.status(400).json({ error: 'Kamu sudah terdaftar untuk bulan ini.' });
  }

  let baru;
  if (barisLama) {
    const { data } = await supabaseAdmin
      .from('pendaftaran_member_bulanan')
      .update({ status_daftar: 'terdaftar', waktu_daftar: new Date().toISOString() })
      .eq('id', barisLama.id)
      .select()
      .single();
    baru = data;
  } else {
    const { data } = await supabaseAdmin
      .from('pendaftaran_member_bulanan')
      .insert({ sesi_member_bulanan_id, player_id: profile.id })
      .select()
      .single();
    baru = data;
  }

  // Langsung bikin outstanding Rp100rb (harga member bulanan dari pengaturan)
  const { data: hargaSetting } = await supabaseAdmin
    .from('pengaturan').select('value').eq('key', 'harga_member_bulanan').single();
  const nominal = parseInt(hargaSetting?.value || '100000', 10);

  const { data: outstandingLama } = await supabaseAdmin
    .from('outstanding')
    .select('id')
    .eq('sumber', 'tagihan_bulanan_member')
    .eq('referensi_id', baru.id)
    .maybeSingle();

  if (!outstandingLama) {
    await supabaseAdmin.from('outstanding').insert({
      player_id: profile.id,
      sumber: 'tagihan_bulanan_member',
      referensi_id: baru.id,
      nominal,
      keterangan: `Iuran member ${sesi.label || `${sesi.bulan}/${sesi.tahun}`}`,
      status: 'belum_lunas',
    });
  }

  return res.status(200).json({ data: baru });
}
