# Log prediksi

Aturan: satu entri per masalah. Bagian **Sebelum perbaikan** harus di-commit *sebelum* commit
perbaikannya. Bagian **Sesudah perbaikan** diisi setelah pengukuran ulang. Jangan menyunting
bagian "sebelum" setelah hasilnya diketahui; bila prediksi meleset, jelaskan di bagian "sesudah".

**Cakupan berkas ini:** skenario **S1** (ketik `sepatu` huruf demi huruf, lalu hapus semuanya),
tiket **TK-1041**. Skenario lain (S0, S2-S6) belum dicakup.

**Dasar prediksi:** hanya trace baseline `Percobaan 1-3 / baseline / s1` dan kode pada commit
`b66b5db` (baseline). Trace "sesudah" dan perubahan kode setelah baseline tidak dipakai.

---

## Catatan kualitas data baseline

Tiga hal ini memengaruhi cara membaca angka di bawah. Perlu dinyatakan di laporan.

1. **Percobaan 1 tidak sesuai protokol.** Tangkapan layar menunjukkan kolom cari berisi
   `sepsepatu` (9 ketikan, bukan 6). Tiga ketikan pertama (`s`, `se`, `sep`) tetap sah dipakai.
   Enam ketikan sisanya menghasilkan 0 hasil, jadi dipakai hanya untuk mengisolasi biaya SDK (P-03).
2. **Variasi antar percobaan besar.** Ketikan pertama `s`: 5.285 ms, 2.080 ms, 4.186 ms (selisih 2,5 kali).
   Ini menandakan throttle CPU atau kondisi mesin tidak konsisten antar percobaan.
   Bandingkan sebelum dan sesudah hanya dari satu mesin dan konfigurasi yang sama.
3. **Langkah "hapus semuanya" tidak terekam** di Percobaan 2 dan 3 (hanya 6 event `input`, semuanya
   ketikan huruf). Prediksi tentang penghapusan (bagian akhir) belum punya bukti baseline dan harus
   direkam ulang sebelum diuji.

### Angka baseline yang dipakai (4x CPU slowdown, 3.000 produk)

Durasi handler `input` per ketikan, dari track Main (event `EventDispatch` tipe `input`):

| Ketikan | Hasil cocok | Kartu di DOM | Percobaan 1 | Percobaan 2 | Percobaan 3 | Median 3x |
|---|---|---|---|---|---|---|
| `s` | 2.897 | ±2.897 | 5.285 ms | 2.080 ms | 4.186 ms | **4.186 ms** |
| `se` | 1.179 | ±1.179 | 1.714 ms | 707 ms | 1.497 ms | **1.497 ms** |
| `sep` | 145 | 145 | 418 ms | 188 ms | 448 ms | **418 ms** |
| `sepa` | 106 | 106 | (typo) | 165 ms | 357 ms | 165-357 ms |
| `sepat` | 106 | 106 | (typo) | 124 ms | 284 ms | 124-284 ms |
| `sepatu` | 106 | 106 | (typo) | 148 ms | 206 ms | 148-206 ms |

Jumlah hasil dihitung ulang dari data server dengan fungsi `cocok()` yang sama. Total objek layout
di trace (29.309 untuk `s`, 11.897 untuk `se`) konsisten dengan ±10 objek per kartu.

INP yang tercatat panel Performance: **7.542 ms** (Percobaan 1) dan **2.913 ms** (Percobaan 2).
Percobaan 3 tidak mencatat event UserInteraction, jadi memakai durasi handler di atas sebagai pengganti.

Pembagian waktu selama handler `input` (self time dari CPU profile, tiga percobaan):

