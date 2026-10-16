# Laporan Audit Performa dan Interaksi TokoKilat
Audit Skenario S0-S6

Tim: TokoKilat 12.12  
Anggota:
- Afriza (Penanggung Jawab Skenario S0)
- Mario (Penanggung Jawab Skenario S1)
- Devi (Penanggung Jawab Skenario S2 & S3)
- Dino (Penanggung Jawab Skenario S4 & S6)
- Hadi (Penanggung Jawab Skenario S5)

Tanggal: 16 Oktober 2026  
Panjang maksimal setara 6 halaman (tidak termasuk lampiran gambar).

---

## 1. Ringkasan Eksekutif (maks. 150 kata)

Audit performa TokoKilat dilakukan untuk mengetahui masalah yang membuat pengguna kurang nyaman saat berbelanja. Dari hasil pengujian, ditemukan beberapa kendala, seperti halaman yang bergeser, gambar produk yang lambat dimuat, pencarian yang kurang responsif, tombol keranjang yang macet, pesanan ganda akibat klik berulang, serta halaman yang tersendat saat digulir. Untuk mengatasinya, dilakukan beberapa perbaikan, mulai dari mengoptimalkan pemuatan gambar hingga memperbaiki proses pencarian dan transaksi. Untuk hasil lebih lanjut ada pada no 3 dan seterusnya.

---

## 2. Lingkungan Pengukuran

Pengukuran dilakukan dengan mematuhi protokol baku pada TUGAS.md bagian 7:

- **Perangkat keras:** Laptop pengujian (Windows 11, prosesor multi-core, RAM 16 GB, daya tersambung listrik).
- **Peramban:** Google Chrome versi stabil terbaru, jendela Incognito, tanpa ekstensi aktif, tab lain ditutup.
- **Konfigurasi Chrome DevTools:**
  - Device Toolbar: viewport responsif **412 × 915 piksel**.
  - Panel Performance: throttling **CPU 4x slowdown**; jaringan tanpa throttling (_No throttling_).
  - Alamat pengujian: `http://localhost:3000/?ukur=1` (dimuat ulang sekali pada sesi Incognito sebelum perekaman trace).
- **Beban data:** katalog 1.500 produk (`npm start` dengan `$env:JUMLAH_PRODUK=1500`).
- **Metode pengukuran:** setiap skenario diulang **3 kali** berturut-turut setelah menekan tombol "Reset"; angka yang dilaporkan adalah median.

### Spesifikasi Perangkat Pengujian 1:
| Item | Nilai |
| :--- | :--- |
| Laptop | Lenovo Ideapad Slim 5i, Intel (R) Core (TM) Ultra 7, 16 GB DDR5 |
| Sistem operasi | Windows 11 Home (64-bit) |
| Chrome | `Google Chrome v154.0.8037.922` Incognito, tanpa ekstensi |
| Viewport | 412 × 915 (device toolbar) |
| CPU throttling | 4x slowdown |
| Jumlah produk | 1.500 (`npm run start:ringan`) |
| Pengulangan | 3 kali per skenario, median |

### Spesifikasi Perangkat Pengujian 2:
| Item | Nilai |
| :--- | :--- |
| Laptop | Lenovo G40-30, Intel Core i3 Gen 5, RAM 12 GB DDR4 |
| Sistem operasi | Windows 10 Home (64-bit) |
| Chrome | Google Chrome v154.0.8037.922, Incognito, tanpa ekstensi |
| Viewport | 412 × 915 (Device Toolbar) |
| CPU throttling | 4× slowdown |
| Jumlah produk | 1.500 (`npm run start:ringan`) |
| Pengulangan | 3 kali per skenario, menggunakan median |

---

## 3. Hasil Sebelum dan Sesudah

| Skenario | Metrik | Sebelum (median) | Sesudah (median) | Target | Tercapai? |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **S0** | CLS | 0,475 | 0,002 | $\le 0{,}1$ | **Tercapai** |
| **S0** | Jumlah permintaan gambar dalam 10 dtk pertama | 1.500 | 10 (total 26 req) | Sebanding dengan yang terlihat | **Tercapai** |
| **S1** | INP | 7024 ms | 96 ms | $\le 200\text{ ms}$ | **Tercapai** |
| **S1** | Long task terlama | 261 ms | 70 ms | $\le 100\text{ ms}$ | **Tercapai** |
| **S2** | INP | 520 ms | 81 ms | $\le 200\text{ ms}$ | **Ya, tercapai** |
| **S3** | Jumlah pesanan dari 3 klik | 3 pesanan | 1 pesanan | 1 | **Ya, tercapai** |
| **S4** | INP / progres tergambar bertahap? | 224 ms | 56 ms | Tergambar bertahap | **Ya, tercapai** |
| **S5** | Frame > 50 ms per 10 dtk | 988 ms | 1 ms | $\le 2$ | **Ya, Tercapai** |
| **S6** | Frame > 50 ms per 10 dtk | 992 ms | 1 ms | $\le 2$ | **Ya, tercapai** |

---

## 4. Temuan

Temuan diurutkan berdasarkan dampak, bukan urutan tiket.

### T-01: Pemuatan gambar produk terlalu agresif (TK-1081)

