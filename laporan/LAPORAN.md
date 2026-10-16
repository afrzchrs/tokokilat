# Laporan audit performa dan interaksi TokoKilat

Tim: TokoKilat 12.12 | Anggota: Afriza (Penanggung Jawab Skenario S0) | Tanggal: 1 Oktober 2026
Panjang maksimal setara 6 halaman (tidak termasuk lampiran gambar).

## 1. Ringkasan eksekutif (maks. 150 kata)

Audit performa TokoKilat pada skenario S0 (pemuatan awal) mengungkap dua masalah kritis: ketidakstabilan tata letak (_layout shift_) akibat penyisipan banner promo asinkron yang terlambat, dan kelumpuhan antrean jaringan karena 1.500 gambar produk diunduh serentak. Akibatnya, pengguna mengalami salah klik pada produk teratas serta pemuatan gambar yang macet hingga lebih dari satu menit pada koneksi terbatas.

Perbaikan dilakukan murni pada platform web tanpa mengubah backend atau menghapus fitur: (1) menyisipkan kerangka skeleton banner secara sinkron di JavaScript sebelum fetch dimulai serta mencadangkan dimensi responsif mobile (`min-height: 220px`) di CSS, (2) menerapkan _native lazy loading_, rasio aspek tetap, dan arsitektur _windowing/chunked rendering_ (24 kartu) berbasis `IntersectionObserver`, serta (3) mengeliminasi _layout thrashing_ dengan penyeragaman tinggi judul 2 baris murni CSS (`-webkit-line-clamp: 2`).

Hasil pengujian membuktikan skor CLS turun drastis dari **0,475 menjadi 0,002** (target $\le 0{,}1$ tercapai melampaui ekspektasi), dan permintaan gambar awal turun dari **1.500 menjadi 10 permintaan gambar** (dari 26 total request halaman, sebanding dengan layar tampak). Halaman kini stabil seketika dan hemat kuota pengguna.

## 2. Lingkungan pengukuran

Pengukuran dilakukan dengan mematuhi protokol baku pada TUGAS.md bagian 7:

- **Perangkat / Perangkat Keras:** Laptop pengujian (Windows 11, Processor Multi-core, 16GB RAM, daya tersambung listrik).
- **Peramban:** Google Chrome versi stabil terbaru, jendela Incognito, tanpa ekstensi aktif, tab lain ditutup.
- **Konfigurasi Chrome DevTools:**
  - Device Toolbar: Viewport responsif ukuran **412 × 915 piksel**.
  - Panel Performance: Pengaturan throttling **CPU: 4x slowdown**. Jaringan tanpa throttling (_No throttling_).
  - Alamat Pengujian: `http://localhost:3000/?ukur=1` (dimuat ulang sekali pada sesi Incognito sebelum perekaman trace).
- **Beban Data:** Volume katalog 1.500 produk (`npm start` dengan `$env:JUMLAH_PRODUK=1500`).
- **Metode Pengukuran:** Setiap skenario diulang sebanyak **3 kali** berturut-turut setelah menekan tombol "Reset"; angka yang dilaporkan adalah nilai **median**.

## 3. Hasil sebelum dan sesudah

| Skenario | Metrik                                        | Sebelum (median) | Sesudah (median)  | Target                         | Tercapai?          |
| -------- | --------------------------------------------- | ---------------- | ----------------- | ------------------------------ | ------------------ |
| S0       | CLS                                           | 0.475            | 0.002             | <= 0,1                         | **Tercapai** |
| S0       | Jumlah permintaan gambar dalam 10 dtk pertama | 1500             | 10 (total 26 req) | sebanding dengan yang terlihat | **Tercapai** |
| S1       | INP                                           |                  |                   | <= 200 ms                      |                    |
| S1       | Long task terlama                             |                  |                   | <= 100 ms                      |                    |
| S2       | INP                                           |                  |                   | <= 200 ms                      |                    |
| S3       | Jumlah pesanan dari 3 klik                    |                  |                   | 1                              |                    |
| S4       | INP / progres tergambar bertahap?             |                  |                   | Tergambar bertahap             |                    |
| S5       | Frame > 50 ms per 10 dtk                      |                  |                   | <= 2                           |                    |
| S6       | Frame > 50 ms per 10 dtk                      |                  |                   | <= 2                           |                    |

