-- Semua penulisan pendaftaran_sesi lewat API server (service role). Dua policy ini tidak
-- dipakai aplikasi dan hanya membuka celah (orang bisa menulis langsung dari browser).
drop policy if exists "pendaftaran_insert_own" on pendaftaran_sesi;
drop policy if exists "pendaftaran_update_own" on pendaftaran_sesi;