- **Tiket terkait:** TK-1081 (Skenario S0). _(TK-1041 Skenario S1 ditangani oleh rekan tim.)_
- **Gejala bagi pengguna:** Pak Hendra (TK-1081, S0) melaporkan bahwa gambar produk lama sekali muncul dan hanya menampilkan kotak abu-abu dalam waktu lama, terutama saat menggulir cepat ke bawah. Penggunaan kuota internet terasa sangat boros dan pengguna mengira server backend lambat.
- **Bukti:** Pada baseline trace S0 tercatat 1.500 event ResourceSendRequest bertipe Image, dari `/img/p/1.svg` sampai `/img/p/1500.svg`, diminta sekaligus sejak halaman dimuat. Waktu tunggu Queuing and connecting mencapai puluhan detik hingga lebih dari 1 menit karena antrean koneksi jenuh.  
  **bukti berkas:** image/LAPORAN/1790854407049.png
- **Akar masalah dan mekanismenya:** Pada `public/js/katalog.js`, seluruh 1.500 elemen `<img>` langsung diberi atribut `src` saat kartu dibuat oleh `renderProduk()` tanpa `loading="lazy"`. Browser menembakkan 1.500 permintaan HTTP serentak, melampaui batas koneksi paralel per host (maksimal 6 pada HTTP/1.1). Terjadi antrean jaringan masif (_head-of-line blocking_): gambar yang sedang dilihat pengguna harus mengantre di belakang ribuan gambar off-screen.
- **Kualitas yang terdampak (ISO/IEC 25010):**
  - `Performance efficiency – time behaviour`: unduhan gambar memakan waktu > 1 menit.
  - `Performance efficiency – resource utilization`: boros kuota data dan memori karena mengunduh seluruh 1.500 gambar sekaligus.
  - `Performance efficiency – capacity`: strategi pemuatan tidak berskala ketika produk mencapai ribuan.
  - `Interaction capability – user engagement`: pengalaman belanja terganggu oleh kotak abu-abu yang lama.
- **Perbaikan:** Pada `public/js/katalog.js`, menambahkan atribut native `loading="lazy"` dan `decoding="async"` serta dimensi eksplisit `width="480"` dan `height="480"` pada `<img>`. Pada `public/css/toko.css`, menetapkan `aspect-ratio: 1 / 1;` pada `.kartu-media` dan `content-visibility: auto;` pada `.kartu`. Diterapkan pula _windowing/chunked rendering_ (`UKURAN_CHUNK = 24`) berbasis elemen `<div class="sentinel">` dan `IntersectionObserver`, sehingga browser menahan unduhan gambar di luar layar dan ukuran DOM awal tetap kecil.
- **Trade-off:** Pustaka Virtual Scrolling eksternal tidak dipilih karena aturan tugas melarang library pihak ketiga. `loading="lazy"` native dipadukan dengan chunking vanilla JS memakai Web API standar, stabil, dan tetap mempertahankan seluruh 1.500 data di memori klien untuk pencarian dan penyaringan instan. Efek sampingnya, gambar baru diunduh saat pengguna menggulir mendekati kartu.
- **Hasil:** Permintaan gambar dalam 10 detik pertama (S0) turun dari 1.500 menjadi **10 request** (dari total 26 request halaman, sebanding dengan kartu yang terlihat di viewport 412 × 915). Antrean tidak lagi tersumbat dan gambar awal selesai dalam ~1,95–2,00 detik. Target S0 tercapai.  
  **bukti berkas:** image/LAPORAN/1792096628306.png

---

### T-02: Tombol "+ Keranjang" bikin main thread freeze akibat looping hash SDK analitik dan parsing riwayat besar (TK-1044 / S2)

- **Tiket terkait:** TK-1044 (Pak Anton: "Pencet '+ Keranjang' tidak ada reaksi apa-apa. Saya pencet lagi, tahu-tahu isi keranjang sudah 3").
- **Gejala bagi pengguna:** Pas tombol diklik, layar sempat diam dan tidak ada respon sama sekali. Toast notifikasi "Ditambahkan ke keranjang" dan angka di keranjang baru muncul setelah jeda freeze selesai. Karena dikira tidak merespons, pengguna menekan tombol berkali-kali sampai keranjang bertambah 3.
- **Bukti (tersimpan di folder `laporan/trace/`):**  
  Pada pengujian baseline (`laporan/trace/baseline/s2/`), rekaman DevTools menunjukkan interaksi klik berwarna merah dengan INP tinggi:
  - Percobaan 1: 528 ms (Long Task 410 ms) — berkas `percobaan 1/perulangan1-sebelum.png`
  - Percobaan 2: 448 ms (Long Task 266 ms) — berkas `percobaan 2/perulangan2-sebelum.png`
  - Percobaan 3: 520 ms (Long Task 283 ms) — berkas `percobaan 3/perulangan3-sebelum.png`  
  **Median sebelum: 520 ms.**  
  Dari tab Bottom-Up dan flame chart, waktu CPU habis di fungsi `k` dan loop `f` milik `lacak.min.js`, ditambah proses `JSON.parse` dan `JSON.stringify`.

  Pada pengujian sesudah perbaikan (`laporan/trace/sesudah/s2/`), balok interaksi berubah jadi hijau dan tipis:
  - Percobaan 1: 171 ms — berkas `percobaan 1/perulangan1-sesudah.png`
  - Percobaan 2: 81 ms — berkas `percobaan 2/perulangan2-sesudah.png`
  - Percobaan 3: 55 ms — berkas `percobaan 3/perulangan3-sesudah.png`  
  **Median sesudah: 81 ms.**
