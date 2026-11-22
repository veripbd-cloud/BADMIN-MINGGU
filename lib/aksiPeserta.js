// Fungsi pembantu untuk daftar peserta di halaman sesi (tanpa ketergantungan ke server)

// Bagi peserta jadi tiga kelompok: belum check-in, sudah check-in, tidak hadir
export function kelompokkanPeserta(items) {
  const belum = [];
  const sudah = [];
  const tidakHadir = [];
  items.forEach((p) => {
    if (p.status_hadir === 'no_show') tidakHadir.push(p);
    else if (p.waktu_checkin) sudah.push(p);
    else belum.push(p);
  });
  sudah.sort((a, b) => new Date(a.waktu_checkin) - new Date(b.waktu_checkin));
  return { belum, sudah, tidakHadir };
}

// Aksi mana yang berlaku untuk peserta ini?
//  - hadir / tidak_hadir: hanya yang statusnya masih kosong
//  - ralat: hanya yang statusnya sudah terisi
//  - cancel: siapa pun
export function bisaDiaksi(aksi, p) {
  if (aksi === 'hadir' || aksi === 'tidak_hadir') return !p.status_hadir;
  if (aksi === 'ralat') return !!p.status_hadir;
  if (aksi === 'cancel') return true;
  return false;
}

// Jalankan fn untuk tiap item dengan paling banyak `batas` yang berjalan bersamaan.
// Hasilnya (true/false) sesuai urutan item; kalau fn error, dihitung false.
export async function jalankanBerbatas(items, batas, fn) {
  const hasil = new Array(items.length).fill(false);
  let berikut = 0;
  const pekerja = Array.from({ length: Math.max(1, Math.min(batas, items.length)) }, async () => {
    while (berikut < items.length) {
      const idx = berikut;
      berikut += 1;
      try {
        hasil[idx] = !!(await fn(items[idx]));
      } catch (e) {
        hasil[idx] = false;
      }
    }
  });
  await Promise.all(pekerja);
  return hasil;
}
