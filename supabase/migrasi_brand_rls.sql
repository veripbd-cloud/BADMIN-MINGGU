-- Nama brand yang bisa diedit dari halaman Admin
insert into pengaturan (key, value) values
  ('brand_bagian1', 'BADMIN'),
  ('brand_bagian2', 'MINGGU')
on conflict (key) do nothing;

-- Kunci tabel pengaturan: semua orang (termasuk yang belum login, buat nampilin nama brand
-- di halaman login) boleh BACA. Nulis cuma lewat API admin (service role), bukan langsung
-- dari browser.
alter table pengaturan enable row level security;
drop policy if exists "pengaturan_read_all" on pengaturan;
create policy "pengaturan_read_all" on pengaturan for select using (true);