| Fungsi | Pangsa dari total handler | Keterangan |
|---|---|---|
| `samakanTinggiJudul` (`katalog.js`) | 46-50% | termasuk layout sinkron yang dipicunya |
| `buatKartu` + `renderProduk` + `el` + `append` | ±12-15% | membangun DOM kartu |
| `periksaGulir` (`gulir.js`) | 9-11% | baca-tulis berselang-seling per kartu |
| `formatRupiah` (`util.js`) | 7-9% | |
| `f` di `lacak.min.js` (SDK) | 4-6% | 20-53 ms per panggilan |

Pola umum per ketikan: **27 pemanggilan Layout dan 28 UpdateLayoutTree dalam satu handler**.
Layout pertama berukuran penuh (29.107 dari 29.310 objek kotor pada `s`, 451 ms di Percobaan 2).
Dua puluh tiga layout berikutnya kecil (8 objek kotor, 7-21 ms pada `s`). Satu layout berikutnya
besar lagi (4.309 objek, 200 ms). Setelah handler selesai masih ada jeda ±773 ms sampai paint
berikutnya pada `s` (±202 ms pada `sep`).

---

## P-01: Setiap ketikan membangun ulang seluruh hasil pencarian di DOM

**Tiket terkait:** TK-1041
**Tanggal dan hash commit entri ini:** 2026-10-16, (isi hash setelah commit)

### Sebelum perbaikan

- **Yang teramati di trace (baseline):** durasi handler mengikuti jumlah hasil, bukan jumlah huruf
  yang diketik: 2.897 kartu menghabiskan 2.080-5.285 ms, 145 kartu menghabiskan 188-448 ms.
  Track Main memperlihatkan satu task panjang berisi `Event: input > terapkanSaringan > renderProduk`.
  `buatKartu` (±10 node per kartu), `formatRupiah`, dan `el` muncul tinggi di bottom-up.
  Total objek layout 29.309 pada `s`. INP 7.542 ms dan 2.913 ms.
- **Dugaan mekanisme:** `renderProduk` mengosongkan `#kisi` dengan `innerHTML = ''` lalu membuat
  ulang seluruh kartu hasil secara sinkron di dalam handler `input`. Semuanya satu task di main
  thread, tanpa rendering opportunity di tengahnya. Pengguna tidak melihat huruf yang baru diketik
  sampai task selesai (presentation delay bertambah ±773 ms setelah handler pada `s`). Huruf
  berikutnya antre di task queue, sehingga huruf "muncul telat-telat" dan layar tampak hang (sesuai
  keluhan Bu Wulan). Biaya berskala linear terhadap jumlah kartu: JavaScript (bangun node), Style,
  Layout (29k objek), Paint.
- **Rencana perubahan:** hanya render sebagian kecil hasil di layar (jendela sekitar viewport, misalnya
  40-60 kartu pertama), lalu tambah sisanya bertahap dalam potongan kecil yang masing-masing diberi
  jeda ke event loop (`scheduler.yield()` atau `requestIdleCallback`), dan batalkan pekerjaan lama
  bila ada ketikan baru. Teks `#ringkasan` diperbarui langsung dengan jumlah hasil yang benar, jadi
  aturan "jumlah hasil harus benar" dan "semua produk tetap bisa dijangkau" tetap terpenuhi.
  Tambahkan `content-visibility: auto` dengan `contain-intrinsic-size` pada `.kartu` supaya kartu
  di luar layar tidak ikut di-layout dan di-paint.
- **Prediksi terukur:** setelah perubahan, durasi handler `input` untuk `s` turun dari median
  ±4.186 ms menjadi sekitar **60-150 ms**, karena yang dikerjakan di dalam task interaksi hanya
  ±50 kartu (biaya bangun node dasar ±0,13 ms per kartu di throttle ini, jadi ±7-10 ms) ditambah satu
  layout kecil. Jumlah objek yang di-layout pada `s` turun dari ±29.000 menjadi ±500-1.000 pada
  frame pertama. Total CPU untuk menyusun semua hasil **tidak berkurang**, hanya dipindah ke task
  kecil berikutnya. Task terbesar selama S1 diperkirakan <50 ms.
  **Efek samping yang mungkin memburuk:**
  1. Saat pengguna langsung menggulir cepat setelah mengetik, potongan susulan bisa bersaing dengan
     scroll (risiko untuk S5, perlu direkam ulang).
  2. Tanpa `contain-intrinsic-size` yang benar, tinggi dokumen berubah saat potongan baru masuk
     sehingga CLS naik dan scrollbar melompat.
  3. Total waktu sampai semua kartu muncul bisa lebih lama dari sekarang.
