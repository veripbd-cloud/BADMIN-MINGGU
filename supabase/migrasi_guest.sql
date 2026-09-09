-- Fitur Guest: pemain dadakan yang ditambahin admin langsung, tanpa perlu akun/daftar sendiri.

-- Izinkan player_id kosong (guest tidak punya akun), tambah kolom nama_guest
alter table pendaftaran_sesi alter column player_id drop not null;
alter table pendaftaran_sesi add column if not exists nama_guest text;

-- Izinkan tipe_slot = 'guest' selain member/harian
alter table pendaftaran_sesi drop constraint if exists pendaftaran_sesi_tipe_slot_check;
alter table pendaftaran_sesi add constraint pendaftaran_sesi_tipe_slot_check
  check (tipe_slot in ('member','harian','guest'));

-- Pastikan tiap baris punya salah satu: player_id (akun beneran) ATAU nama_guest (guest dadakan)
alter table pendaftaran_sesi drop constraint if exists pendaftaran_sesi_player_or_guest;
alter table pendaftaran_sesi add constraint pendaftaran_sesi_player_or_guest
  check (player_id is not null or nama_guest is not null);

-- Tabel game_pemain: primary key lama (game_id, player_id) tidak bisa dipakai lagi
-- karena player_id perlu boleh kosong (guest tidak punya player_id). Ganti ke ID sendiri.
alter table game_pemain drop constraint if exists game_pemain_pkey;
alter table game_pemain add column if not exists id uuid default gen_random_uuid();
alter table game_pemain add primary key (id);
alter table game_pemain alter column player_id drop not null;
alter table game_pemain add column if not exists pendaftaran_sesi_id uuid references pendaftaran_sesi(id) on delete cascade;

-- Kuota guest per sesi (default 3, bisa diubah admin lewat halaman Admin)
insert into pengaturan (key, value) values ('kuota_guest', '3') on conflict (key) do nothing;
