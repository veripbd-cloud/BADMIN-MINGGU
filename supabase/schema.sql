-- =========================================================
-- SKEMA DATABASE — Sistem Absensi, Penagihan & Kas Badminton
-- Jalankan file ini di Supabase SQL Editor (Project > SQL Editor > New query)
-- =========================================================

-- ---------- 1. PROFILES (data tambahan di atas auth.users bawaan Supabase) ----------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nama text not null,
  tipe text not null check (tipe in ('member', 'harian')) default 'harian',
  tanggal_daftar timestamptz not null default now(),
  level_self text,                          -- diisi user sendiri saat daftar, TIDAK ditampilkan ke publik
  level_final text,                         -- keputusan admin, ini yang ditampilkan
  status_approval text not null check (status_approval in ('pending','approved')) default 'pending',
  role text not null check (role in ('player','admin','super_admin')) default 'player',
  created_at timestamptz not null default now()
);

-- ---------- 2. PENGATURAN GLOBAL (harga, kuota, deadline — semua bisa diubah admin) ----------
create table pengaturan (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

insert into pengaturan (key, value) values
  ('harga_harian', '35000'),
  ('harga_member_bulanan', '100000'),
  ('kuota_total', '30'),
  ('kuota_member', '20'),
  ('kuota_harian', '10'),
  ('biaya_lapangan_bulanan', '2000000'),
  ('deadline_batal_hari', 'saturday'),   -- hari deadline batal (relatif ke hari sesi)
  ('deadline_batal_jam', '23:59');

-- ---------- 3. SESI MINGGUAN ----------
create table sesi (
  id uuid primary key default gen_random_uuid(),
  tanggal date not null,
  label text,                              -- misal "Minggu, 5 Sept 2026"
  kuota_total int not null default 30,
  kuota_member int not null default 20,
  kuota_harian int not null default 10,
  deadline_batal timestamptz not null,     -- dihitung otomatis dari tanggal sesi & pengaturan
  status text not null check (status in ('draft','buka','selesai')) default 'buka',
  created_at timestamptz not null default now()
);

-- ---------- 4. PENDAFTARAN SESI (per player per sesi) ----------
create table pendaftaran_sesi (
  id uuid primary key default gen_random_uuid(),
  sesi_id uuid not null references sesi(id) on delete cascade,
  player_id uuid not null references profiles(id) on delete cascade,
  tipe_slot text not null check (tipe_slot in ('member','harian')),
  status_daftar text not null check (status_daftar in ('terdaftar','waiting_list','batal')) default 'terdaftar',
  waktu_daftar timestamptz not null default now(),   -- dipakai untuk FIFO waiting list
  status_hadir text check (status_hadir in ('hadir','no_show')),  -- diisi admin di hari-H
  waktu_checkin timestamptz,                          -- diisi admin saat player benar2 tiba di lokasi
  jumlah_game int not null default 0,                 -- counter rotasi, ditambah tiap kali main
  unique (sesi_id, player_id)
);

-- ---------- 5. GAME / ROTASI (per sesi) ----------
create table game (
  id uuid primary key default gen_random_uuid(),
  sesi_id uuid not null references sesi(id) on delete cascade,
  lapangan int not null,
  waktu_input timestamptz not null default now(),
  input_by uuid references profiles(id)
);

create table game_pemain (
  game_id uuid not null references game(id) on delete cascade,
  player_id uuid not null references profiles(id) on delete cascade,
  primary key (game_id, player_id)
);

-- ---------- 6. TAGIHAN BULANAN MEMBER (untuk hitung siklus 3 bulan & subsidi) ----------
create table tagihan_bulanan (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references profiles(id) on delete cascade,
  bulan int not null,          -- 1-12
  tahun int not null,
  nominal_tagihan int not null,       -- nominal final setelah subsidi (0 / 50rb / 100rb)
  tier_subsidi text check (tier_subsidi in ('tidak_eligible','diskon_50','gratis_100')),
  status_bayar text not null check (status_bayar in ('belum_lunas','lunas')) default 'belum_lunas',
  tanggal_lunas timestamptz,
  unique (player_id, bulan, tahun)
);

-- ---------- 7. TRANSAKSI KAS ----------
create table transaksi_kas (
  id uuid primary key default gen_random_uuid(),
  tanggal date not null default current_date,
  jenis text not null check (jenis in ('pemasukan','pengeluaran')),
  kategori text,                 -- 'iuran_member','iuran_harian','bola','lapangan','lain_lain'
  nominal int not null,
  keterangan text,
  player_id uuid references profiles(id),   -- kalau pemasukan terkait pembayaran seseorang
  input_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- ---------- 8. OUTSTANDING (utang belum lunas) ----------
create table outstanding (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references profiles(id) on delete cascade,
  sumber text not null check (sumber in ('no_show_harian','tagihan_bulanan_member','lain_lain')),
  referensi_id uuid,             -- id pendaftaran_sesi atau id tagihan_bulanan terkait
  nominal int not null,
  keterangan text,
  status text not null check (status in ('belum_lunas','lunas')) default 'belum_lunas',
  created_at timestamptz not null default now(),
  tanggal_lunas timestamptz
);

-- =========================================================
-- ROW LEVEL SECURITY — aktifkan biar player cuma bisa lihat/ubah data sendiri
-- Admin & super_admin ditangani lewat API routes pakai service role key (bypass RLS)
-- =========================================================
alter table profiles enable row level security;
alter table pendaftaran_sesi enable row level security;
alter table tagihan_bulanan enable row level security;
alter table outstanding enable row level security;
alter table transaksi_kas enable row level security;
alter table sesi enable row level security;
alter table game enable row level security;
alter table game_pemain enable row level security;

-- Semua orang login boleh baca sesi & kas (transparansi), tapi cuma admin (lewat API) yang boleh tulis
create policy "sesi_read_all" on sesi for select using (true);
create policy "kas_read_all" on transaksi_kas for select using (true);
create policy "outstanding_read_all" on outstanding for select using (true);
create policy "game_read_all" on game for select using (true);
create policy "game_pemain_read_all" on game_pemain for select using (true);

-- Profile: semua orang login boleh lihat profil orang lain (buat leaderboard/daftar member), tapi cuma edit punya sendiri
create policy "profiles_read_all" on profiles for select using (true);
create policy "profiles_update_own" on profiles for update using (auth.uid() = id);
create policy "profiles_insert_own" on profiles for insert with check (auth.uid() = id);

-- Pendaftaran sesi: boleh lihat semua (buat lihat waiting list), tapi cuma insert/update punya sendiri
create policy "pendaftaran_read_all" on pendaftaran_sesi for select using (true);
create policy "pendaftaran_insert_own" on pendaftaran_sesi for insert with check (auth.uid() = player_id);
create policy "pendaftaran_update_own" on pendaftaran_sesi for update using (auth.uid() = player_id);

-- Tagihan bulanan: cuma boleh lihat punya sendiri
create policy "tagihan_read_own" on tagihan_bulanan for select using (auth.uid() = player_id);

-- Catatan: operasi ADMIN (ubah harga, tandai kehadiran, assign lapangan, catat kas, approve level,
-- proses subsidi) semuanya lewat Next.js API routes di server yang pakai SUPABASE SERVICE ROLE KEY,
-- jadi otomatis bypass RLS di atas. RLS ini hanya proteksi baseline kalau ada yang akses langsung
-- dari client dengan anon key.