- **Alternatif yang dipertimbangkan dan alasan tidak dipilih:**
  - *Hanya `content-visibility: auto` tanpa memangkas node:* memotong biaya Layout dan Paint, tetapi
    `buatKartu` dan `formatRupiah` tetap dijalankan 2.897 kali sehingga biaya JavaScript (±20-25%)
    tetap ada di dalam handler.
  - *Virtual list penuh:* memenuhi target terbaik, tetapi menjaga tinggi gulir dan aksesibilitas
    lebih rumit, dan harga pengerjaannya tidak sebanding untuk tugas ini.
  - *Debounce input:* mengurangi jumlah render, tetapi satu render pada `s` tetap ±4 detik, dan
    huruf di kolom cari tetap telat terlihat.
  - *Batasi hasil (misalnya maksimal 100):* melanggar aturan 3, jumlah hasil dan jangkauan gulir harus utuh.

### Sesudah perbaikan

- **Hash commit perbaikan:**
- **Hasil ukur (median 3 kali):**
- **Prediksi vs kenyataan:**
- **Efek samping yang muncul:**

---

## P-02: Layout sinkron berulang pada `samakanTinggiJudul` dan `periksaGulir`

**Tiket terkait:** TK-1041
**Tanggal dan hash commit entri ini:** 2026-10-16, (isi hash setelah commit)

### Sebelum perbaikan

- **Yang teramati di trace (baseline):** 27 Layout dan 28 UpdateLayoutTree dalam *setiap* handler
  `input`, untuk semua ukuran hasil. Di Percobaan 2 ketikan `s`: Layout total 963 ms, dengan
  satu layout penuh 451 ms, satu layout 200 ms, dan 24 layout kecil berukuran 7-21 ms. Ketikan
  `sep` juga 27 Layout, tetapi 23 di antaranya hanya 0-2 ms. `samakanTinggiJudul` adalah
  fungsi dengan self time terbesar (46-50% dari seluruh handler). Panel Insights menandai "Forced reflow".
- **Dugaan mekanisme:** angka 27 cocok dengan loop `samakanTinggiJudul`, yang mengulang maksimal
  `JUMLAH_CONTOH = 24` kali, ditambah ±3 layout dari `periksaGulir`. Pada tiap iterasi kode
  *menulis* `style.height = 'auto'` (membuat layout kotor) lalu langsung *membaca* `offsetHeight`
  (memaksa layout sinkron sebelum rendering opportunity). Pada `periksaGulir`, `classList.add` dan
  `style.minHeight` (tulis) diselang-seling dengan `getBoundingClientRect` (baca) untuk tiap kartu di
  layar, polanya sama. Ini adalah layout thrashing di tahap Layout, di dalam task JavaScript.
  **Perhatian:** layout penuh pertama (451 ms pada `s`) *tidak* disebabkan loop. Layout itu akan tetap
  terjadi sebagai layout normal setelah handler selesai karena DOM baru, jadi membuang loop hanya
  memindahkannya. Yang benar-benar hilang hanya ±24 layout kecil, ditambah UpdateLayoutTree-nya.