- **Akar masalah dan mekanismenya:**  
  Waktu tombol diklik, fungsi `tambahKeKeranjang` memanggil `bacaRiwayat()` yang mem-parse ~9.000 riwayat (~1 MB) dari `localStorage` setiap kali tombol ditekan. Seluruh 9.000 riwayat itu ikut dikirim ke `window.Lacak.kirim`. Di dalam `lacak.min.js`, SDK menghitung hash fingerprint dengan loop 2 juta iterasi dan hash payload string 12 x panjang karakter. Karena semua proses ini jalan sinkron di main thread, browser tidak sempat merender toast maupun update badge keranjang (_rendering opportunity_ tertunda sampai task selesai).
- **Kualitas yang terdampak (ISO/IEC 25010):**
  - `Performance Efficiency (Time behaviour)`: Waktu respon klik jadi lambat karena CPU tertahan oleh perhitungan hash sinkron.
  - `Interaction Capability (Operability & User error protection)`: Tombol terasa macet dan membuat pengguna tidak sengaja memasukkan barang berulang kali.
- **Perbaikan:**  
  1. Simpan riwayat di memori (`riwayatMemori`) setelah pembacaan pertama, dan tunda penulisan ke `localStorage` pakai debounce 400 ms.
  2. Ringkas data analitik yang dikirim: hanya kirim info penting produk, tidak perlu membawa seluruh data riwayat.
  3. Pindahkan SDK vendor ke Web Worker lewat Blob di `util.js` dan tunda pemanggilan ke macrotask via `setTimeout(..., 0)` (`kirimTertunda`).
- **Trade-off:** Penyimpanan riwayat ke `localStorage` ada jeda 400 ms jika tab ditutup mendadak, tapi data keranjang belanja tetap aman karena langsung disimpan saat itu juga.
- **Hasil:** INP turun dari **520 ms jadi 81 ms** (target $\le 200\text{ ms}$ tercapai).

---

### T-03: Pesanan dobel saat klik cepat di tombol "Beli sekarang" karena belum ada penanganan konkurensi (TK-1052 / S3)

- **Tiket terkait:** TK-1052 (Mbak Sari: "SAYA CUMA BELI SATU. Kenapa tagihannya tiga pesanan?? Saya pencet 'Beli sekarang', diam saja, ya saya pencet lagi. Minta refund").
- **Gejala bagi pengguna:** Waktu tombol "Beli sekarang" diklik, layar kelihatan diam tanpa respon selama beberapa ratus milidetik karena menunggu server. Pengguna mengira kliknya tidak masuk lalu mengklik lagi, akhirnya tagihan keluar 3 pesanan.
- **Bukti (tersimpan di folder `laporan/trace/`):**  
  Pada baseline (`laporan/trace/baseline/s3/`):
  - Di tangkapan layar `hasil_console_sebelum.png`, terminal server mencatat setiap 3 klik cepat menghasilkan 3 pesanan terpisah untuk produk yang sama (TK-00001, TK-00002, TK-00003).
  - Di flame chart `perulangan1-sebelum.png`, track Network memperlihatkan 3 request POST `/api/pesanan` berjalan secara paralel karena tombol tetap aktif.

  Pada sesudah perbaikan (`laporan/trace/sesudah/s3/`):
  - Di tangkapan layar `hasil_console_sesudah.png`, terminal server membuktikan bahwa saat tombol diklik 3 kali dengan cepat, server hanya memproses tepat **1 pesanan saja** per transaksi.
- **Akar masalah dan mekanismenya:**  
  Fungsi `beliSekarang` berjalan asinkron (`async`). Saat kode menunggu `await fetch('/api/pesanan')`, kendali kembali ke browser. Selama menunggu balasan server (sekitar 300–500 ms), tombol tetap aktif (`disabled = false`) dan teksnya tetap "Beli sekarang". Tidak ada pengaman transaksi ganda (_concurrency guard_), jadi klik kedua dan ketiga kembali memicu fetch baru. Akibatnya terjadi _race condition_ dan server memproses 3 pesanan sekaligus.
- **Kualitas yang terdampak (ISO/IEC 25010):**
  - `Interaction Capability (User error protection)`: Sistem gagal mencegah klik berulang saat transaksi sedang berjalan.
  - `Interaction Capability (Self-descriptiveness)`: Tidak ada tanda atau indikator bahwa pesanan sedang diproses.
- **Perbaikan:**  
  1. Pasang guard pakai `Set` `sedangDipesan`. Kalau ID produk masih ada di dalam `Set`, klik berikutnya langsung diabaikan (`return`).
  2. Begitu tombol diklik pertama kali, langsung ubah `tombol.disabled = true` dan ganti teksnya jadi 'Memproses…'.
  3. Membungkus alur pemesanan dengan `try...finally` supaya tombol aktif kembali dan status di `Set` dibersihkan setelah selesai.
  4. Kirim analitik lewat worker via `kirimTertunda`.
