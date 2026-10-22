# Absensi, Kas & Rotasi Main — Grup Badminton Mingguan

Aplikasi web untuk mengelola sesi main mingguan: pendaftaran & waiting list, absensi,
rotasi lapangan, kas, outstanding (tagihan), stok shuttlecock, dan konfirmasi member bulanan.

> **Nama brand tidak ditulis di kode.** Nama yang tampil di pojok kiri atas diatur dari
> halaman **Admin → Pengaturan Harga, Kuota & Nama Brand** (disimpan di tabel `pengaturan`,
> kunci `brand_bagian1` = bagian putih, `brand_bagian2` = bagian oranye) dan dibaca lewat `/api/brand`.

Dokumen ini ditulis dari kondisi kode per Oktober 2026. Jangan taruh password, key, atau data
anggota di file ini.

## Teknologi & hosting
- Next.js 14 (Pages Router) + React 18
- Supabase: database Postgres + login (Auth)
- Vercel: hosting, deploy otomatis setiap ada commit di GitHub
- Environment variable (diisi di Vercel → Settings → Environment Variables, **bukan** di GitHub):
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

`SUPABASE_SERVICE_ROLE_KEY` adalah kunci super-admin database. Cuma boleh dipakai di
`pages/api/*` (server) lewat `lib/supabaseAdmin.js`. Jangan pernah di-import dari halaman/komponen.

## Peran
- **player**: daftar & batal sesi, lihat profil sendiri. Tab Kas hanya untuk member.
- **admin**: semua fitur admin (absensi, rotasi, kas, kelola user).
- **super_admin**: sama dengan admin; peran diatur manual di Supabase (tabel `profiles`, kolom `role`).
- Akun baru berstatus `pending` sampai di-approve admin (Admin → Pending Approval).

## Struktur folder
- `pages/` halaman: `index.js` (Sesi & Member), `sesi/[id].js` (detail sesi, absensi, lapangan),
  `kas.js` (Kas & Shuttlecock), `profile.js`, `admin/index.js`, `admin/users.js`,
  `member-bulanan/[id].js` (peserta konfirmasi member), `login.js`, `register.js`, `reset-password.js`
- `pages/api/` endpoint server. Folder `api/admin/` hanya untuk admin (semua mengecek peran).
  Endpoint pemain: `daftar-sesi`, `batal-sesi`, `daftar-member-bulanan`, `batal-member-bulanan`, `brand`, `manifest` (agar bisa dipasang di layar HP).
- `lib/` `supabaseClient.js` (browser), `supabaseAdmin.js` (server), `useAuth.js` (sesi login)
- `components/TopBar.js` navbar + nama brand; `components/Toast.js` pemberitahuan kecil
- `styles/globals.css` seluruh tampilan
- `supabase/` skema & migrasi SQL (lihat bagian Database)
- `public/` ikon tab dan gambar preview link

## Aturan bisnis (angka bisa diubah di Admin → Pengaturan)
- **Kapasitas**: maksimal 30 orang per sesi (member + harian + guest, satu kolam bersama = 4 lapangan).
  `kuota_guest` hanyalah batas tambahan khusus guest.
- **Member otomatis terdaftar** di setiap sesi mingguan baru. Member yang tidak bisa main wajib
  menekan **Batal**; slotnya otomatis naik ke antrean harian paling depan.
- **Batal oleh pemain**: boleh sampai H-1 pukul 23:59 WIB. Setelahnya hanya admin ("Cancel").
- **Jam main** 07:00–10:00 WIB. Lewat 10:00 sesi dianggap selesai, kontrol admin terkunci,
  dan harian/guest yang belum ditandai otomatis dicatat tidak hadir.
- **Harian & guest**: ditandai Hadir atau Tidak Hadir → otomatis muncul outstanding sesuai `harga_harian`.
  Member tidak kena tagihan per sesi.