- **Rencana perubahan:** (a) ganti penyamaan tinggi lewat JavaScript dengan CSS: `line-clamp` 2-3 baris
  dan `min-height` berbasis `lh`/`em` pada `.kartu-judul`, atau baca semua tinggi dulu baru tulis
  sekali (batch baca-lalu-tulis). (b) Di `periksaGulir`, kumpulkan semua `getBoundingClientRect` dalam
  satu fase baca, lalu terapkan semua perubahan kelas dan `minHeight` dalam satu fase tulis.
  (c) Pindahkan pembacaan `scrollHeight` dan `scrollY` ke callback `requestAnimationFrame`.
- **Prediksi terukur:** setelah perubahan ini **saja** (tanpa P-01), jumlah Layout per handler turun
  dari 27 menjadi **≤2**, tetapi durasi handler `s` hanya turun **15-25%** (±400-500 ms dari
  ±2.080 ms di Percobaan 2; ±0,8-1 detik dari 4.186 ms), karena sisanya adalah pembuatan 2.897 kartu dan
  satu layout penuh. Pada `sep` (145 kartu) penurunan hanya ±20-40 ms. Dengan kata lain, ini
  **bukan perbaikan utama** untuk TK-1041, meskipun `samakanTinggiJudul` tampak paling dominan di
  bottom-up. Self time fungsi itu mencakup layout penuh yang dipicunya. Bila prediksi ini benar,
  `samakanTinggiJudul` menghilang dari bottom-up sementara kolom Layout total hanya turun sedikit.
  **Efek samping yang mungkin memburuk:** jika tinggi judul disamakan lewat CSS dan ada judul yang
  lebih panjang dari batas, teks terpotong (kehilangan informasi); jika tinggi tetap salah hitung,
  baris tombol tidak sejajar.
- **Alternatif yang dipertimbangkan dan alasan tidak dipilih:**
  - *Mengukur lebih sedikit contoh (misalnya 6 bukan 24):* menurunkan jumlah layout tetapi
    mempertahankan pola baca-tulis yang salah, dan hasil penyamaan jadi kurang akurat.
  - *Menunda `samakanTinggiJudul` ke `requestAnimationFrame` tanpa mengubah pola:* menunda, tidak
    menghilangkan thrashing.

### Sesudah perbaikan

- **Hash commit perbaikan:**
- **Hasil ukur (median 3 kali):**
- **Prediksi vs kenyataan:**
- **Efek samping yang muncul:**

---

## P-03: SDK analitik dipanggil sinkron pada setiap ketikan

**Tiket terkait:** TK-1041
**Tanggal dan hash commit entri ini:** 2026-10-16, (isi hash setelah commit)

### Sebelum perbaikan

- **Yang teramati di trace (baseline):** pada Percobaan 1, enam ketikan terakhir (0 hasil, nyaris tanpa
  render) masing-masing hanya 69-89 ms, dan **47-53 ms** di antaranya ada di fungsi `f` di
  `lacak.min.js`. Di dua percobaan lain `f` bernilai 21-42 ms per panggilan secara rata-rata.
  Pada ketikan terakhir (106 kartu, 148-206 ms), SDK memakan sekitar 20% handler.
- **Dugaan mekanisme:** `terapkanSaringan` memanggil `Lacak.kirim('search', ...)` secara sinkron
  di handler `input`, sekali per huruf. Fungsi `f` di SDK menjalankan loop 2.000.000 iterasi untuk
  menghitung sidik jari perangkat pada *setiap* panggilan `kirim`. Ini murni CPU di main thread
  (tahap JavaScript), jadi menjadi lantai biaya per ketikan yang tidak dipengaruhi jumlah hasil.
  Dugaan Rudi no. 5 ("SDK agak berat") **benar tetapi kecil kontribusinya**: 4-6% dari total
  handler, bukan penyebab utama.
- **Rencana perubahan:** SDK tidak boleh diubah, tetapi cara dan waktu pemanggilannya boleh.
  Kirim event `search` hanya untuk kata akhir setelah pengguna berhenti mengetik (debounce ±400 ms,
  dengan `pagehide` sebagai pemicu kirim paksa), dan jalankan di luar task interaksi
  (`setTimeout`/`requestIdleCallback`). Data event tetap `{ kata, jumlah }` sehingga informasinya
  masuk akal.
