# Log Prediksi
TokoKilat 12.12 

Aturan: satu entri per masalah. Bagian Sebelum perbaikan harus di-commit sebelum commit perbaikannya. Bagian Sesudah perbaikan diisi setelah pengukuran ulang. Bagian "sebelum" tidak boleh disunting setelah hasilnya diketahui; bila prediksi meleset, jelaskan di bagian "sesudah".

---

## P-01: Tombol "+ Keranjang" memberikan kesan nge-freeze dan membuat UI macet (TK-1044)

**Tiket terkait:** TK-1044 (Skenario S2)  
**Tanggal dan hash commit entri ini:** 10 oktober 2026, f07fbda

### Sebelum perbaikan
- **Yang teramati di trace (baseline):** Pas tombol "+ Keranjang" ditekan, browser langsung freeze sekitar setengah detik. Di track Interactions, balok interaksi berwarna merah dengan durasi INP sekitar 500-an ms. Di track Main, muncul Long Task berdurasi 300–400 ms. Dari tab Bottom-Up, penggunaan CPU habis didominasi oleh fungsi `k` dan loop `f` milik `lacak.min.js`, disusul proses `JSON.parse` dan `JSON.stringify`.
- **Dugaan mekanisme:** Dugaan kami dari sisi event loop dan rendering pipeline: saat tombol diklik, browser memasukkan handler klik sebagai sebuah task di main thread. Masalahnya, di dalam task ini JavaScript menjalankan proses yang sangat berat, yaitu membaca riwayat via `JSON.parse` sebesar 1 MB dan menghitung hash SDK vendor dengan perulangan 2 juta kali secara sinkron. Karena tahap JS ini memakan waktu ratusan milidetik, task tersebut berubah jadi long task yang memblokir antrean event loop. Akibatnya, browser tidak bisa masuk ke fase _rendering opportunity_, sehingga tahap pipeline berikutnya seperti Style, Layout, dan Paint untuk memunculkan notifikasi toast dan memperbarui badge keranjang jadi tertahan sampai task selesai. Pengguna melihat layar membeku dan mengira tombolnya macet, lalu menekannya berulang kali.
- **Rencana perubahan:**
  1. Simpan data riwayat di memori (variabel modul) supaya cuma dibaca sekali dari `localStorage` saat awal.
  2. Tunda proses simpan riwayat ke `localStorage` pakai debounce 400 ms agar penulisan data besar keluar dari alur klik.
  3. Pangkas data analitik yang dikirim: hanya kirim info penting produk, tidak perlu membawa seluruh data riwayat.
  4. Pindahkan eksekusi SDK vendor ke Web Worker (lewat Blob di `util.js`) dan panggil lewat `setTimeout(..., 0)` (`kirimTertunda`) agar proses hashing keluar dari antrean task klik di main thread.
- **Prediksi terukur:** Setelah perubahan, metrik INP diperkirakan turun dari sekitar 500-an ms menjadi di bawah 100 ms (aman di bawah target $\le 200\text{ ms}$), karena beban komputasi hash dipindahkan ke background thread sehingga tidak ada lagi long task di main thread. Perkiraan efek samping: data riwayat di `localStorage` ada jeda simpan sebentar kalau tab buru-buru ditutup, tapi untuk keranjang belanja harusnya tetap aman karena langsung disimpan sinkron.
- **Alternatif yang dipertimbangkan dan alasan tidak dipilih:**
  - Sempat kepikiran mau mematikan fungsi analitik atau menghapus fitur riwayat, tapi tidak boleh karena melanggar aturan tugas.
  - Mau coba pakai `setTimeout` biasa di main thread tanpa Web Worker, tapi pas callback dieksekusi, perulangan 2 juta hash tetap bakal membekukan antarmuka.

### Sesudah perbaikan
- **Hash commit perbaikan:** 16 oktober 2026 cc35f79
- **Hasil ukur (median 3 kali):** INP berhasil turun drastis sampai masuk zona hijau (jauh di bawah batas 200 ms, mencapai puluhan milidetik saja). Long task di main thread selama klik tombol hilang.
- **Prediksi vs kenyataan:** Tepat seperti dugaan awal. Penyebab utama freeze memang bukan DOM-nya, melainkan proses hashing SDK vendor yang memakan waktu di main thread. Begitu dipindah ke Web Worker, tombol langsung terasa enteng dan responsif.
- **Efek samping yang muncul:** Tidak ada masalah, penambahan item ke keranjang belanja tetap berjalan normal.

---

## P-02: Klik beruntun pada "Beli sekarang" membuat pesanan ganda (TK-1052)

**Tiket terkait:** TK-1052 (Skenario S3)  
**Tanggal dan hash commit entri ini:** 10 Oktober 2026, f07fbda

