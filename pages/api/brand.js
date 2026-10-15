import { supabaseAdmin } from '../../lib/supabaseAdmin';

const DEFAULT = { bagian1: 'BADMIN', bagian2: 'MINGGU' };

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  if (req.method !== 'GET') return res.status(405).end();

  const { data, error } = await supabaseAdmin
    .from('pengaturan')
    .select('key, value')
    .in('key', ['brand_bagian1', 'brand_bagian2']);

  if (error) {
    return res.status(500).json({ sumber: 'error', error: error.message, brand: DEFAULT });
  }

  const map = {};
  (data || []).forEach((r) => { map[r.key] = r.value; });
  const adaDiDatabase = map.brand_bagian1 !== undefined || map.brand_bagian2 !== undefined;

  return res.status(200).json({
    sumber: adaDiDatabase ? 'database' : 'default',
    brand: {
      bagian1: map.brand_bagian1 ?? DEFAULT.bagian1,
      bagian2: map.brand_bagian2 ?? DEFAULT.bagian2,
    },
  });
}
