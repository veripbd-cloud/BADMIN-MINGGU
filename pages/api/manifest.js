import { supabaseAdmin } from '../../lib/supabaseAdmin';

export default async function handler(req, res) {
  let nama = 'Badmin Minggu';
  try {
    const { data } = await supabaseAdmin
      .from('pengaturan').select('key, value').in('key', ['brand_bagian1', 'brand_bagian2']);
    const map = {};
    (data || []).forEach((r) => { map[r.key] = r.value; });
    const gabung = `${map.brand_bagian1 ?? ''} ${map.brand_bagian2 ?? ''}`.trim();
    if (gabung) nama = gabung;
  } catch (e) { /* pakai nama bawaan */ }

  res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300');
  return res.status(200).send(JSON.stringify({
    name: nama,
    short_name: nama,
    description: 'Absensi sesi mingguan, kas, stok shuttlecock, dan konfirmasi member badminton.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#10261d',
    theme_color: '#10261d',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  }));
}
