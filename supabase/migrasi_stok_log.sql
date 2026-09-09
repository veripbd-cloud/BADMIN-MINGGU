-- Histori perubahan stok shuttlecock (tambah/kurangi), biar bisa ditampilkan sebagai
-- rekapan list kayak Riwayat Transaksi Kas, bukan cuma 1 angka yang ditimpa terus.
create table if not exists stok_shuttle_log (
  id uuid primary key default gen_random_uuid(),
  waktu timestamptz not null default now(),
  arah text not null check (arah in ('tambah','kurangi')),
  slop int not null default 0,
  piece int not null default 0,
  delta_piece int not null,       -- selisih net yang beneran diterapkan (bisa beda dari input kalau di-floor ke 0)
  saldo_setelah int not null,     -- saldo piece setelah transaksi ini (buat ditampilkan per baris)
  keterangan text,
  input_by uuid references profiles(id)
);

alter table stok_shuttle_log enable row level security;
create policy "stok_shuttle_log_read_all" on stok_shuttle_log for select using (true);

-- Kalau sebelumnya sudah ada angka tersimpan di pengaturan (dari versi lama), pindahkan
-- jadi 1 baris histori awal biar stoknya gak kereset ke 0. Aman dijalankan walau
-- pengaturan.stok_shuttle_piece belum pernah ada / masih 0 (gak insert apa-apa).
insert into stok_shuttle_log (arah, slop, piece, delta_piece, saldo_setelah, keterangan)
select 'tambah', floor(value::int / 12), value::int % 12, value::int, value::int, 'Migrasi dari data lama'
from pengaturan
where key = 'stok_shuttle_piece' and value::int > 0;