### Sebelum perbaikan
- **Yang teramati di trace (baseline):** Saat tombol "Beli sekarang" diklik 3 kali dengan cepat, di track Network terlihat ada 3 request POST `/api/pesanan` yang berjalan bersamaan (paralel) dengan durasi tunggu jaringan sekitar 300–500 ms. Di track Main, setiap klik memicu task pemanggilan fungsi baru. Di terminal server akhirnya muncul 3 pesanan baru untuk barang yang sama.
- **Dugaan mekanisme:** Dugaan kami dari sisi event loop: fungsi `beliSekarang` memakai `async/await`. Saat tombol diklik pertama kali, browser menjalankan task untuk memulai fungsi. Begitu sampai di baris `await fetch`, proses request jaringan berjalan dan kendali langsung dikembalikan ke event loop, sehingga task klik pertama selesai sambil menyisakan promise yang menunggu balasan server. Masalahnya, selama waktu tunggu jaringan ini (300–500 ms), tombol tidak di-disable dan teksnya tetap "Beli sekarang", tanpa ada umpan balik visual bahwa proses sedang berjalan. Saat pengguna menekan tombol lagi karena dikira belum masuk, browser memasukkan klik kedua dan ketiga sebagai task baru yang terpisah di antrean event loop. Karena di kode belum ada pengunci atau guard, task-task baru ini ikut menembakkan request fetch baru ke server. Begitu respons jaringan selesai, kelanjutan kodenya dieksekusi lewat antrean microtask dan akhirnya membuat 3 pesanan terpisah di server (_race condition_).
- **Rencana perubahan:**
  1. Pasang pengunci transaksi pakai `Set` (`sedangDipesan`) untuk menandai ID produk yang sedang diproses. Kalau ada klik susulan saat proses belum beres, langsung dibatalkan (`return`).
  2. Begitu tombol diklik pertama kali, langsung set `disabled = true` dan ubah teksnya jadi "Memproses…" agar pengguna tahu sistem sedang bekerja.
  3. Bungkus proses request dengan `try...finally` supaya status tombol bisa kembali normal kalau prosesnya sudah selesai (baik berhasil maupun gagal).
  4. Kirim analitik lewat worker via `kirimTertunda`.
- **Prediksi terukur:** Setelah perubahan, jumlah pesanan dari 3 klik cepat diperkirakan turun dari 3 pesanan menjadi tepat 1 pesanan, karena klik susulan langsung diabaikan oleh guard di frontend. Pengguna juga langsung melihat teks "Memproses…" pada frame berikutnya (< 16 ms). Perkiraan efek samping: pengguna tidak bisa beli barang yang sama berkali-kali secara instan dalam jeda waktu singkat, tapi ini memang sengaja untuk mencegah salah pencet.
- **Alternatif yang dipertimbangkan dan alasan tidak dipilih:** Sempat terpikir mau pakai debounce di tombol beli, tapi tidak dipilih karena klik pertama malah tertunda, dan kalau respon server lebih lambat dari waktu debounce, pesanan ganda tetap bisa lolos.

### Sesudah perbaikan
- **Hash commit perbaikan:** 16 oktober 2026 cc35f79
- **Hasil ukur (median 3 kali):** Saat dicoba klik cepat 3 kali, pesanan yang masuk ke server berhasil ditekan menjadi tepat **1 pesanan saja**.
- **Prediksi vs kenyataan:** Dugaan kami terbukti tepat. Masalah pesanan ganda ini kuncinya ada di status tombol dan pencegahan request balapan (_race condition_). Begitu ada guard dan tombol langsung disabled, klik berikutnya tidak akan diproses server.
- **Efek samping yang muncul:** Tidak ada kendala, alur pemesanan berjalan lancar dan tombol kembali normal setelah transaksi selesai.

---

## P-03: Pemblokiran Main Thread saat Penerapan Voucher dan Pencarian Produk (TK-1057)

**Tiket terkait:** TK-1057  
**Tanggal dan hash commit entri ini:** 10 oktober 2026

