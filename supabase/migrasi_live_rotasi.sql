-- Tambah kolom buat live-tracking status main pemain per sesi
alter table pendaftaran_sesi add column if not exists status_main text
  check (status_main in ('menunggu','main'));
alter table pendaftaran_sesi add column if not exists lapangan_sekarang text;

-- Ubah kolom lapangan di tabel game jadi text (biar bisa isi "A6", "A7", dst, bukan cuma angka)
alter table game alter column lapangan type text;