- **Prediksi terukur:** setelah perubahan, biaya SDK di dalam handler `input` turun dari
  ±20-50 ms menjadi ±0 ms, dan jumlah event `search` untuk satu kata berkurang dari 6 menjadi 1.
  Dampak ke INP ±20-50 ms per ketikan, lebih terasa pada ketikan akhir yang renderingnya sudah
  ringan. Satu panggilan `f` yang tersisa tetap menjadi satu task ±20-50 ms
  di luar interaksi (di bawah ambang long task 100 ms).
  **Efek samping yang mungkin memburuk:** data analitik kehilangan kata antara ("sep", "sepa").
  Itu perlu disetujui tim marketing, dan bila marketing butuh semuanya, alternatifnya hanya
  memindahkan waktu panggilan, bukan menguranginya. Event terakhir tertunda ±400 ms, dan bisa hilang
  bila tab ditutup mendadak tanpa pemicu `pagehide`.
- **Alternatif yang dipertimbangkan dan alasan tidak dipilih:**
  - *Web Worker:* SDK membaca `window`, `document`, `navigator`, dan `screen`, yang tidak ada di
    worker. Perlu shim, berisiko mengubah hasil sidik jari, dan lebih kompleks daripada manfaatnya.
  - *Hanya `requestIdleCallback` tanpa debounce:* biaya 20-50 ms tetap dibayar enam kali, hanya
    tidak di dalam task interaksi.
  - *Menghapus event `search`:* melanggar aturan 1 (event wajib tetap terkirim).

### Sesudah perbaikan

- **Hash commit perbaikan:**
- **Hasil ukur (median 3 kali):**
- **Prediksi vs kenyataan:**
- **Efek samping yang muncul:**

---

## P-04: `formatRupiah` membuat `Intl.NumberFormat` baru di setiap panggilan

**Tiket terkait:** TK-1041
**Tanggal dan hash commit entri ini:** 2026-10-16, (isi hash setelah commit)

### Sebelum perbaikan

- **Yang teramati di trace (baseline):** `formatRupiah` muncul sebagai fungsi dengan self time
  terbesar keempat di handler `input`: 248 ms (P2), 623 ms (P3), 625 ms (P1), sekitar 7-9%
  dari seluruh handler.
- **Dugaan mekanisme:** `new Intl.NumberFormat('id-ID', ...)` dibuat ulang untuk tiap harga
  (sampai 3 kali per kartu: harga kini, harga asli, harga voucher). Konstruktor `Intl` mahal karena
  memuat data locale. Ini murni pekerjaan JavaScript di dalam task interaksi, dan biayanya
  bertambah linear dengan jumlah kartu.
- **Rencana perubahan:** buat satu instance `Intl.NumberFormat` di level modul dan pakai ulang.
- **Prediksi terukur:** self time `formatRupiah` turun ±90% (dari 250-620 ms menjadi sekitar
  25-60 ms untuk keseluruhan S1), sehingga handler `s` turun ±6-8% bila berdiri sendiri. Setelah
  P-01 diterapkan, kontribusinya menyusut ke ±1-3 ms per ketikan karena hanya ±50 kartu yang
  dibuat. Tidak ada efek samping fungsional yang diperkirakan. Format `Rp` dan spasi tidak boleh
  berubah, perlu dicek ulang.
- **Alternatif yang dipertimbangkan dan alasan tidak dipilih:**
  - *`toLocaleString` per panggilan:* sama mahal.
  - *Cache hasil per angka:* menambah memori dan lebih rumit tanpa keuntungan berarti.

### Sesudah perbaikan

- **Hash commit perbaikan:**
- **Hasil ukur (median 3 kali):**
- **Prediksi vs kenyataan:**
- **Efek samping yang muncul:**