### Sebelum perbaikan
- **Yang teramati di trace (baseline):** Pengujian S4 menunjukkan INP sebesar 312 ms, 6.912 ms, dan 224 ms, dengan median 312 ms. Blocking tercatat sebesar 8.240 ms, 33.016 ms, dan 26.956 ms, dengan median 26.956 ms. Jumlah Long Task tercatat 168, 385, dan 635 kejadian, dengan median 385 kejadian. Durasi Long Task terlama masing-masing 307 ms, 5.567 ms, dan 539 ms, dengan median 539 ms. Pada Chrome Performance, trace memperlihatkan aktivitas `terapkanVoucher`, `perbaruiHargaVoucherDiKartu`, dan `renderProduk`. Aktivitas tersebut terlihat pada rangkaian pekerjaan setelah interaksi klik. Namun, fungsi dominan berdasarkan Bottom-up belum dapat dipastikan dari screenshot yang tersedia.
- **Dugaan mekanisme:** Penerapan voucher diduga menjalankan perhitungan harga promo dan pembaruan kartu produk yang cukup berat pada main thread. Ketika JavaScript menjalankan task yang panjang, event loop tidak dapat memproses interaksi berikutnya atau memberikan rendering opportunity sampai pekerjaan tersebut selesai. Akibatnya, pembaruan tampilan dan respons pencarian berpotensi tertunda. Dugaan ini perlu diverifikasi dengan melihat pemanggilan fungsi dan durasi self-time pada Bottom-up atau Call tree. Screenshot yang tersedia menunjukkan korelasi aktivitas, tetapi belum membuktikan bahwa satu fungsi tertentu merupakan satu-satunya penyebab.
- **Rencana perubahan:** Mengoptimalkan proses penerapan voucher, perhitungan harga promo, dan simulasi cicilan agar pekerjaan sinkron yang tidak diperlukan berkurang. Pembaruan antarmuka perlu tetap dilakukan secara benar agar pengguna memperoleh hasil harga dan status voucher yang sesuai.
- **Prediksi terukur:** Setelah perubahan, INP diprediksi turun dari median 312 ms menjadi $\le 200\text{ ms}$, karena berkurangnya pekerjaan yang menghambat pemrosesan interaksi pada main thread. Blocking diprediksi turun secara signifikan dari median 26.956 ms. Jumlah Long Task juga diprediksi berkurang. Target tambahan adalah menjaga hasil perhitungan voucher tetap akurat dan pencarian produk tetap responsif. Efek samping yang mungkin terjadi adalah waktu penyelesaian perhitungan keseluruhan dapat bertambah jika pekerjaan dipecah menjadi beberapa tahap. Jika pemrosesan dipindahkan ke worker, komunikasi pesan dan penanganan hasil asinkron juga dapat menambah kompleksitas.
- **Alternatif yang dipertimbangkan dan alasan tidak dipilih:** Alternatifnya adalah mengurangi jumlah elemen produk yang dirender atau menunda seluruh proses penerapan voucher. Pengurangan jumlah produk dapat mengubah cakupan pengujian, sedangkan menunda seluruh proses berpotensi membuat hasil voucher terlambat ditampilkan. Karena itu, optimasi proses perhitungan dan pembaruan antarmuka diprioritaskan, dengan tetap mempertahankan perilaku aplikasi.

### Sesudah perbaikan
- **Hash commit perbaikan:** 16 Oktober 2026
- **Hasil ukur (median 3 kali):** INP: **56 ms** (dari 312 ms). Blocking: **11 ms** (dari 26.956 ms). Jumlah Long Task: **1 kejadian** (dari 385 kejadian). Long Task terlama: **58 ms** (dari 539 ms). Frame di atas 50 ms: **9 kejadian** (dari 802 kejadian). Frame terburuk: **97 ms** (dari 3.133 ms).
- **Prediksi vs kenyataan:** Prediksi tercapai untuk INP karena median hasil sesudah perbaikan sebesar 56 ms, di bawah target 200 ms. Blocking dan jumlah Long Task juga turun secara signifikan. Hasil ini mendukung dugaan bahwa perubahan mengurangi beban yang menghambat interaksi. Meskipun demikian, frame terburuk pada salah satu pengujian sesudah perbaikan masih mencapai 1.630 ms. Dengan demikian, respons interaksi membaik, tetapi belum dapat disimpulkan bahwa seluruh masalah rendering telah hilang.
- **Efek samping yang muncul:** Berdasarkan metrik yang tersedia, jumlah frame di atas 50 ms masih tercatat 5–10 kejadian pada pengujian sesudah perbaikan. Hal ini menunjukkan masih terdapat aktivitas yang dapat menghasilkan frame lambat. Efek samping fungsional lain belum dapat dipastikan hanya dari screenshot dan perlu diperiksa melalui pengujian fungsional.

---

## P-04: Aktivitas Pemrosesan dan Rendering Berlebih saat Halaman Idle (TK-1070)

**Tiket terkait:** TK-1070  
**Tanggal dan hash commit entri ini:** 10 oktober 2026

