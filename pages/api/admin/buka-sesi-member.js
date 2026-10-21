import { supabaseAdmin, getProfileFromRequest, isAdmin } from '../../../lib/supabaseAdmin';
import { BULAN_KUARTAL_AKHIR, prosesSesiTertunggak } from '../../../lib/memberBulanan';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const profile = await getProfileFromRequest(req);
  if (!isAdmin(profile)) return res.status(403).json({ error: 'Khusus admin' });

  const { bulan, tahun, label } = req.body;
  if (!bulan || !tahun) return res.status(400).json({ error: 'bulan & tahun wajib diisi' });

  // Bulan subsidi (Des/Mar/Jun/Sep): harga subsidi wajib sudah diisi di Pengaturan (0 = gratis, boleh)
  if (BULAN_KUARTAL_AKHIR.includes(parseInt(bulan, 10))) {
    const { data: setting } = await supabaseAdmin
      .from('pengaturan').select('value').eq('key', 'harga_member_subsidi').maybeSingle();
    const nilai = setting?.value;
    if (nilai === undefined || nilai === null || String(nilai).trim() === '') {
      return res.status(400).json({
        error: 'Bulan ini adalah bulan subsidi (Des/Mar/Jun/Sep). Isi dulu "Harga member bulanan (Subsidi) (Rp)" di Pengaturan Harga, Kuota & Nama Brand sebelum buka sesi ini.',
      });
    }
  }

  // Rapikan status member dari konfirmasi bulan sebelumnya (kalau belum diproses)
  await prosesSesiTertunggak();

  const sekarang = new Date();
  const duaHariLagi = new Date(sekarang.getTime() + 2 * 24 * 60 * 60 * 1000);
  const yyyy = duaHariLagi.getUTCFullYear();
  const mm = String(duaHariLagi.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(duaHariLagi.getUTCDate()).padStart(2, '0');
  const deadline = new Date(`${yyyy}-${mm}-${dd}T23:59:00+07:00`);

  const { data, error } = await supabaseAdmin
    .from('sesi_member_bulanan')
    .insert({
      bulan: parseInt(bulan, 10), tahun: parseInt(tahun, 10), label: label || null,
      dibuka_pada: sekarang.toISOString(), deadline_daftar: deadline.toISOString(),
    })
    .select().single();

  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ data });
}