---

## P-05: Dugaan Rudi yang diperkirakan *tidak* relevan untuk S1

**Tiket terkait:** TK-1041 (dan catatan serah terima Rudi no. 1, 2, 3)
**Tanggal dan hash commit entri ini:** 2026-10-16, (isi hash setelah commit)

### Sebelum perbaikan

- **Yang teramati di trace (baseline):** tidak ada fungsi dari `kategori.js` atau `urutkanGelembung`
  di 12 fungsi teratas self time selama handler `input` di ketiga percobaan. Tidak ada
  permintaan jaringan yang dipicu ketikan (penyaringan berjalan di klien, hanya `/api/produk`
  yang diambil sekali saat mulai).
- **Dugaan mekanisme:** `pasangKaki` (`kategori.js`) dan `urutkanGelembung` (`util.js`) hanya
  dipanggil sekali saat startup dari `main.js`, bukan pada jalur `input`. Server hanya menerima
  satu permintaan produk per muat halaman, sehingga kecepatannya tidak memengaruhi ketikan.
  Dugaan Rudi no. 1, 2, dan 3 karena itu **tidak menjelaskan TK-1041**. Bisa jadi masih
  relevan untuk S0 (waktu muat), yang belum dicakup berkas ini.
- **Rencana perubahan:** tidak ada perubahan untuk S1. Jangan mengerjakan item ini demi tiket ini.
- **Prediksi terukur:** bila `kategori.js` dioptimalkan atau `urutkanGelembung` diganti quicksort,
  durasi handler `input` S1 berubah **<2%** (di dalam derau antar percobaan). Server tambahan tidak
  mengubah S1 sama sekali.
- **Alternatif yang dipertimbangkan dan alasan tidak dipilih:** mengikuti urutan prioritas
  catatan Rudi, ditolak karena bukti di trace menunjukkan biaya ada di jalur lain.

### Sesudah perbaikan

- **Hash commit perbaikan:** (tidak ada, bila prediksi benar)
- **Hasil ukur (median 3 kali):**
- **Prediksi vs kenyataan:**
- **Efek samping yang muncul:**

---

## Prediksi gabungan S1

Bila P-01 sampai P-04 diterapkan bersama:

| Metrik S1 | Baseline (median/rentang) | Prediksi |
|---|---|---|
| Handler `input`, ketikan `s` | 4.186 ms (2.080-5.285) | 60-150 ms |
| Handler `input`, ketikan `sepatu` | 148-206 ms | 15-50 ms |
| INP | 2.913-7.542 ms | **120-200 ms** (di sekitar target 200 ms) |
| Layout per handler | 27 | ≤2 |
| Long task selama S1 | 3-33 task >50 ms, 3-6 task >100 ms | 0 task >100 ms |
| Event `search` per kata | 6 | 1 |

Risiko utama prediksi gabungan: INP bisa meleset di atas 200 ms bila presentation delay setelah
handler (±773 ms pada `s` di baseline) ternyata tidak menyusut sebanding dengan jumlah node.
Bila itu terjadi, penyebabnya ada di tahap Style/Layout/Paint, bukan JavaScript, dan
`content-visibility` serta `contain-intrinsic-size` perlu diperiksa.

### Prediksi untuk langkah "hapus semuanya" (belum punya bukti baseline)

Mengosongkan kolom membuat `kunci` kosong, sehingga seluruh ±3.000 produk dirender ulang
dan `Lacak.kirim` tidak dipanggil (kondisi `&& kunci`). Dugaan: ketikan ini menjadi yang terberat,
sebanding atau sedikit di atas `s` (±4 detik pada baseline) tanpa biaya SDK. Setelah P-01, diperkirakan
setara ketikan `s` yang baru (60-150 ms). Rekam ulang baseline dengan langkah penghapusan sebelum
menguji prediksi ini.
