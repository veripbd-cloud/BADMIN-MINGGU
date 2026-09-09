-- Membersihkan data histori sesi/kas/outstanding (data testing).
-- Tabel profiles TIDAK disentuh sama sekali.
truncate table game_pemain cascade;
truncate table game cascade;
truncate table pendaftaran_sesi cascade;
truncate table sesi cascade;
truncate table transaksi_kas cascade;
truncate table outstanding cascade;
truncate table tagihan_bulanan cascade;