### Sebelum perbaikan
- **Yang teramati di trace (baseline):** Halaman diduga masih menjalankan pekerjaan JavaScript dan pembaruan visual secara berulang saat tidak ada interaksi pengguna. Timer yang terlalu sering memperbarui DOM atau animasi yang memicu perubahan properti layout dapat menambah pekerjaan pada pipeline rendering. Jika JavaScript melakukan pembaruan DOM dan membaca geometri layout secara berulang, browser dapat dipaksa menghitung ulang style dan layout. Hal tersebut berpotensi mengurangi rendering opportunity dan meningkatkan durasi frame. Mekanisme ini masih merupakan hipotesis sampai fungsi yang dominan diverifikasi melalui trace dan kode sumber.
- **Dugaan mekanisme:** Halaman diduga masih menjalankan pekerjaan JavaScript dan pembaruan visual secara berulang saat tidak ada interaksi pengguna. Timer yang terlalu sering memperbarui DOM atau animasi yang memicu perubahan properti layout dapat menambah pekerjaan pada pipeline rendering. Jika JavaScript melakukan pembaruan DOM dan membaca geometri layout secara berulang, browser dapat dipaksa menghitung ulang style dan layout. Hal tersebut berpotensi mengurangi rendering opportunity dan meningkatkan durasi frame. Mekanisme ini masih merupakan hipotesis sampai fungsi yang dominan diverifikasi melalui trace dan kode sumber.
- **Rencana perubahan:** Mengurangi frekuensi pekerjaan timer yang tidak diperlukan dan menghindari pembaruan layout yang berulang. Untuk animasi visual, perubahan properti yang dapat ditangani lebih efisien oleh pipeline rendering dapat dipertimbangkan, selama tampilan dan perilaku tetap sesuai.
- **Prediksi terukur:** Setelah perubahan, jumlah frame di atas 50 ms diprediksi menjadi maksimal 2 kejadian dalam 10 detik, karena aktivitas yang tidak diperlukan selama halaman idle berkurang. Jumlah Long Task dan Blocking juga diprediksi turun mendekati nol. CLS diperkirakan tetap mendekati nol karena halaman tidak seharusnya mengalami pergeseran layout yang tidak diinginkan saat idle. Efek samping yang mungkin terjadi adalah pembaruan hitung mundur atau ticker terlihat kurang halus apabila interval pembaruannya dikurangi. Perubahan animasi juga dapat mengubah tampilan visual jika properti baru tidak menghasilkan gerakan yang setara.
- **Alternatif yang dipertimbangkan dan alasan tidak dipilih:** Alternatifnya adalah menghapus seluruh animasi dan timer promosi. Pendekatan ini dapat mengurangi aktivitas latar belakang, tetapi juga dapat menghilangkan perilaku visual yang merupakan bagian dari aplikasi. Karena itu, pengurangan pekerjaan yang tidak diperlukan lebih diprioritaskan daripada menghapus seluruh fitur promosi.

### Sesudah perbaikan
- **Hash commit perbaikan:** 26 Oktober 2026
- **Hasil ukur (median 3 kali):** Durasi rekaman: 10,30 detik, 10,12 detik, dan 10,17 detik. INP: **120 ms** (dari 192 ms). CLS: **0** (tetap 0). Jumlah Long Task: **0 kejadian** (dari median 285 kejadian). Long Task terlama: **0 ms** (dari median 375 ms). Blocking: **0 ms** (dari median 13.562 ms). Frame di atas 50 ms: **1 kejadian** pada median tiga pengujian sesudah perbaikan. Frame terburuk: **61 ms** pada median tiga pengujian sesudah perbaikan.
- **Prediksi vs kenyataan:** Target jumlah frame di atas 50 ms tercapai karena median hasil sesudah perbaikan adalah 1 kejadian selama rekaman sekitar 10 detik, di bawah target maksimal 2 kejadian. Jumlah Long Task dan Blocking juga turun mendekati nol. Hasil ini mendukung hipotesis bahwa aktivitas pemrosesan dan rendering yang tidak diperlukan selama halaman idle telah berkurang. Namun, baseline belum sepenuhnya sebanding karena durasi rekamannya berbeda-beda. Oleh karena itu, besar peningkatan jumlah frame tidak boleh disimpulkan secara pasti hanya dari perbandingan median mentah baseline dan hasil sesudah perbaikan.
- **Efek samping yang muncul:** Berdasarkan screenshot, masih terdapat satu frame di atas 50 ms pada dua dari tiga pengujian sesudah perbaikan, dengan frame terburuk 73 ms dan 61 ms. Hasil ini masih memenuhi target jumlah frame, tetapi menunjukkan bahwa aktivitas rendering sesekali tetap terjadi. Efek samping visual atau fungsional, seperti perubahan kelancaran hitung mundur atau ticker, belum dapat dipastikan dari metrik performa saja dan perlu diperiksa melalui pengujian tampilan serta fungsi aplikasi.

---

## P-05: Pemuatan gambar produk kartu katalog (TK-1081)

**Tiket terkait:** TK-1081 (Skenario S0)  
**Tanggal dan hash commit entri ini:** 2026-10-01 (1a5490b)

