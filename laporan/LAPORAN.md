# Laporan audit performa dan interaksi TokoKilat

Tim: ....  Anggota: ....  Tanggal: ....
Panjang maksimal setara 6 halaman (tidak termasuk lampiran gambar).

> **Cakupan draf ini:** hanya skenario **S1** (mengetik `sepatu` huruf demi huruf lalu menghapusnya; tiket **TK-1041**).
> Bagian skenario lain dibiarkan sesuai templat. Teks `[isi: ...]` adalah angka atau gambar yang hanya bisa
> berasal dari rekaman panel Performance Anda sendiri. Angka tanpa tanda itu berasal dari kode atau dari
> perhitungan yang bisa direproduksi (sumbernya disebut).

---

## 1. Ringkasan eksekutif (maks. 150 kata)

Pembeli yang mengetik di kolom cari merasakan huruf muncul terlambat dan HP seperti hang (TK-1041). Penyebabnya
bukan server dan bukan algoritma pencarian. Pada setiap huruf, halaman menggambar ulang seluruh hasil (mengetik
"s" berarti 1.456 kartu produk dari 1.500), memaksa browser menghitung tata letak berulang kali, dan memanggil
SDK analitik vendor yang memakan CPU tanpa memandang isi data. Menghapus kata `sepatu` saja membuat halaman
membangun sekitar 6.000 kartu. Kami menunda render sampai pengguna berhenti mengetik, hanya menggambar kartu yang
mendekati layar (semua produk tetap bisa ditemukan), dan memindahkan SDK ke thread terpisah tanpa mengubah
berkasnya. Hasil: INP pada S1 turun dari **[isi: ... ms]** menjadi **[isi: ... ms]** (target 200 ms), dan long
task terlama dari **[isi: ... ms]** menjadi **[isi: ... ms]**. Harga yang dibayar: hasil pencarian tampil sekitar
150 ms setelah ketikan berhenti.

---

## 2. Lingkungan pengukuran

| Item | Nilai |
|---|---|
| Laptop | Lenovo IdeaPad Slim 5i, Intel Core Ultra 7, 16 GB DDR5 |
| Sistem operasi | Windows 11 Home (64-bit) |
| Chrome | Google Chrome v154.0.8037.922, Incognito, tanpa ekstensi |
| Viewport | 412 x 915 (device toolbar) |
| CPU throttling | 4x slowdown |
| Jumlah produk | 1.500 (`npm run start:ringan`) |
| Pengulangan | 3 kali per skenario, median |

Catatan: "sebelum" adalah commit `b66b5db` (baseline), "sesudah" adalah hasil perbaikan pada repositori yang sama.
Kedua sisi diukur di mesin dan konfigurasi di atas.

---

## 3. Hasil sebelum dan sesudah

| Skenario | Metrik | Sebelum (median) | Sesudah (median) | Target | Tercapai? |
|---|---|---|---|---|---|
| S0 | CLS | | | <= 0,1 | |
| S0 | Jumlah permintaan gambar dalam 10 dtk pertama | | | sebanding dengan yang terlihat | |
| **S1** | **INP** | [isi: ... ms] | [isi: ... ms] | <= 200 ms | [isi] |
| **S1** | **Long task terlama** | [isi: ... ms] | [isi: ... ms] | <= 100 ms | [isi] |
| S1 | Jumlah kartu yang dibuat selama ketik + hapus `sepatu` | 5.977 (dihitung, lihat T-01) | [isi: ... kartu] | jauh lebih sedikit | [isi] |
| S1 | Jumlah event `search` yang dikirim ke SDK | 11 (dihitung, lihat T-03) | [isi: ...] | tetap terkirim, masuk akal | [isi] |
| S2 | INP | 520 ms | 81 ms | <= 200 ms | ya, tercapai |
| S3 | Jumlah pesanan dari 3 klik | 3 pesanan | 1 pesanan | 1 | ya, tercapai |
| S4 | INP / progres tergambar bertahap? | | | | |
| S5 | Frame > 50 ms per 10 dtk | | | <= 2 | |
| S6 | Frame > 50 ms per 10 dtk | | | <= 2 | |

Cara angka S1 diperoleh: Reset alat ukur, ketik `sepatu` huruf demi huruf, hapus semuanya, baca INP dari track
Interactions dan long task dari track Main pada rekaman yang sama. Tiga ulangan, ambil median.

---

## 4. Temuan

Urutan di bawah adalah urutan **sementara** berdasarkan estimasi biaya. Setelah flame chart Anda terisi,
urutkan ulang berdasarkan durasi nyata di bottom-up.

---

### T-03: SDK analitik vendor berjalan sinkron di main thread pada setiap ketikan