- **Antrean main**: urut siapa yang hadir/check-in lebih dulu (FIFO); selesai main kembali ke belakang.
  Admin bisa memilih siapa pun dan lapangan mana pun; tombol Batal membatalkan game yang salah mulai.
- **Outstanding** dilunasi admin di halaman Kas → otomatis tercatat sebagai pemasukan kas.
- **Konfirmasi Member Bulanan** (Admin → Buat Baru): pemain mendaftar → muncul outstanding iuran
  member. Deadline otomatis 2 hari sejak dibuka, pukul 23:59 WIB. Harian yang daftar dan lunas
  otomatis menjadi member; member yang tidak daftar diturunkan menjadi harian.
- **Harga subsidi**: di bulan terakhir kuartal tetap (Des, Mar, Jun, Sep), member yang terdaftar
  tiga bulan berturut-turut (bulan itu + dua bulan sebelumnya dalam kuartal yang sama; riwayat diambil
  dari tabel `pendaftaran_member_bulanan`) ditagih sebesar `harga_member_subsidi`. Isi dulu di
  Pengaturan sebelum membuka sesi bulan itu. Nilai 0 = gratis (tidak ada tagihan).
- **Stok shuttlecock**: tambah stok (beli) atau set sisa stok hasil hitung fisik; sistem menghitung selisih terpakai.

## Database (Supabase)
Tabel: `profiles`, `pengaturan`, `sesi`, `pendaftaran_sesi`, `game`, `game_pemain`,
`tagihan_bulanan`, `transaksi_kas`, `outstanding`, `stok_shuttle_log`,
`sesi_member_bulanan`, `pendaftaran_member_bulanan`.

Urutan SQL (jalankan di Supabase → SQL Editor, sekali saja per file):
1. `schema.sql`
2. `migrasi_guest.sql`, `migrasi_live_rotasi.sql`, `migrasi_stok_log.sql`
3. `migrasi_outstanding_guest.sql`, `migrasi_member_bulanan.sql`
4. `migrasi_subsidi_sync_brand.sql` (nama brand, pengaturan hanya-baca dari browser) dan
   `migrasi_perbaikan_okt.sql` (penanda sesi konfirmasi member yang sudah diproses)
5. **Keamanan**: `migrasi_lock_profiles.sql` dan `migrasi_lock_pendaftaran.sql`
6. `cek_status_database.sql` → jalankan untuk memastikan langkah 5 benar-benar terpasang

Catatan: `schema.sql` adalah skema awal dan tidak mencerminkan semua perubahan; sebagian perubahan
dilakukan lewat migrasi. `migrasi_member_sejak.sql` dan `bersihkan_histori.sql` bukan bagian setup
normal (yang kedua menghapus seluruh riwayat sesi/kas — hati-hati).

## Cara update lewat GitHub
1. Buka file yang mau diganti di GitHub, hapus (ikon tong sampah), commit.
2. Upload file baru **di folder yang sama persis**. Menimpa langsung sering tidak terbaca.
3. Buka Vercel → Deployments, tunggu status **Ready**. Kalau merah, buka Build Logs.
   Error `Module not found` hampir selalu berarti file berada di folder yang salah.

## Hal yang perlu diingat saat operasional
- Penurunan status member yang tidak konfirmasi diproses **sekali saja per bulan**, otomatis saat admin
  membuat sesi baru (mingguan atau konfirmasi bulanan) atau membuka halaman peserta bulan itu setelah
  deadline. Halaman bulan-bulan lama hanya untuk melihat, tidak mengubah apa pun. Sesi mingguan yang
  sudah terlanjur dibuat sebelum proses ini tidak ikut berubah (pakai Cancel untuk satu per satu).
- Pencatatan otomatis "tidak hadir" (dan tagihan) untuk harian/guest berjalan saat admin membuka halaman
  sesi setelah jam 10:00, hanya sampai 3 hari setelah sesi. Tetap tandai Hadir/Tidak Hadir langsung di lokasi.
- Akun super admin hanya bisa diubah oleh super admin.