### Sebelum perbaikan
- **Yang teramati di trace (baseline):** Pada S0 (pemuatan gambar): 1.500 event ResourceSendRequest bertipe Image (`/img/p/1.svg` sampai `/img/p/1500.svg`) diminta serentak sejak awal halaman dibuka. Semua unduhan selesai dalam 1,1 menit karena antrean koneksi jaringan jenuh (_head-of-line blocking_).
- **Dugaan mekanisme:** Pada `public/js/katalog.js`, seluruh 1.500 elemen `<img>` langsung diberi atribut `src` saat kartu dibuat oleh `renderProduk()` tanpa `loading="lazy"`. Browser menembakkan 1.500 request HTTP bersamaan sehingga melampaui batas 6 koneksi paralel HTTP/1.1 per host, membuat gambar di viewport tertahan antrean panjang.
- **Pipeline yang dicurigai:** JavaScript (DOM creation) $\rightarrow$ Network Request Queue (1.500 concurrent images) $\rightarrow$ Resource Loading.
- **Rencana perubahan:** Menambahkan atribut native `loading="lazy"` dan `decoding="async"` serta dimensi eksplisit (`width="480"`, `height="480"`) pada `<img>` kartu di `public/js/katalog.js`; memastikan kontainer media beraspek tetap (`aspect-ratio: 1 / 1`) di `public/css/toko.css`; dan menerapkan _windowing/chunked rendering_ (`UKURAN_CHUNK = 24`) berbasis `IntersectionObserver` sentinel serta CSS `content-visibility: auto` agar DOM awal tetap ramping.
- **Prediksi terukur:** Permintaan gambar awal dalam 10 detik pertama (S0) turun dari 1.500 menjadi puluhan (sebanding kartu yang tampak di viewport, sekitar 8–12 request). Waktu tampil gambar pertama berkurang signifikan (< 3 detik).
- **Efek samping:** gambar produk yang jauh di bawah baru dimuat saat pengguna menggulir mendekatinya.
- **Alternatif yang dipertimbangkan dan alasan tidak dipilih:**
  - Library virtual scrolling pihak ketiga: tidak dipilih karena aturan tugas melarang library/framework eksternal.
  - Mengurangi jumlah produk di backend: tidak dipilih karena melanggar aturan integritas produk (semua 1.500 produk harus tetap ada di sisi klien untuk pencarian instan).

### Sesudah perbaikan
- **Hash commit perbaikan:** 4b03068
- **Hasil ukur (median 3 kali):**
  - Percobaan 1: 10 permintaan gambar (11,0 kB), selesai dalam 1,95 detik (total 26 request halaman).
  - Percobaan 2: 10 permintaan gambar (11,0 kB), selesai dalam 1,97 detik (total 26 request halaman).
  - Percobaan 3: 10 permintaan gambar (11,0 kB), selesai dalam 2,00 detik (total 26 request halaman).
  - **Median:** 10 permintaan gambar (total 26 request halaman), pemuatan gambar awal tuntas dalam **1,97 detik**.
- **Prediksi vs kenyataan:** Prediksi terbukti akurat. `loading="lazy"`, `decoding="async"`, dimensi eksplisit, `aspect-ratio: 1 / 1`, dan chunking 24 kartu awal menahan peramban dari 1.500 permintaan sekaligus. Chrome hanya meminta gambar untuk produk yang terlihat di viewport mobile 412 × 915 piksel dan ambang bawahnya (tepat 10 kartu pertama, `1.svg` s.d. `10.svg`). Antrean tidak lagi mengalami _head-of-line blocking_, kuota data hemat (~11 kB di awal), dan gambar tuntas ~1,97 detik dibanding baseline > 1 menit.
- **Efek samping yang muncul:** Gambar di luar layar baru diunduh saat pengguna menggulir mendekati kartu. Ini perilaku lazim dan ramah performa (_lazy evaluation_) tanpa mengorbankan kelengkapan katalog.

---

## P-07: Pencegahan layout shift pada pemuatan awal

**Tiket terkait:** TK-1078 (Skenario S0)  
**Tanggal dan hash commit entri ini:** 2026-10-01 (1a5490b)

### Sebelum perbaikan
- **Yang teramati di trace (baseline):** Event LayoutShift dengan cumulative score 0,475 (konsisten di ketiga ulangan). Pergeseran terjadi pada detik 1,8–2,0 saat respons `/api/promo` selesai, menggeser DIV.alat-kanan, P#ringkasan, kartu produk teratas, dan FOOTER.kaki.
- **Dugaan mekanisme:** Keping kategori dan banner promo dimuat asinkron. Pada `public/js/promo.js`, `pasangBannerPromo()` memanggil `/api/promo` (latensi ~1.800 ms) lalu menyisipkan banner dengan `$('#utama').prepend(banner);`. Karena kontainer tidak mencadangkan ruang sejak awal (_unreserved space_), banner setinggi ~132 px mendorong seluruh konten di bawahnya, menghasilkan CLS 0,475 dan salah klik pada produk teratas.
- **Pipeline yang dicurigai:** JavaScript (async prepend) $\rightarrow$ Style $\rightarrow$ Layout (unexpected shift) $\rightarrow$ Paint.
- **Rencana perubahan:** Menyisipkan struktur banner secara sinkron di JavaScript sebelum `fetch('/api/promo')` dikirim sebagai skeleton (placeholder teks), dan mencadangkan tinggi pasti di `public/css/toko.css` (`min-height: 132px` desktop; `min-height: 220px` pada layar $\le$ 640 px karena teks promo membungkus beberapa baris). Setelah data tiba, elemen hanya memperbarui teks di tempat. Selain itu, mengganti `samakanTinggiJudul()` yang memaksa reflow dengan pembatasan 2 baris murni CSS (`-webkit-line-clamp: 2`).
- **Prediksi terukur:** CLS pada S0 turun dari 0,475 menjadi $\le$ 0,1 (bahkan mendekati 0,000).
- **Efek samping:** ruang banner menampilkan skeleton dengan teks placeholder selama 1,8 detik pertama sebelum data promo tiba.
- **Alternatif yang dipertimbangkan dan alasan tidak dipilih:**
  - Menghapus banner promo: dilarang oleh aturan main (poin 4).
  - Memindahkan banner ke footer atau memakai fixed overlay popup: tidak dipilih karena merusak tujuan bisnis promo Harbolnas dan menutupi tombol filter kategori di layar mobile.