- **Trade-off:** Tombol dinonaktifkan sementara selama 1,5 detik untuk produk yang sama setelah berhasil dibeli untuk mencegah spam klik.
- **Hasil:** Dari 3 klik cepat, jumlah pesanan yang terbentuk di server turun dari **3 pesanan jadi tepat 1 pesanan**.

---

### T-07: Halaman meloncat saat pemuatan awal – layout shift (TK-1078)

- **Tiket terkait:** TK-1078 (Skenario S0).
- **Gejala bagi pengguna:** Kak Rara (TK-1078, S0) melaporkan bahwa saat hendak menekan produk di posisi paling atas, halaman tiba-tiba bergeser turun sehingga yang tertekan justru banner promo.
- **Bukti:** Trace baseline S0 memuat event LayoutShift dengan cumulative score sekitar 0,475, menggeser elemen DIV.alat-kanan, P#ringkasan, kartu produk teratas, dan FOOTER.kaki.  
  **bukti berkas :** image/LAPORAN/1790854396366.png
- **Akar masalah dan mekanismenya:** Banner promo dimuat asinkron. Pada `public/js/promo.js`, `pasangBannerPromo()` memanggil `/api/promo` (latensi server ~1.800 ms), lalu menyisipkan banner ke bagian atas kontainer dengan `$('#utama').prepend(banner);`. Karena `#utama` tidak memesan ruang sebelumnya (_unreserved space_), banner setinggi ~132 px (~220 px di layar mobile) mendorong seluruh elemen di bawahnya secara mendadak. Inilah sumber CLS 0,475 dan salah klik.
- **Kualitas yang terdampak (ISO/IEC 25010):**
  - `Performance efficiency – time behaviour`: reflow/re-layout besar setelah respons asinkron tiba.
  - `Interaction capability – user error protection`: pengguna salah klik karena elemen berpindah saat hendak disentuh.
  - `Interaction capability – operability`: tata letak tidak stabil sehingga menyulitkan navigasi.
- **Perbaikan:**
  1. Pada `public/js/promo.js`, `pasangBannerPromo()` menyisipkan skeleton `<section class="promo-banner">` secara sinkron ke `#utama` sebelum `fetch('/api/promo')` dikirim, lengkap dengan teks placeholder. Begitu respons tiba, teks diperbarui di tempat tanpa mengubah dimensi kontainer.
  2. Pada `public/css/toko.css`, menetapkan `min-height: 132px` untuk desktop dan `@media (max-width: 640px) { .promo-banner { min-height: 220px; } }` untuk layar ponsel agar sesuai tinggi teks promo multi-baris.
  3. Menghapus `samakanTinggiJudul()` di `katalog.js` dan menggantinya dengan pembatasan 2 baris murni CSS (`-webkit-line-clamp: 2; height: calc(2 * 1.35em)`).
- **Trade-off:** Memindahkan banner ke footer atau memakai popup modal melayang tidak dipilih karena merusak tujuan promosi Harbolnas dan menutupi navigasi filter. Harganya, area banner menampilkan teks skeleton selama 1,8 detik pertama sebelum data promo tiba, namun ini memberi kejelasan bagi pengguna (_perceived performance_) dan menjamin layout stabil.
- **Hasil:** CLS skenario S0 turun dari **0,475 menjadi 0,002** (konsisten di seluruh pengujian, jauh di bawah target $\le 0{,}1$). Halaman tidak lagi meloncat dan salah klik pada target pengguna hilang. Target S0 tercapai.  
  **bukti berkas :** image/LAPORAN/1792096733905.png

---

### T-05: Scroll daftar produk patah-patah – forced synchronous layout & layout thrashing (TK-1063)

- **Tiket terkait:** TK-1063 (Skenario S5).
- **Gejala bagi pengguna:** Bu Ningsih (TK-1063, S5, Android entry-level) melaporkan bahwa saat menggulir (_scroll_) daftar barang flash sale, tampilan terasa patah-patah (_jank_), berat, dan tidak nyaman dilihat jika dibandingkan dengan aplikasi belanja lain.
- **Bukti:** Trace baseline S5 (CPU 4x slowdown, 10 detik gulir konstan) mencatat ribuan frame lambat (> 50 ms) dengan durasi frame terburuk mencapai > 1.000 ms, serta rentetan long task merah pada Main Thread track. Total waktu kalkulasi Layout di trace mencapai 7.301–14.381 ms yang didominasi oleh pemanggilan fungsi `periksaGulir`.  
  **bukti berkas :** image/LAPORAN/trace/baseline/s5/flamechart-s5-sebelum.png
