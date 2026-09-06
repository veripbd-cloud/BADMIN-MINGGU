# Kumpul Badminton — Absensi, Kas & Rotasi Main

Aplikasi web untuk kelola absensi mingguan, slot & waiting list, rotasi main,
penagihan (member bulanan + harian), subsidi 3-bulan, dan kas — sesuai spesifikasi
yang sudah didiskusikan.

Tidak ada fitur skor pertandingan / leaderboard kompetitif — sengaja tidak dibuat.

---

## Apa yang sudah ada

- Registrasi akun sendiri (player pilih tipe member/harian + level perkiraan sendiri)
- Approval level oleh admin (tidak menghalangi absensi)
- Daftar/batal sesi mingguan dengan slot member+harian terpisah, waiting list FIFO per tipe
- Admin bisa promosi manual dari waiting list (di luar urutan FIFO)
- Check-in manual oleh admin di hari-H
- Tandai hadir/no-show — no-show harian otomatis masuk outstanding, member tidak
- Input game per lapangan oleh admin (assign manual), dengan rekomendasi next-up otomatis
- Halaman kas: saldo, riwayat transaksi, dashboard outstanding
- Perhitungan tagihan bulanan member + subsidi 3-bulan (50% / gratis) berdasarkan sisa kas
- 3 role: Super Admin, Admin, Player

## Yang PERLU kamu lakukan manual (bukan otomatis di sistem)

- Terima transfer BCA / DANA dari member & harian secara manual, lalu klik "Tandai Lunas"
  di halaman Kas atau update status_bayar di tagihan_bulanan.
- Menentukan siapa jadi Admin/Super Admin (lihat langkah 6 di bawah).
- Menjalankan "Proses Tagihan & Subsidi Bulanan" di halaman Admin tiap akhir bulan,
  setelah biaya bola bulan itu sudah diketahui.

---

## Langkah Setup (sekali di awal)

### 1. Bikin akun Supabase (gratis)
1. Buka https://supabase.com → Sign up (bisa pakai akun Google)
2. Klik **New Project** → kasih nama (misal `kumpul-badminton`) → pilih password database (simpan baik-baik) → pilih region terdekat (Singapore) → Create.
3. Tunggu sekitar 1-2 menit sampai project siap.

### 2. Jalankan skema database
1. Di dashboard Supabase, buka menu **SQL Editor** (ikon di sidebar kiri) → **New query**.
2. Buka file `supabase/schema.sql` dari project ini, copy semua isinya, paste ke SQL Editor.
3. Klik **Run**. Kalau berhasil, akan muncul tabel-tabel baru di menu **Table Editor**.

### 3. Ambil API key
1. Di dashboard Supabase: **Project Settings** (ikon gear) → **API**.
2. Catat 3 hal ini:
   - **Project URL**
   - **anon public** key
   - **service_role** key (klik "Reveal" untuk lihat) — INI RAHASIA, jangan disebar.

### 4. Setup project di komputer kamu
```bash
# masuk ke folder project ini
cp .env.example .env.local
```
Buka file `.env.local`, isi 3 nilai di atas ke variabel yang sesuai.

```bash
npm install
npm run dev
```
Buka `http://localhost:3000` di browser untuk coba lokal dulu.

### 5. Deploy ke Vercel (gratis, biar bisa diakses semua orang lewat link)
1. Push folder project ini ke GitHub (bikin repo baru, gratis).
2. Buka https://vercel.com → Sign up pakai akun GitHub yang sama.
3. Klik **Add New > Project**, pilih repo yang tadi kamu push.
4. Sebelum klik Deploy, buka bagian **Environment Variables**, masukkan 3 nilai yang sama
   seperti di `.env.local` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`).
5. Klik **Deploy**. Setelah selesai (1-2 menit), kamu dapat link publik (misal
   `kumpul-badminton.vercel.app`) yang bisa dibagikan ke semua member.

### 6. Jadikan diri kamu Super Admin
Setelah kamu daftar akun pertama lewat halaman `/register` di web yang sudah live:
1. Buka Supabase dashboard → **Table Editor** → tabel `profiles`.
2. Cari baris dengan nama kamu, ubah kolom `role` dari `player` menjadi `super_admin`.
3. Ulangi untuk 3 orang lain yang jadi admin biasa (`role` = `admin`).

Setelah itu, akun-akun tersebut akan melihat menu **Admin** muncul di navigasi web.

---

## Catatan penting soal subsidi 3-bulan

Perhitungan "sudah 3 bulan berturut lunas" dilakukan otomatis oleh sistem berdasarkan
riwayat di tabel `tagihan_bulanan`. Karena ini menyangkut uang dan ada banyak kondisi
tepi (member yang baru pertama kali ditagih belum punya riwayat, dll), **selalu cek
hasil di layar sebelum benar-benar menagih** — angka yang tampil (`jumlah_eligible`,
`tier_untuk_eligible`, `sisa_kas_dihitung`) itu untuk direview, bukan langsung final
tanpa dicek.

## Batasan versi ini (MVP)

- Belum ada notifikasi otomatis (WhatsApp/email) — pemberitahuan masih manual oleh admin.
- Belum ada halaman khusus "riwayat 3 bulan per member" yang visual — datanya ada di
  tabel `tagihan_bulanan`, bisa dilihat lewat Supabase Table Editor kalau perlu audit.
- Supabase free tier akan auto-pause project kalau 7 hari tidak ada aktivitas sama
  sekali — tinggal buka dashboard dan klik "Resume", gratis, tidak hilang datanya.