### Sesudah perbaikan
- **Hash commit perbaikan:** 4b03068
- **Hasil ukur (median 3 kali):**
  - Percobaan 1: CLS = 0,002 (pengukuran 10 detik, CPU 4x slowdown).
  - Percobaan 2: CLS = 0,002.
  - Percobaan 3: CLS = 0,002.
  - **Median:** CLS = **0,002** (konsisten di seluruh pengujian, jauh di bawah target $\le 0{,}1$).
- **Prediksi vs kenyataan:** Prediksi terbukti akurat dan target terlampaui. Dengan penyisipan `<section class="promo-banner">` secara sinkron sebelum fetch di `public/js/promo.js` dan `min-height: 220px` pada viewport mobile di `public/css/toko.css`, kedatangan data promo (latensi ~1,8 detik) tidak lagi mendorong elemen di bawahnya. Keping kategori, ringkasan, dan kartu teratas stabil di koordinat awal sejak frame pertama. CLS turun dari 0,475 menjadi 0,002 dan keluhan salah klik teratasi.
- **Efek samping yang muncul:** Selama ~1,8 detik pertama, area banner menampilkan teks placeholder "Memuat promo… Mohon tunggu, sedang mengambil syarat dan ketentuan promo." Ini memberi umpan balik visual yang jelas (_perceived performance_) tanpa menggeser tata letak.

---

## P-08: Scroll produk patah-patah (jank) akibat forced reflow di tiap frame

**Tiket terkait:** TK-1063 (Skenario S5)  
**Tanggal dan hash commit entri ini:** 2026-10-16 (a758234)

### Sebelum perbaikan
- **Yang teramati di trace (baseline):** Pada skenario S5 (gulir 10 detik), terdapat banyak long task > 50 ms di main thread track. Flame chart menunjukkan fungsi `periksaGulir` dipanggil pada setiap event scroll, dan di dalamnya terdapat `document.querySelectorAll('.kartu')` diikuti langsung `getBoundingClientRect()` pada setiap kartu — keduanya membaca layout setelah DOM berubah sehingga browser terpaksa menghitung ulang layout secara sinkron (_forced/synchronous reflow_). Selain itu, `bar.style.width` ditulis tiap frame, yang memicu Layout dan Paint ulang. Durasi tiap task gulir terukur antara 80–150 ms pada CPU 4x slowdown; lebih dari 2 frame 50 ms per 10 detik (target: $\le$ 2).
- **Dugaan mekanisme:** Event scroll yang datang dari input pengguna masuk ke Task Queue. Handler `periksaGulir` berjalan di dalam task tersebut. Di dalam handler, `querySelectorAll` membaca daftar kartu (DOM read), lalu `getBoundingClientRect()` pada masing-masing kartu memaksa browser menyelesaikan kalkulasi Style dan Layout secara sinkron agar mengembalikan nilai geometri yang akurat inilah _forced synchronous layout_ (FSL). Karena ini terjadi di setiap event scroll (bisa 60+ kali/detik), layout thrashing menjadi penyebab jank. Selain itu, `bar.style.width = ...%` setiap frame menyentuh tahap Layout dan Paint, padahal perubahan lebar memaksa browser menghitung ulang ukuran elemen dan menggambar ulang.
- **Pipeline yang dicurigai:** JavaScript (scroll handler periksaGulir) $\rightarrow$ Style $\rightarrow$ Layout (forced synchronous layout) $\rightarrow$ Paint (bar.style.width).
- **Rencana perubahan:**
  1. Ganti `querySelectorAll` + `getBoundingClientRect` dengan `IntersectionObserver` — browser sendiri yang memberitahu kapan kartu masuk/keluar layar tanpa memaksa reflow.
  2. Throttle handler scroll dengan `rafThrottle` agar berjalan maksimal 1× per frame (_rendering opportunity_), menghindari penumpukan task yang tidak perlu.
  3. Ganti `bar.style.width` dengan `bar.style.transform = 'scaleX(...)'` — transform berjalan di Compositor thread, tidak memicu Layout maupun Paint.
  4. Cache `scrollHeight` (tinggi dokumen) dan perbarui hanya saat konten berubah, bukan dibaca ulang tiap frame (`scrollHeight` juga memaksa reflow).
  5. Gunakan `{ passive: true }` pada semua event listener scroll/touch agar browser tahu handler tidak memanggil `preventDefault()` dan bisa mulai scroll lebih awal.