- **Akar masalah dan mekanismenya:** Pada `public/js/gulir.js`, event listener scroll dipasang tanpa pembatas (_throttling_) dan memicu `periksaGulir` puluhan kali per detik. Di dalam fungsi tersebut, kode mengeksekusi `document.querySelectorAll('.kartu')` lalu memanggil `getBoundingClientRect()` pada setiap kartu secara berulang setelah terjadi perubahan DOM. Pembacaan geometri ini memaksa browser menghitung ulang geometri tata letak secara sinkron (_Forced Synchronous Layout / Layout Thrashing_) di tengah siklus eksekusi JavaScript. Selain itu, penulisan `bar.style.width` pada bilah baca di Main Thread memicu tahap Layout dan Paint ulang di setiap frame, serta pembacaan `document.documentElement.scrollHeight` yang tidak di-cache ikut memicu reflow sinkron tambahan.
- **Kualitas yang terdampak (ISO/IEC 25010):**
  - `Performance efficiency – time behaviour`: durasi eksekusi per frame membengkak hingga 80–150 ms (jauh melebihi anggaran 16,6 ms untuk 60 FPS) akibat kalkulasi layout berulang, menimbulkan _dropped frames / jank_ masif.
  - `Performance efficiency – resource utilization`: CPU Main Thread terbebani hingga 100% secara terus-menerus saat jari menyentuh layar, menyebabkan konsumsi daya baterai tinggi dan perangkat cepat panas.
  - `Interaction capability – operability`: respon gulir menjadi tidak mulus dan tersendat (_laggy_), menurunkan kendali presisi pengguna saat menelusuri katalog barang.
  - `Interaction capability – user engagement`: pengalaman visual yang buruk dan tidak nyaman membuat pengguna malas melihat produk lebih lanjut dan berisiko beralih ke toko kompetitor.
- **Perbaikan:**
  1. Pada `public/js/gulir.js`, mengganti pemindaian manual `querySelectorAll` + `getBoundingClientRect` dengan satu instans `IntersectionObserver` (`pengamatKartuSekali`). Browser sendiri yang memantau secara asinkron kapan kartu masuk ke viewport untuk memicu kelas animasi (`terlihat`) dan pencatatan impresi analitik tanpa memicu forced reflow.
  2. Menerapkan fungsi pembatas `rafThrottle` (`requestAnimationFrame`) pada event gulir, memastikan kalkulasi posisi bilah baca dijalankan paling banyak 1× per frame (_rendering opportunity_).
  3. Mengubah mekanisme animasi bilah progres baca dari manipulasi dimensi lebar `bar.style.width` menjadi CSS `bar.style.transform = 'scaleX(' + rasio + ')'`. Properti transform dieksekusi langsung di Compositor Thread tanpa menyentuh tahap Layout maupun Paint di Main Thread.
  4. Meng-cache tinggi dokumen ke dalam variabel `tinggiDokumen` yang hanya dihitung ulang saat jendela di-resize atau saat ada penambahan kartu baru via `perbaruiTinggiDokumen()`, serta menambahkan opsi `{ passive: true }` pada event listener scroll dan touch.
- **Trade-off:** Alternatif throttling berbasis `setTimeout(fn, 16)` tidak dipilih karena waktunya tidak sinkron dengan refresh rate layar. Menghapus efek kartu muncul atau bilah baca dilarang oleh aturan main (poin 4). Harganya, animasi kartu (_reveal_) dan pergerakan bilah baca memiliki jeda mikroskopis (~1 frame) mengikuti siklus Compositor dan callback observer, serta penambahan kartu baru (_windowing_) membutuhkan pemanggilan `perbaruiTinggiDokumen()` secara manual. Namun, harga ini sangat sepadan karena Main Thread bebas dari beban kalkulasi geometri dan interaksi gulir menjadi sepenuhnya responsif.
- **Hasil:** Pada skenario S5 (CPU 4x slowdown, 10 detik gulir konstan), jumlah frame > 50 ms turun drastis dari ribuan frame menjadi **median 1 frame per 10 detik** (konsisten di bawah target baku $\le 2$ frame). Long task terlama saat interaksi gulir turun dari ~1.000 ms menjadi **median 95,4 ms** (target baku $\le 100\text{ ms}$ tercapai). Total waktu kalkulasi Layout terpangkas dari 14.381 ms menjadi 581 ms. Gerakan gulir kini berjalan stabil dan mulus 60 FPS pada perangkat Android entry-level. Target S5 tercapai.  
  **bukti berkas :** image/LAPORAN/flamechart-s5-sesudah.png

---

### T-06: Pencarian produk lambat dan main thread tersendat saat mengetik serta menghapus kata kunci (TK-1041 / S1)

- **Tiket terkait:** TK-1041 (Keluhan pengguna: kolom pencarian terasa lambat dan halaman seperti hang).
- **Gejala bagi pengguna:** Saat mengetik kata sepatu huruf demi huruf, hasil pencarian tidak langsung merespons. Ketika seluruh teks dihapus, halaman juga dapat terasa tersendat. Pengguna harus menunggu hingga hasil pencarian diperbarui, sehingga interaksi terasa lambat dan kurang responsif.
- **Bukti pengukuran baseline:**  
  Pada pengujian S1 sebelum perbaikan, diperoleh hasil berikut:
  - Percobaan 1: INP 7.542 ms — Long task 235 ms.
  - Percobaan 2: INP 2.914 ms — Long task 5.301 ms.
  - Percobaan 3: INP 128 ms — Long task 261 ms.  
  **Median sebelum: INP 2.914 ms; long task 261 ms.**  
  _Catatan: Angka long task pada percobaan kedua perlu diverifikasi terhadap rekaman Chrome DevTools karena nilainya jauh lebih tinggi daripada dua percobaan lainnya._