## 4. Temuan

Ulangi blok berikut untuk tiap temuan. Urutkan berdasarkan dampak, bukan urutan tiket.

### T-01: Pemuatan gambar produk terlalu agresif (TK-1081)

- **Tiket terkait:** TK-1081 (Skenario S0). _(Catatan: TK-1041 Skenario S1 ditangani oleh rekan tim)._
- **Gejala bagi pengguna:**
  Pak Hendra (TK-1081, S0) melaporkan bahwa gambar produk lama sekali muncul dan hanya menampilkan kotak abu-abu dalam waktu lama, terutama saat menggulir cepat ke bawah. Selain itu, penggunaan kuota internet terasa sangat boros dan pengguna mengira server backend mengalami kelambatan.
- **Bukti:**
  Pada baseline trace S0, tercatat 1.500 event `ResourceSendRequest` dengan `resourceType: "Image"`, dari `/img/p/1.svg` sampai `/img/p/1500.svg` yang diminta sekaligus sejak awal halaman dimuat. Waktu tunggu `Queuing and connecting` gambar mencapai puluhan detik hingga lebih dari 1 menit karena antrean koneksi jaringan jenuh.
  **bukti berkas:** image/LAPORAN/1790854407049.png


- **Akar masalah dan mekanismenya:**
  Pada `public/js/katalog.js`, seluruh 1.500 elemen `<img>` langsung diberi atribut `src` saat kartu dibuat oleh `renderProduk()` tanpa atribut `loading="lazy"`. Browser langsung menembakkan 1.500 permintaan HTTP serentak, melampaui batas koneksi paralel per host (maksimal 6 koneksi pada HTTP/1.1). Akibatnya, terjadi antrean jaringan masif (_head-of-line blocking_), di mana gambar yang sedang dilihat pengguna di viewport harus mengantre di belakang ribuan gambar off-screen.
- **Kualitas yang terdampak (ISO/IEC 25010):**

  - `Performance efficiency – time behaviour`: Waktu tunggu pengunduhan gambar selesai memakan waktu > 1 menit.
  - `Performance efficiency – resource utilization`: Boros kuota data dan memori karena mengunduh seluruh 1.500 resource gambar sekaligus.
  - `Performance efficiency – capacity`: Strategi pemuatan tidak mampu berskala dengan baik ketika jumlah produk mencapai ribuan.
  - `Interaction capability – user engagement`: Pengalaman belanja pengguna terganggu akibat tampilan dipenuhi kotak abu-abu dalam waktu lama.
- **Perbaikan:**
  Pada `public/js/katalog.js`, menambahkan atribut native `loading="lazy"` dan `decoding="async"` serta dimensi eksplisit `width="480"` dan `height="480"` pada elemen `<img>`. Pada `public/css/toko.css`, menetapkan `aspect-ratio: 1 / 1;` pada kontainer `.kartu-media` dan `content-visibility: auto;` pada `.kartu`. Selain itu, diterapkan teknik penggambaran bertahap (_windowing/chunked rendering_ dengan `UKURAN_CHUNK = 24`) berbasis elemen batas `<div class="sentinel">` dan `IntersectionObserver`. Dengan kombinasi ini, mesin browser secara otomatis menahan pengunduhan resource gambar di luar layar dan menjaga ukuran DOM awal tetap kecil.
- **Trade-off:**
  Alternatif menggunakan pustaka Virtual Scrolling eksternal tidak dipilih karena aturan tugas melarang library pihak ketiga. Penggunaan native `loading="lazy"` dipadukan dengan vanilla JS chunking 24 kartu memanfaatkan Web API standar peramban, sangat stabil, dan tetap mempertahankan seluruh 1.500 data di memori klien untuk kebutuhan pencarian dan penyaringan instan. Efek sampingnya, gambar baru mulai diunduh saat pengguna menggulir mendekati kartu tersebut.