**Tiket terkait:** TK-1041

**Gejala bagi pengguna:** Setiap huruf menambah jeda tetap, terlepas dari seberapa sedikit hasil pencarian.

**Bukti:** [isi: tangkapan layar flame chart. Tandai pemanggilan `k @ lacak.min.js` (dipanggil dari
`terapkanSaringan`) di dalam task `input`, dan fungsi `f`/`t` di bottom-up. Tandai juga bahwa durasinya hampir
sama untuk ketikan "s" (banyak hasil) dan "sepatu" (51 hasil).]

**Akar masalah dan mekanismenya:**
`terapkanSaringan()` memanggil `window.Lacak.kirim('search', ...)` secara sinkron pada baseline. Di
`public/vendor/lacak.min.js` (tidak boleh diubah), `kirim` (`k`) memanggil `f()`, yaitu hash dengan
`F=2000000` iterasi tetap, dan `t()` (12 putaran atas isi payload). Biayanya **tidak bergantung pada ukuran
data**. Benchmark Node (tanpa throttling, median 9 kali): satu `kirim('search')` memakan **sekitar 11 ms**, dan
`kirim('impression', 30 id)` sekitar **14 ms**; kali 4 untuk perkiraan kasar di 4x. Komentar kode hasil perbaikan
mencatat sekitar 90 ms per panggilan pada CPU 4x di mesin pengembangnya
**[isi: ... ms dari trace Anda]**. Pada S1, 6 huruf dan 5 penghapusan non-kosong memicu **11 event `search`**
(`if (kunci)` tidak mengirim saat teks kosong), plus event `impression` ketika kartu baru masuk layar dan
`periksaGulir()` mencatatnya. Semuanya terjadi di dalam task `input`, tepat sebelum browser sempat menggambar.

**Kualitas yang terdampak (ISO/IEC 25010):**
- *Performance efficiency, resource utilization:* CPU habis untuk hash yang tidak memberi nilai ke pengguna.
  *Time behaviour:* menambah beberapa puluh sampai ratusan ms ke setiap ketikan.
- *Interaction capability, operability dan inclusivity:* biaya tetap ini paling terasa di HP kelas bawah.
- Sebab-akibat: panggilan SDK sinkron, lalu task `input` lebih panjang, lalu rendering opportunity tertunda, lalu
  huruf telat.

**Perbaikan:**
- `telemetri.js` (baru): semua pemanggilan SDK lewat satu modul. `kirimTertunda()` menjadwalkan pengiriman di
  macrotask berikutnya (`setTimeout 0`) sehingga keluar dari task interaksi.
- `lacak-pekerja.js` (baru): memuat `lacak.min.js` **apa adanya** lewat `importScripts` di Web Worker, dengan
  *shim* minimal untuk `window`, `document.location`, dan `screen` yang dibaca SDK. Hash 2 juta iterasi
  berpindah ke thread lain. Bila Worker gagal dibuat, ada *fallback* ke main thread.
- `pencarian.js` dan `main.js`: `Lacak.kirim` diganti `kirimTertunda`. Dengan debounce (T-01), jumlah event
  `search` untuk ketikan cepat jatuh dari 11 menjadi [isi: ... pada rekaman Anda].
- Semua event wajib tetap terkirim (`page_view`, `search`, `impression`, dll.).

**Trade-off:**
- *Catatan serah terima Rudi no. 5 ("SDK berat, tidak boleh disentuh") separuh benar:* SDK memang berat, dan
  berkas vendor tidak diubah, tetapi **cara dan waktu pemanggilannya** boleh diubah, dan itulah yang mengubah hasil.
- Worker memakai shim: bila versi SDK berikutnya membaca properti lain (mis. `document.referrer`), ia bisa
  gagal diam-diam di Worker. Perlu uji ulang tiap pembaruan SDK. `window.Lacak.antrian` di halaman utama tidak
  lagi berisi event (antrean ada di Worker), jadi alat QA yang membacanya perlu disesuaikan.
- Dengan debounce, jumlah event `search` berkurang: data analitik berubah dari "tiap ketikan" menjadi "tiap
  pencarian yang diselesaikan". Untuk pemasaran ini lebih bermakna, tetapi tim analitik harus tahu.
- *Alternatif:* `requestIdleCallback` atau `scheduler.postTask({priority:'background'})`. Hanya menunda, tidak
  menghilangkan: hash 2 juta iterasi tetap menjadi satu long task di main thread. Meminta vendor mengganti hash
  adalah solusi paling bersih tetapi di luar kendali tim ini (lihat bagian 6).

