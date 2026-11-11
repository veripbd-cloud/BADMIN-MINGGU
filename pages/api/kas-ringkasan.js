import { supabaseAdmin, getProfileFromRequest, isAdmin } from '../../lib/supabaseAdmin';

// Outstanding yang belum dibayar + riwayat stok shuttlecock. Khusus member dan admin.
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  if (req.method !== 'GET') return res.status(405).end();

  const profile = await getProfileFromRequest(req);
  if (!profile) return res.status(401).json({ error: 'Belum login' });
  if (!(profile.tipe === 'member' || isAdmin(profile))) {
    return res.status(403).json({ error: 'Halaman kas khusus member' });
  }

  const { data: o, error: errO } = await supabaseAdmin
    .from('outstanding').select('*').eq('status', 'belum_lunas');
  if (errO) return res.status(500).json({ error: 'Gagal membaca outstanding: ' + errO.message });

  const ids = [...new Set((o || []).map((x) => x.player_id).filter(Boolean))];
  const nama = {};
  if (ids.length) {
    const { data: pemain } = await supabaseAdmin.from('profiles').select('id, nama').in('id', ids);
    (pemain || []).forEach((p) => { nama[p.id] = p.nama; });
  }

  const { data: stok, error: errS } = await supabaseAdmin
    .from('stok_shuttle_log').select('*').order('waktu', { ascending: false }).limit(1000);
  if (errS) return res.status(500).json({ error: 'Gagal membaca stok: ' + errS.message });

  return res.status(200).json({
    outstanding: (o || []).map((x) => ({
      id: x.id,
      nama: x.player_id ? (nama[x.player_id] || null) : (x.nama_guest || null),
      keterangan: x.keterangan,
      nominal: x.nominal,
    })),
    stok: stok || [],
  });
}