- **Hasil:**
  Jumlah permintaan gambar dalam 10 detik pertama (S0) turun drastis dari **1.500 request menjadi hanya 10 request gambar aktif** (dari total 26 request halaman, sebanding dengan kartu yang terlihat di viewport mobile 412 × 915). Antrean koneksi jaringan tidak lagi tersumbat dan waktu unduh gambar awal selesai seketika (~1,95 s.d. 2,00 detik). Target S0 tercapai secara tuntas.

  **bukti berkas:** image/LAPORAN/1792096628306.png

### T-07: Halaman meloncat saat pemuatan awal (Layout Shift)

- **Tiket terkait:** TK-1078 (Skenario S0).
- **Gejala bagi pengguna:**
  Kak Rara (TK-1078, S0) melaporkan bahwa ketika hendak menekan produk yang berada di posisi paling atas, halaman tiba-tiba bergeser/meloncat turun sendiri sehingga elemen yang tertekan malah menjadi banner promo.
- **Bukti:**
  Pada trace baseline S0 terdapat event `LayoutShift` dengan cumulative score sekitar 0,475. Layout shift tersebut menggeser elemen:
  `DIV class='alat-kanan'`, `P id='ringkasan' class='ringkasan'`, kartu produk teratas, dan `FOOTER class='kaki'`.
  **bukti berkas :** image/LAPORAN/1790854396366.png

- **Akar masalah dan mekanismenya:**
  Keping kategori dan banner promo dimuat secara asinkron. Khususnya pada `public/js/promo.js`, fungsi `pasangBannerPromo()` memanggil endpoint `/api/promo` yang memiliki latensi server ~1.800 ms.
  Setelah data promo diterima, banner baru dibuat dan disisipkan ke bagian paling atas kontainer menggunakan `$('#utama').prepend(banner);`.
  Karena kontainer `#utama` tidak memesan ruang sebelumnya (_unreserved space / unsized injection_), penyisipan elemen banner setinggi ~132px (atau ~220px di layar mobile) secara mendadak mendorong seluruh elemen di bawahnya ke bawah. Pergeseran mendadak setelah pemuatan awal inilah yang menghasilkan skor CLS masif sebesar 0,475 dan memicu salah klik pada target pengguna.
- **Kualitas yang terdampak (ISO/IEC 25010):**

  - `Performance efficiency – time behaviour`: Pekerjaan reflow/re-layout besar setelah response asinkron tiba.
  - `Interaction capability – user error protection`: Pengguna melakukan kesalahan klik tanpa sengaja (_accidental click_) akibat elemen berpindah posisi saat hendak disentuh.
  - `Interaction capability – operability`: Tata letak halaman tidak stabil sehingga menyulitkan navigasi.
- **Perbaikan:**

  1. Pada `public/js/promo.js`, fungsi `pasangBannerPromo()` menyisipkan elemen skeleton `<section class="promo-banner">` secara sinkron ke dalam `#utama` sebelum permintaan jaringan `fetch('/api/promo')` dikirimkan, lengkap dengan teks placeholder informatif. Begitu respons tiba, teks diperbarui di tempat tanpa mengubah dimensi kontainer.
  2. Pada `public/css/toko.css`, menetapkan `min-height: 132px` untuk desktop dan `@media (max-width: 640px) { .promo-banner { min-height: 220px; } }` untuk layar ponsel (412 × 915 px) agar sesuai dengan tinggi pembungkusan teks multi-baris promo.
  3. Menghapus fungsi pemaksa reflow `samakanTinggiJudul()` di `katalog.js` dan menggantinya dengan pembatasan tinggi 2 baris murni CSS (`-webkit-line-clamp: 2; height: calc(2 * 1.35em)`).