- **Akar masalah dan mekanismenya:**  
  Proses pencarian melibatkan penerimaan event input, pemrosesan kata kunci, filtering katalog produk, dan pembaruan tampilan hasil. Apabila pemrosesan tersebut terlalu sering dilakukan atau pembuatan elemen DOM dilakukan sekaligus dalam jumlah besar, main thread dapat tertahan sehingga browser terlambat merespons interaksi dan menampilkan hasil pencarian.  
  Implementasi pencarian telah menggunakan beberapa strategi optimasi, yaitu debounce 150 ms, cache teks produk yang sudah dinormalisasi menggunakan WeakMap, persiapan indeks secara bertahap, dan rendering kartu produk per chunk. Namun, fungsi yang paling banyak menghabiskan waktu CPU harus dikonfirmasi melalui flame chart dan tab Bottom-up. Tanpa bukti tersebut, filtering katalog, normalisasi teks, dan rendering DOM merupakan bagian dari alur yang perlu diperiksa, bukan penyebab spesifik yang sudah terbukti.
- **Kualitas yang terdampak (ISO/IEC 25010:2023):**
  - `Performance Efficiency — Time behaviour`: Latensi interaksi yang tinggi menyebabkan hasil pencarian terlambat muncul setelah pengguna mengetik atau menghapus kata kunci.
  - `Performance Efficiency — Resource utilization`: Pemrosesan pencarian dan pembuatan DOM yang berlebihan berpotensi meningkatkan penggunaan CPU serta membatasi kesempatan browser untuk melakukan rendering.
  - `Interaction Capability — Operability`: Kolom pencarian yang lambat mengurangi kemudahan pengguna dalam mencari produk.
  - `Interaction Capability — User error protection`: Keterlambatan respons dapat membuat pengguna mengira input tidak diterima, kemudian mengulangi tindakan atau menghapus dan mengetik ulang kata kunci.
- **Perbaikan:**
  1. Menerapkan debounce 150 ms agar rangkaian input yang berdekatan tidak memicu pencarian berulang secara berlebihan.
  2. Menggunakan WeakMap untuk menyimpan teks produk yang telah dinormalisasi sehingga normalisasi tidak perlu diulang setiap pencarian.
  3. Menyiapkan indeks pencarian secara bertahap untuk mengurangi risiko satu task JavaScript yang terlalu panjang.
  4. Melakukan rendering kartu produk per chunk agar pembuatan elemen DOM tidak dilakukan sekaligus dalam jumlah besar.
  5. Mengukur ulang performa dengan konfigurasi CPU 4× slowdown dan prosedur yang sama seperti baseline.
- **Hasil pengukuran sesudah perbaikan:**
  - Percobaan 1: INP 240 ms — Long task 70 ms.
  - Percobaan 2: INP 40 ms — Long task 0 ms.
  - Percobaan 3: INP 96 ms — Long task 0 ms.  
  **Median sesudah: INP 96 ms; long task yang tercatat 0 ms.**  
  _Evaluasi hasil:_ Median INP turun dari 2.914 ms menjadi 96 ms, atau sekitar **96,7%**, sehingga target INP $\le 200\text{ ms}$ tercapai. Nilai long task sesudah perbaikan juga berada di bawah target $\le 100\text{ ms}$ berdasarkan data yang dicatat. Nilai 0 ms perlu dipastikan kembali pada trace; apabila tidak ada long task yang terdeteksi, didokumentasikan sebagai “tidak ada long task yang terdeteksi”, bukan sebagai tidak adanya aktivitas JavaScript.
- **Trade-off:** Debounce 150 ms mengurangi pekerjaan pencarian berulang, tetapi hasil baru dapat tertunda hingga jeda tersebut setelah input terakhir. Rendering bertahap juga dapat membuat sebagian kartu muncul sedikit lebih lambat. Cache teks ternormalisasi mengurangi pekerjaan berulang, tetapi perlu dipastikan tetap konsisten apabila data produk berubah.
- **Kesimpulan:** Berdasarkan tiga percobaan, median INP turun dari 2.914 ms menjadi **96 ms** dan memenuhi target $\le 200\text{ ms}$. Hasil ini menunjukkan peningkatan responsivitas pencarian yang signifikan. Bukti flame chart before-after tetap diperlukan untuk memastikan sumber utama latensi dan menghubungkan peningkatan performa dengan perubahan kode secara terukur.

---

## 5. Dugaan yang Ternyata Keliru

1. **Dugaan Rudi 1: loop bersarang di `kategori.js` adalah biang kerok utama (O(n²))**
   - _Klaim_: loop bersarang pemetaan kategori memakan waktu terbesar dan harus dioptimasi lebih dulu.
   - _Hasil ukur trace S0_: `pasangKaki()` hanya memakan **~0,3 ms** (< 0,05% total waktu rendering).
   - _Penjelasan_: hanya ada 8 kategori ($8 \times 8 = 64$ iterasi); kompleksitas $O(n^2)$ pada 64 iterasi tidak berdampak terukur.
2. **Dugaan Rudi 2 & tuduhan Pak Hendra (TK-1081): server backend lambat**
   - _Klaim_: Rudi meminta backend menambah server; Pak Hendra menuduh server lemot karena koneksi YouTube-nya lancar.
   - _Hasil ukur network S0_: `/api/produk` merespons **~180 ms**, dan latensi tiap gambar SVG hanya **80–300 ms**.
   - _Penjelasan_: backend tidak lambat. Kelambatan terjadi di sisi klien akibat 1.500 request gambar yang menjenuhkan batas 6 koneksi paralel HTTP/1.1. Setelah lazy loading dan chunking, gambar awal selesai **~1,95 detik**.
