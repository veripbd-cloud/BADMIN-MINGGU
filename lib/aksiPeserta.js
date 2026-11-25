// Fungsi pembantu untuk daftar peserta di halaman sesi (tanpa ketergantungan ke server)

// Urutkan A-Z menurut nama (tidak membedakan huruf besar/kecil)
export function urutkanAZ(items, ambilNama) {
  return [...items].sort((a, b) =>
    String(ambilNama(a) || '').localeCompare(String(ambilNama(b) || ''), 'id', { sensitivity: 'base' })
  );
}

// Bagi peserta jadi tiga kelompok: belum check-in, sudah check-in, tidak hadir.
// Kalau ambilNama diberikan, tiap kelompok diurutkan A-Z.
export function kelompokkanPeserta(items, ambilNama) {
  const belum = [];
  const sudah = [];
  const tidakHadir = [];
  items.forEach((p) => {
    if (p.status_hadir === 'no_show') tidakHadir.push(p);
    else if (p.waktu_checkin) sudah.push(p);
    else belum.push(p);
  });
  if (ambilNama) {
    return { belum: urutkanAZ(belum, ambilNama), sudah: urutkanAZ(sudah, ambilNama), tidakHadir: urutkanAZ(tidakHadir, ambilNama) };
  }
  sudah.sort((a, b) => new Date(a.waktu_checkin) - new Date(b.waktu_checkin));
  return { belum, sudah, tidakHadir };
}

// Susun daftar bergrup jadi DUA kolom: kolom kiri diisi dulu (maksimal perKolom), sisanya ke kolom kanan.
// Kalau totalnya lebih dari 2 x perKolom, dibagi dua rata. Judul kelompok disisipkan di kolom tempat
// kelompok itu mulai; kalau kelompok berlanjut ke kolom kanan, judulnya diulang dengan tanda "lanjutan".
// grup: [{ kunci, judul (null = tanpa judul), data: [...] }]
export function susunDuaKolom(grup, perKolom = 15) {
  const urutan = [];
  grup.forEach((g) => g.data.forEach((item) => urutan.push({ g, item })));
  const n = urutan.length;
  const kiri = Math.min(n, Math.max(perKolom, Math.ceil(n / 2)));
  const kolom = [[], []];
  let kolomTerakhir = -1;
  let grupTerakhir = null;
  urutan.forEach((e, i) => {
    const k = i < kiri ? 0 : 1;
    if (e.g.judul && (k !== kolomTerakhir || e.g.kunci !== grupTerakhir)) {
      kolom[k].push({ tipe: 'judul', g: e.g, lanjutan: kolomTerakhir !== -1 && k !== kolomTerakhir && grupTerakhir === e.g.kunci });
    }
    kolom[k].push({ tipe: 'baris', g: e.g, item: e.item });
    kolomTerakhir = k;
    grupTerakhir = e.g.kunci;
  });
  return kolom;
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