- **Trade-off:**
  Alternatif memindahkan banner ke footer atau memakai popup modal melayang tidak dipilih karena merusak tujuan promosi Harbolnas dan menutupi navigasi filter. Harga dari solusi ini adalah area banner menampilkan teks kerangka skeleton selama 1,8 detik pertama sebelum data promo tiba, namun hal ini memberikan kejelasan bagi pengguna (_perceived performance_) dan menjamin stabilitas layout 100%.
- **Hasil:**
  Skor CLS pada skenario S0 turun drastis dari **0,475 menjadi 0,002** (konsisten di seluruh pengujian, jauh di bawah batas target $\le 0{,}1$). Halaman tidak lagi meloncat ke bawah saat dimuat dan masalah salah klik pada target pengguna berhasil dihilangkan sepenuhnya. Target S0 tercapai secara tuntas.

  **bukti berkas :** image/LAPORAN/1792096733905.png

## 5. Dugaan yang ternyata keliru

1. **Dugaan Rudi 1: Loop bersarang di `kategori.js` adalah biang kerok utama (O(n²))**
   - _Klaim_: Rudi menduga loop bersarang pemetaan kategori di `kategori.js` memakan waktu paling besar dan harus dioptimasi terlebih dahulu.
   - _Hasil ukur trace S0_: Pada trace panel Performance S0, fungsi `pasangKaki()` hanya memakan waktu total sekitar **0,3 ms** (kurang dari 0,05% total waktu rendering).
   - _Penjelasan_: Jumlah kategori hanya ada 8 kategori ($8 \times 8 = 64$ iterasi). Kompleksitas $O(n^2)$ pada 64 iterasi sangat kecil dan tidak berdampak terukur sama sekali pada performa runtime.
2. **Dugaan Rudi 2 & Tuduhan Pak Hendra (TK-1081): Server backend lambat**
   - _Klaim_: Rudi meminta backend menambah server, dan Pak Hendra menuduh server TokoKilat lemot karena koneksi YouTube-nya lancar.
   - _Hasil ukur network S0_: Panel Network menunjukkan bahwa endpoint `/api/produk` merespons dalam waktu **~180 ms**, dan latensi server untuk setiap file gambar SVG hanya **80–300 ms**.
   - _Penjelasan_: Server backend sama sekali tidak lambat. Masalah kelambatan 100% terjadi di sisi browser klien akibat pengiriman 1.500 request gambar sekaligus yang menjenuhkan batas 6 koneksi paralel HTTP/1.1. Begitu lazy loading dan chunking diterapkan di klien, waktu unduh gambar awal selesai seketika (~1,95 detik).
3. **Dugaan Rudi 3: Bubble sort di `util.js` harus diganti Quicksort**
   - _Klaim_: Rudi menyarankan algoritma `urutkanGelembung` diganti menjadi Quicksort agar pemuatan halaman kencang.
   - _Hasil ukur trace S0_: Fungsi `urutkanGelembung` hanya dieksekusi sekali untuk mengurutkan 12 data merek di footer dengan durasi eksekusi hanya **~0,02 ms**.
   - _Penjelasan_: Mengganti Bubble sort dengan Quicksort pada 12 data adalah optimasi prematur yang tidak menghasilkan perubahan angka yang terukur di DevTools.

## 6. Yang belum beres dan rekomendasi

- **Masalah yang tersisa (di luar lingkup tanggung jawab S0):**
  - Skenario S1–S6 (interaktivitas pengetikan cari, reaksi visual tombol keranjang, pencegahan duplikasi checkout pada klik cepat, pemisahan komputasi voucher ke Web Worker, serta kehalusan animasi gulir dan pembersihan timer idle) saat ini berada di bawah tanggung jawab dan sedang diselesaikan oleh rekan tim di branch masing-masing.
