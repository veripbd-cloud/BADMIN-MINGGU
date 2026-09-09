-- Field terpisah dari tanggal_daftar (waktu bikin akun), buat catat sejak kapan
-- orangnya BENERAN mulai main/jadi member (bisa lebih lama dari tanggal bikin akun).
-- Kalau kosong (belum diset admin), sistem fallback pakai tanggal_daftar.
alter table profiles add column if not exists member_sejak date;