3. **Dugaan Rudi 3: bubble sort di `util.js` harus diganti Quicksort**
   - _Klaim_: `urutkanGelembung` diganti Quicksort agar halaman kencang.
   - _Hasil ukur trace S0_: dieksekusi sekali untuk 12 data merek di footer, hanya **~0,02 ms**.
   - _Penjelasan_: mengganti algoritma pada 12 data adalah optimasi prematur tanpa perubahan terukur di DevTools.
4. **Dugaan bahwa penulisan `localStorage` yang bikin tombol lambat:**
   - Awalnya kami menduga operasi simpan ke `localStorage` yang bikin tombol keranjang macet. Ternyata setelah dicek di DevTools, `localStorage.setItem` cuma memakan waktu sekitar **15 ms**. Biang kerok utamanya adalah perulangan hash 2 juta kali di `lacak.min.js` yang terpicu karena data riwayat 9.000 entri ikut dikirim.
5. **Dugaan bahwa fungsi `async` otomatis aman (catatan Rudi #4):**
   - Rudi menduga fungsi asinkron tidak akan memblokir dan sudah aman. Faktanya, fungsi `async` pada tombol beli tanpa adanya pengunci transaksi justru memicu _race condition_ saat ada jeda jaringan, sehingga pesanan ganda malah terjadi.

---

## 6. Yang Belum Beres dan Rekomendasi

- **Masalah yang tersisa:**
  - Evaluasi performa lanjutan untuk peramban mobile versi lama dan pengujian fungsional pada koneksi jaringan berfluktuasi tinggi.
- **Risiko dan mitigasi:**
  - _Dukungan native lazy loading pada browser tua:_ sebagian WebView atau peramban lawas mungkin belum mendukung `loading="lazy"`. Untuk peramban modern (Chromium, WebKit, Gecko) didukung penuh. Bila perlu dukungan legacy, gunakan polyfill ringan berbasis `IntersectionObserver`.
  - _Penanganan galat konten asinkron:_ bila `/api/promo` gagal atau timeout, banner perlu fallback state (menyembunyikan kontainer atau menampilkan banner default) agar teks placeholder tidak tampil terus-menerus.
- **Usulan untuk tim lain:**
  - _Tim Desain / UI-UX:_ selalu tetapkan dimensi pasti (_reserved height/aspect ratio_) atau komponen skeleton di design system untuk komponen yang bergantung pada API asinkron.
  - _Tim Backend:_
    - Adopsi format gambar modern (WebP atau AVIF) dan responsive image sizing (`srcset`) alih-alih satu file SVG statis seragam.
    - Aktifkan HTTP/2 atau HTTP/3 di server produksi agar multiplexing menghilangkan batas 6 koneksi per host.
    - Pencegahan pesanan ganda saat ini baru ditangani di sisi frontend. Sebaiknya tim backend menambahkan **Idempotency Key** pada endpoint POST `/api/pesanan` agar server punya pengaman transaksi dobel sendiri dan bisa menolak request yang sama jika ada gangguan jaringan.
  - _Tim Vendor SDK:_
    - Kirim event analitik (`impression`, `page_view`, `promo_click`) secara non-blocking (mis. `navigator.sendBeacon` atau `requestIdleCallback`) agar tidak membebani main thread.
    - Perulangan hash fingerprint 2 juta iterasi di `lacak.min.js` sebaiknya dihilangkan dari thread utama atau disediakan opsi resmi untuk dijalankan di Web Worker bawaan.

---

## 7. Pernyataan Penggunaan AI dan Pembagian Kerja

### Pernyataan penggunaan AI:
- **Alat AI yang digunakan:** Antigravity AI Assistant (Google DeepMind).
- **Pemanfaatan AI:** asisten diskusi teknis dan audit kode, memvalidasi dugaan keliru Rudi dengan bukti trace, serta mengevaluasi trade-off perbaikan layout shift dan image loading. Seluruh usulan kode diuji mandiri dan diverifikasi dengan Chrome DevTools (CPU 4x slowdown) sesuai protokol sebelum diterapkan.

### Pembagian kerja anggota tim:
- **Afriza (Penulis – Tanggung Jawab Skenario S0):**
  - Mengidentifikasi akar masalah, mencatat baseline, dan menyusun hipotesis sebelum perbaikan (P-05 dan P-07) pada `PREDIKSI.md`.
  - Mengimplementasikan perbaikan S0: pencegahan CLS dengan skeleton banner sinkron & responsif mobile (TK-1078), image loading dengan native lazy loading, decoding async, dan chunking 24 kartu (TK-1081), serta eliminasi layout thrashing judul produk via CSS.
  - Mengukur ulang hasil (CLS 0,475 $\rightarrow$ 0,002; request gambar 1.500 $\rightarrow$ 10) dan menyusun analisis trade-off.
  - Memverifikasi dan membantah dugaan keliru Rudi (#1, #2, #3) dan tuduhan Pak Hendra dengan data profiler.
  - Menyusun dokumentasi temuan T-01 dan T-07 pada `LAPORAN.md`.
- **Devi (Penulis – Tanggung Jawab Skenario S2 & S3):**
  - Mencari akar masalah lewat DevTools dan menyusun hipotesis sebelum perbaikan (P-01 dan P-02) pada `PREDIKSI.md`.
  - Memperbaiki S2 (TK-1044) pada tombol keranjang dengan memindahkan proses hashing SDK ke Web Worker via Blob, memangkas payload analitik, serta menerapkan caching memori dan debounce riwayat `localStorage`.
  - Memperbaiki S3 (TK-1052) pada tombol beli agar tidak terjadi pesanan dobel memakai guard `Set sedangDipesan`, menonaktifkan tombol ("Memproses…"), dan proteksi blok `try...finally`.
  - Mengukur ulang performa hingga target tercapai (INP 520 ms turun ke 81 ms; 3 klik cepat tervalidasi jadi tepat 1 pesanan) dan menyusun analisis trade-off.
  - Membantah catatan keliru Rudi (#4 fungsi async otomatis aman dan #5 SDK vendor tidak bisa dioptimasi) serta membuktikan lewat profiler bahwa `localStorage` bukan penyebab utama freeze.
  - Mendokumentasikan analisis temuan T-02 dan T-03 pada `LAPORAN.md` serta menuliskan evaluasi usulan perbaikan AI di `AUDIT-AI.md`.
- **Mario (Penulis – Tanggung Jawab Skenario S1):**
  - Mengidentifikasi akar masalah, mencatat baseline, dan menyusun hipotesis sebelum perbaikan pada `PREDIKSI.md` terkait keluhan keterlambatan respons kolom pencarian produk saat pengguna mengetik sepatu huruf demi huruf dan menghapus seluruh teks (TK-1041).
  - Menganalisis dan mengoptimalkan mekanisme pencarian pada `pencarian.js` dan `katalog.js`, termasuk penerapan debounce 150 ms, caching teks produk yang telah dinormalisasi menggunakan WeakMap, persiapan indeks secara bertahap, serta rendering kartu produk per chunk untuk mengurangi pekerjaan berulang dan beban DOM.
  - Mengukur ulang performa S1 melalui 3 kali pengujian menggunakan Chrome DevTools Performance dengan CPU 4× slowdown, kemudian mencatat median INP, durasi long task terlama, dan jumlah long task di atas 100 ms untuk dibandingkan dengan target INP $\le 200\text{ ms}$ dan long task $\le 100\text{ ms}$.
  - Menyusun dokumentasi bukti trace berupa flame chart before-after, mengidentifikasi fungsi yang paling berkontribusi terhadap latensi interaksi, menganalisis trade-off penerapan debounce terhadap kecepatan pembaruan hasil pencarian, melengkapi entri S1 pada `PREDIKSI.md`, serta mendokumentasikan temuan dan hasil evaluasi performa pencarian pada `LAPORAN.md`.
- **Dino (Penulis – Tanggung Jawab Skenario S4 & S6):**
  - Mengidentifikasi akar masalah, mencatat baseline, dan menyusun hipotesis sebelum perbaikan untuk skenario S4 dan S6 pada `PREDIKSI.md`.
  - Mengimplementasikan perbaikan S4 pada proses penerapan voucher, khususnya optimasi perhitungan harga promo dan simulasi cicilan agar proses lebih responsif serta pembaruan progres berlangsung bertahap.
  - Mengimplementasikan perbaikan S6 untuk mengurangi aktivitas pemrosesan dan rendering yang tidak diperlukan selama halaman berada dalam kondisi idle.
  - Mengukur ulang performa S4 dan S6 melalui tiga kali pengujian, menghitung median hasil sebelum dan sesudah perbaikan, serta mengevaluasi pencapaian target berdasarkan bukti pengukuran.
  - Menyusun analisis akar masalah, bukti profiler, hasil pengujian, dan trade-off perbaikan untuk temuan S4 dan S6 pada `LAPORAN.md`.
- **Hadi (Penulis – Tanggung Jawab Skenario S5):**
  - Mengidentifikasi akar masalah, mencatat baseline, dan menyusun hipotesis sebelum perbaikan (P-08) pada `PREDIKSI.md` terkait keluhan scroll patah-patah Bu Ningsih (TK-1063).
  - Mengimplementasikan perbaikan S5 pada `gulir.js` dan `util.js`: mengganti forced reflow (`getBoundingClientRect`) dengan `IntersectionObserver`, menerapkan `rafThrottle`, memindahkan animasi bilah baca ke CSS `transform: scaleX(...)` (Compositor thread), serta meng-cache `scrollHeight`.
  - Mengukur ulang performa S5 melalui 3 kali pengujian (CPU 4x slowdown) dan mencatat hasil median: frame > 50 ms turun dari ribuan menjadi 1 frame per 10 detik (target $\le 2$), serta long task terlama turun ke 95,4 ms (target $\le 100\text{ ms}$).
  - Menyusun dokumentasi bukti trace (flame chart before-after), analisis trade-off, pelengkapan entri P-08 pada `PREDIKSI.md`, dan penulisan temuan terkait performa gulir pada `LAPORAN.md`.