- **Risiko dan Mitigasi:**
  - _Dukungan Native Lazy Loading pada Browser Tua:_ Sebagian WebView atau peramban lawas mungkin belum mendukung atribut `loading="lazy"`. Namun untuk target audiens Harbolnas pada peramban modern berbasis Chromium, WebKit, dan Gecko, fitur ini didukung penuh tanpa beban komputasi tambahan. Jika kelak dibutuhkan dukungan peramban legacy secara spesifik, mitigasi dapat menggunakan polyfill ringan berbasis `IntersectionObserver`.
  - _Penanganan Galat Konten Asinkron:_ Apabila server backend gagal merespons atau endpoint `/api/promo` mengalami timeout, banner promo perlu memiliki penanganan _fallback state_ (misalnya otomatis menyembunyikan kontainer atau menampilkan banner default) agar teks placeholder tidak terus-menerus tampil jika terjadi putus koneksi.
- **Usulan untuk Tim Lain:**
  - _Tim Desain / UI-UX:_ Selalu menetapkan dimensi pasti (_reserved height/aspect ratio_) atau komponen _skeleton placeholder_ dalam panduan desain sistem (_design system_) untuk semua komponen yang bergantung pada pemanggilan data API asinkron, guna memitigasi layout shift sejak tahap desain antarmuka.
  - _Tim Backend:_
    - Mengadopsi format gambar modern terkompresi (seperti WebP atau AVIF) serta menyediakan _responsive image sizing_ (`srcset`), bukan mengandalkan satu file SVG statis seragam, untuk lebih menghemat bandwidth pengguna.
    - Mengaktifkan protokol HTTP/2 atau HTTP/3 pada server produksi untuk memfasilitasi multiplexing koneksi jaringan yang efisien tanpa batasan 6 koneksi per host.
  - _Tim Vendor SDK:_ Memastikan pengiriman event analitik (`impression`, `page_view`, `promo_click`) dijalankan secara non-blocking (misalnya memanfaatkan `navigator.sendBeacon` atau `requestIdleCallback`) agar tidak membebani main thread peramban.

## 7. Pernyataan penggunaan AI dan pembagian kerja

- **Pernyataan Penggunaan AI:**
  - Alat AI yang digunakan: Antigravity AI Assistant (Google DeepMind).
  - Pemanfaatan AI: AI digunakan sebagai asisten diskusi teknis dan audit kode untuk menganalisis rekaman trace Chrome DevTools, merumuskan hipotesis siklus rendering pipeline, memvalidasi dugaan keliru Rudi dengan bukti trace, serta mengevaluasi trade-off solusi perbaikan layout shift dan image loading. Seluruh usulan kode perbaikan diuji secara mandiri dan diverifikasi menggunakan Chrome DevTools dengan CPU 4x slowdown sesuai protokol pengujian sebelum diterapkan.
- **Pembagian Kerja Anggota Tim:**
  - **Afriza (Penulis - Tanggung Jawab Skenario S0):**
    - Mengidentifikasi akar masalah, mencatat baseline, dan menyusun hipotesis sebelum perbaikan (P-05 dan P-07) pada `PREDIKSI.md`.
    - Mengimplementasikan perbaikan kode skenario S0: pencegahan CLS dengan skeleton banner sinkron & responsif mobile (`TK-1078`), penanganan image loading katalog dengan native lazy loading, decoding async, dan chunking DOM 24 kartu (`TK-1081`), serta eliminasi layout thrashing pada judul produk via CSS.
    - Mengukur ulang hasil sesudah perbaikan (CLS 0,475 menjadi **0,002**; Request Gambar 1.500 menjadi **10**) dan menyusun analisis trade-off.
    - Memverifikasi dan membantah dugaan keliru Rudi (#1, #2, #3) dan tuduhan Pak Hendra menggunakan data profiler empiris.
    - Menyusun dokumentasi temuan T-01 dan T-07 pada `LAPORAN.md`.
  - **Rekan Tim:**
    - Bertanggung jawab atas pengerjaan, pengujian trace, dan penulisan laporan skenario interaksi dan rendering lainnya: S1 (`TK-1041`), S2 (`TK-1044`), S3 (`TK-1052`), S4 (`TK-1057`), S5 (`TK-1063`), dan S6 (`TK-1070`).