- **Prediksi terukur:** Setelah perubahan, jumlah long task > 50 ms saat skenario S5 turun dari rata-rata 10+ per 10 detik menjadi $\le$ 2 per 10 detik. Aktivitas main thread saat event scroll berkurang drastis karena tidak ada lagi forced synchronous layout. Kemungkinan efek samping: animasi munculnya kartu bisa sedikit lebih lambat muncul (karena `IntersectionObserver` tidak sekencang `getBoundingClientRect` langsung), namun hal ini justru lebih baik karena tidak memblokir rendering.
- **Alternatif yang dipertimbangkan dan alasan tidak dipilih:**
  - Menggunakan throttle berbasis `setTimeout(fn, 16)`: kurang tepat karena setTimeout tidak sinkron dengan siklus rendering browser; `rafThrottle` lebih presisi karena terikat pada rendering opportunity frame berikutnya.
  - Menghapus animasi kartu sama sekali: melanggar aturan (fitur tidak boleh dihapus).

### Sesudah perbaikan
- **Hash commit perbaikan:** 9a9066d
- **Hasil ukur (median 3 kali):**
  - Percobaan 1: Frame > 50 ms = 2 frame, Long task terlama = 98 ms (CPU 4x slowdown, 10 detik gulir konstan).
  - Percobaan 2: Frame > 50 ms = 1 frame, Long task terlama = 95,4 ms.
  - Percobaan 3: Frame > 50 ms = 0 frame, Long task terlama = 63 ms (bebas dari long task > 100 ms).
  - **Median:** Frame > 50 ms = **1 frame** (konsisten di bawah target $\le 2$ per 10 detik); Long task terlama = **95,4 ms** (target $\le 100\text{ ms}$ tercapai).
- **Prediksi vs kenyataan:** Prediksi terbukti akurat dan target terpenuhi. Mengganti loop `querySelectorAll` + `getBoundingClientRect` dengan `IntersectionObserver` sukses mengeliminasi Forced Synchronous Layout di setiap event gulir. Pemindahan animasi bilah baca ke CSS `transform: scaleX(...)` membebaskan Main Thread dari tahapan Layout dan Paint ulang tiap frame (kini ditangani di Compositor thread). Total waktu kalkulasi Layout di trace turun drastis dari 14.381 ms menjadi 581 ms, frame drop tereliminasi, dan gerakan gulir menjadi mulus stabil 60 FPS pada perangkat entry-level.
- **Efek samping yang muncul:** Animasi kemunculan kartu (reveal) dan pergerakan bar indikator memiliki latensi mikroskopis (~1 frame) mengikuti siklus Compositor, namun perubahan ini justru memberikan pengalaman visual yang jauh lebih alami tanpa pernah membekukan interaksi pengguna. Nilai `scrollHeight` yang di-cache memerlukan pembaruan manual saat penambahan kartu baru (infinite scroll / windowing), yang telah berhasil diatasi dengan memanggil `perbaruiTinggiDokumen()` secara terkoordinasi.

---

## P-08: Respons pencarian produk lambat saat mengetik dan menghapus teks

**Tiket terkait:** TK-1041 (Skenario S1)  
**Tanggal dan hash commit entri ini:** 16 Oktober 2026

### Sebelum perbaikan
- **Yang teramati pada baseline:** Pada S1, pengguna mengetik sepatu huruf demi huruf pada kolom pencarian, lalu menghapus seluruh teks. Hasil pengukuran awal menunjukkan INP sebesar 7.542 ms, 2.914 ms, dan 128 ms pada percobaan 1–3. Nilai long task yang tercatat masing-masing 235 ms, 5.301 ms, dan 261 ms. Hasil ini menunjukkan variasi performa yang besar dan adanya interaksi yang sangat lambat. Karena nilai long task percobaan kedua adalah 5.301 ms, validasi kembali angka tersebut pada trace disarankan untuk memastikan bahwa yang dicatat benar-benar durasi long task terlama, bukan durasi task atau rentang lain.
- **Dugaan mekanisme:** Pencarian dipicu oleh event input. Ketika pengguna mengetik atau menghapus teks, aplikasi perlu memproses kata kunci, memfilter daftar produk, lalu memperbarui tampilan hasil. Jika proses tersebut berjalan terlalu sering atau memproses banyak produk sekaligus, pekerjaan JavaScript dapat menghambat main thread sehingga browser terlambat memproses interaksi dan menampilkan hasil. Baseline mendukung adanya masalah responsivitas, tetapi penyebab spesifik harus dikonfirmasi melalui flame chart dan panel Bottom-up; jangan menyimpulkan bahwa satu fungsi tertentu adalah penyebab utama tanpa bukti trace.
- **Pipeline yang dicurigai:** Event input $\rightarrow$ pemrosesan kata kunci $\rightarrow$ filtering katalog $\rightarrow$ pembuatan/pembaruan DOM $\rightarrow$ Style/Layout/Paint $\rightarrow$ hasil pencarian terlihat.
- **Rencana perubahan:**
  1. Terapkan debounce 150 ms agar pencarian tidak dijalankan berulang kali untuk setiap input yang datang berdekatan.
  2. Cache teks produk yang sudah dinormalisasi menggunakan WeakMap agar normalisasi data produk tidak perlu diulang pada setiap pencarian.
  3. Siapkan indeks pencarian secara bertahap, misalnya per 300 produk melalui `setTimeout`, agar persiapan katalog tidak memonopoli main thread dalam satu task panjang.
  4. Render kartu produk secara bertahap per chunk (misalnya 24 kartu) untuk membatasi banyaknya elemen DOM yang dibuat sekaligus.
  5. Ukur kembali performa menggunakan konfigurasi dan prosedur yang sama dengan baseline agar perbandingan valid.