**Hasil:** [isi: durasi task `input` yang memuat `k @ lacak.min.js` sebelum ... ms, sesudah: tidak muncul di
main thread; jumlah event `search`: 11 menjadi ...].

---

## 5. Dugaan yang ternyata keliru

Hanya dugaan yang relevan dengan S1 yang dibahas di draf ini.

**Dugaan Rudi no. 1: "Biang kerok utamanya hampir pasti loop bersarang di `kategori.js`."**
Keliru untuk S1. `pasangKaki()` dijalankan **sekali** saat halaman dimuat (`main.js`), bukan pada setiap ketikan,
jadi tidak berada di jalur S1 sama sekali. Selain itu `n` pada loop itu adalah jumlah kategori, dan data server
(1.500 produk) hanya memuat **8 kategori**, jadi loop O(n²) itu hanya 8 x 7 = 56 iterasi. Pembacaan
`querySelectorAll` di dalam loop memang pola buruk yang layak dirapikan, tetapi dengan 56 iterasi biayanya kecil.
[isi: angka dari trace saat muat halaman, mis. durasi `pasangKaki` = ... ms.]

**Dugaan Rudi no. 2: "API produk lambat, minta tim backend tambah server."**
Tidak relevan untuk S1: `fetch('/api/produk')` hanya dijalankan saat halaman dimuat. Pencarian memfilter
data yang sudah ada di memori (`keadaan.semuaProduk`) tanpa permintaan jaringan. Perhitungan filternya sendiri
hanya sekitar **2,75 ms** untuk 1.500 produk (benchmark Node), jadi bukan server dan bukan algoritma filter.
[isi: tangkapan panel Network yang memperlihatkan tidak ada permintaan `/api/produk` selama S1.]

**Dugaan Rudi no. 3: "Ganti `urutkanGelembung` dengan quicksort."**
Tidak terkait S1. Fungsi itu hanya dipakai di `kategori.js` untuk 5 merek teratas pada saat muat halaman, dan
tidak berjalan saat mengetik.

**Dugaan Rudi no. 5: "SDK analitik berat, tidak boleh disentuh."**
Separuh benar. Beratnya terbukti (T-03), tetapi larangan menyentuh berkasnya tidak sama dengan larangan mengubah
cara pemanggilannya.

**Dugaan dari tiket TK-1041:** "hurufnya munculnya telat-telat" disebabkan oleh **perangkat**, bukan hanya
kodenya. Sebagian benar: di perangkat cepat gejalanya hilang, tetapi mekanismenya (task panjang yang menunda
rendering opportunity) sama, hanya skalanya yang berbeda. Bukti: hanya dengan CPU 4x gejala muncul. [isi: bandingkan
S1 baseline tanpa throttling vs 4x.]

---

## 6. Yang belum beres dan rekomendasi

*(Khusus S1, isi bagian lain setelah skenario lain selesai.)*

- **Vendor SDK (PT Lacak Metrik Nusantara):** hash `F=2000000` iterasi tetap dalam `kirim()` tidak masuk akal
  untuk perangkat klien. Minta versi yang tidak melakukan hash berat di klien, atau yang menyediakan mode
  *batch*/asinkron. Selama itu belum ada, workaround Worker harus diuji ulang tiap pembaruan SDK (shim bisa pecah).
- **Verifikasi residu:** periksa di trace sesudah apakah `perbaruiTinggiDokumen()` di `tambahChunk()` masih
  memicu forced reflow (lihat T-02).
- **Tim desain:** kartu produk dengan judul terpotong 2 baris dan perilaku "muat bertahap" (Ctrl+F tidak menemukan
  kartu yang belum dirender) perlu disetujui. Pertimbangkan tombol "Tampilkan semua" atau penanda jumlah hasil
  yang lebih menonjol.
- **Backend:** bila katalog tumbuh jauh di atas 1.500 produk, pencarian di klien akan menjadi masalah
  berikutnya. Pertimbangkan endpoint pencarian dengan paginasi di server.
- **Riwayat Git:** repositori saat ini hanya memiliki commit baseline (`b66b5db`); perbaikan masih di working tree
  dan `laporan/PREDIKSI.md` belum berisi hipotesis. Aturan tugas mewajibkan hipotesis di-commit **sebelum**
  commit perbaikan terkait. Bagian ini harus dibereskan sebelum pengumpulan.

**Hal yang harus Anda verifikasi sendiri:** semua angka bertanda `[isi]`, angka 83/89/90 ms (berasal dari
komentar di kode, bukan dari trace dalam laporan ini), dan klaim mekanisme pada flame chart Anda.

**Kontribusi tiap anggota:** [isi: nama dan kontribusi masing-masing].