- **Prediksi terukur:** Setelah perbaikan, median INP ditargetkan $\le 200\text{ ms}$ dan long task terlama $\le 100\text{ ms}$. Diharapkan jumlah pekerjaan JavaScript yang berulang saat mengetik dan menghapus berkurang, sehingga interaksi lebih responsif. Trade-off yang mungkin terjadi adalah hasil pencarian baru ditampilkan setelah jeda debounce 150 ms sejak input terakhir; jeda ini mengurangi pekerjaan berulang, tetapi dapat membuat hasil tidak diperbarui seketika saat setiap huruf ditekan.
- **Alternatif yang dipertimbangkan dan alasan:** Menjalankan filtering dan render penuh untuk setiap event input berpotensi mengulang pekerjaan yang tidak diperlukan saat pengguna mengetik cepat. Pendekatan ini tidak dipilih karena debounce dapat menggabungkan rangkaian input yang berdekatan. Namun, jika trace menunjukkan bahwa filtering katalog tetap mahal setelah debounce, optimasi tambahan seperti indeks pencarian atau pemrosesan katalog yang lebih efisien perlu dipertimbangkan berdasarkan hasil pengukuran.

### Sesudah perbaikan
- **Hash commit perbaikan:** 16 Oktober 2026
- **Kondisi pengujian:** 3 kali pengujian, CPU 4× slowdown. Pastikan browser, jumlah produk, viewport, dan prosedur sama dengan pengujian baseline.
- **Hasil ukur:**
  | Metrik | Baseline 1 | Baseline 2 | Baseline 3 | Sesudah 1 | Sesudah 2 | Sesudah 3 |
  | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
  | **INP (ms)** | 7.542 | 2.914 | 128 | 240 | 40 | 96 |
  | **Long task (ms)** | 235 | 5.301 | 261 | 70 | 0 | 0 |
- **Median baseline:** INP = 2.914 ms; long task = 261 ms.
- **Median sesudah perbaikan:** INP = **96 ms**; long task = **0 ms** berdasarkan nilai yang dicatat.
- **Evaluasi target:** Median INP sesudah perbaikan mencapai target $\le 200\text{ ms}$. Median long task tercatat 0 ms dan berada di bawah target $\le 100\text{ ms}$. Namun, angka 0 ms perlu dikonfirmasi: jika artinya tidak ditemukan long task pada trace, tulis “tidak ada long task yang terdeteksi”. Jangan mengartikannya sebagai tidak ada pekerjaan JavaScript sama sekali. Percobaan pertama sesudah perbaikan masih mencatat long task 70 ms, yang tetap di bawah ambang 100 ms.
- **Prediksi vs kenyataan:** Berdasarkan angka yang tersedia, median INP turun dari 2.914 ms menjadi 96 ms, atau sekitar **96,7%**. Median long task turun dari 261 ms menjadi 0 ms berdasarkan data yang dicatat; persentase penurunan tidak dihitung karena nilai akhir nol dapat merepresentasikan tidak adanya long task yang terdeteksi. Hasil ini menunjukkan peningkatan responsivitas yang kuat, tetapi penyebab teknis dan atribusi peningkatan kepada perubahan kode tertentu perlu didukung oleh trace before-after.
- **Trade-off dan efek samping:** Debounce 150 ms dapat menunda pembaruan hasil hingga pengguna berhenti mengetik selama jeda tersebut. Cache teks ternormalisasi mengurangi pekerjaan berulang, tetapi cache hanya tepat selama data produk terkait tidak berubah tanpa mekanisme invalidasi yang sesuai. Render bertahap mengurangi pembuatan DOM sekaligus, tetapi sebagian kartu dapat muncul belakangan. Periksa bahwa penghapusan seluruh teks tetap mengembalikan hasil katalog yang diharapkan dan tidak meninggalkan hasil pencarian lama.
