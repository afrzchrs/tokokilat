# Log prediksi

Aturan: satu entri per masalah. Bagian **Sebelum perbaikan** harus di-commit *sebelum* commit
perbaikannya. Bagian **Sesudah perbaikan** diisi setelah pengukuran ulang. Jangan menyunting
bagian "sebelum" setelah hasilnya diketahui; bila prediksi meleset, jelaskan di bagian "sesudah".

---

## P-05: Pemuatan gambar produk kartu katalog (TK-1081)

**Tiket terkait:** TK-1081 (Skenario S0).
**Tanggal dan hash commit entri ini:** 2026-10-01(1a5490b)

### Sebelum perbaikan

- **Yang teramati di trace (baseline):**
  Pada S0 (pemuatan gambar): 1.500 event `ResourceSendRequest` untuk tipe Image (`/img/p/1.svg` sampai `/img/p/1500.svg`) diminta serentak sejak awal halaman dibuka. Semua unduhan selesai dalam waktu 1,1 menit karena antrean koneksi jaringan jenuh (*head-of-line blocking*).
- **Dugaan mekanisme:**
  Pada `public/js/katalog.js`, seluruh 1.500 elemen `<img>` langsung diberi atribut `src` saat kartu dibuat oleh `renderProduk()` tanpa atribut `loading="lazy"`. Browser langsung menembakkan 1.500 request HTTP bersamaan sehingga melampaui batas 6 koneksi paralel HTTP/1.1 per host, membuat gambar yang tampak di viewport tertahan antrean panjang.
  Pipeline yang dicurigai:
  `JavaScript (DOM creation) → Network Request Queue (1.500 concurrent images) → Resource Loading`.
- **Rencana perubahan:**
  Menambahkan atribut native `loading="lazy"` dan `decoding="async"` serta dimensi eksplisit (`width="480"` dan `height="480"`) pada elemen `<img>` kartu produk di `public/js/katalog.js`, memastikan kontainer media memiliki rasio aspek tetap (`aspect-ratio: 1 / 1`) di `public/css/toko.css`, serta menerapkan arsitektur *windowing/chunked rendering* bertahap (`UKURAN_CHUNK = 24`) berbasis `IntersectionObserver` sentinel dan CSS `content-visibility: auto` agar ukuran DOM awal tetap ramping dan efisien.
- **Prediksi terukur:**
  Permintaan gambar awal dalam 10 detik pertama (S0) diprediksi turun drastis dari 1.500 menjadi puluhan (sebanding dengan jumlah kartu yang tampak di viewport, sekitar 8–12 request). Waktu tampil gambar pertama berkurang signifikan (< 3 detik).
  Efek samping: Gambar produk yang jauh di bawah baru mulai dimuat saat pengguna menggulir mendekatinya.
- **Alternatif yang dipertimbangkan dan alasan tidak dipilih:**
  - Menggunakan library virtual scrolling pihak ketiga: Tidak dipilih karena aturan tugas melarang library/framework eksternal.
  - Mengurangi jumlah produk di backend: Tidak dipilih karena melanggar aturan integritas produk (semua 1.500 produk harus tetap ada di sisi klien untuk pencarian instan).

### Sesudah perbaikan

- **Hash commit perbaikan:**4b03068
- **Hasil ukur (median 3 kali):**
  - Percobaan 1: 10 permintaan gambar (11,0 kB), selesai dalam 1,95 detik (total 26 request pada halaman).
  - Percobaan 2: 10 permintaan gambar (11,0 kB), selesai dalam 1,97 detik (total 26 request pada halaman).
  - Percobaan 3: 10 permintaan gambar (11,0 kB), selesai dalam 2,00 detik (total 26 request pada halaman).
  - **Median:** 10 permintaan gambar (total 26 request halaman), waktu pemuatan gambar awal tuntas dalam 1,97 detik.
- **Prediksi vs kenyataan:**
  Prediksi terbukti sangat akurat. Penambahan atribut native `loading="lazy"`, `decoding="async"`, dan dimensi eksplisit (`width="480"`, `height="480"`), dibarengi penetapan `aspect-ratio: 1 / 1` di CSS serta *chunking windowing* 24 kartu awal di `katalog.js`, berhasil menahan peramban agar tidak menembakkan 1.500 permintaan gambar sekaligus. Browser Chrome hanya meminta gambar untuk produk yang langsung terlihat di viewport dan ambang batas bawah layar mobile 412 × 915 piksel (tepat 10 kartu pertama, `1.svg` s.d. `10.svg`). Antrean koneksi jaringan tidak lagi mengalami *head-of-line blocking*, kuota data sangat hemat (hanya ~11 kB di awal), dan pemuatan gambar tuntas seketika (~1,97 detik dibandingkan baseline yang memakan waktu > 1 menit).
- **Efek samping yang muncul:**
  Gambar produk yang posisinya berada di luar layar (*off-screen*) baru akan diunduh saat pengguna menggulir mendekati kartu tersebut. Ini merupakan perilaku lazim dan ramah performa (*lazy evaluation*) tanpa mengorbankan kelengkapan katalog.

## P-07: Pencegahan layout shift pada pemuatan awal

**Tiket terkait:** TK-1078 (Skenario S0)
**Tanggal dan hash commit entri ini:** 2026-10-01(1a5490b)

### Sebelum perbaikan

- **Yang teramati di trace (baseline):**
  Baseline menunjukkan event `LayoutShift` dengan cumulative score sebesar 0,475 (konsisten 0,475 di ketiga ulangan).
  Pergeseran terjadi pada detik 1,8 s.d. 2,0 saat response `/api/promo` selesai diterima, berdampak menggeser `DIV.alat-kanan`, `P#ringkasan`, kartu produk teratas, dan `FOOTER.kaki`.
- **Dugaan mekanisme:**
  Keping kategori dan banner promo dimuat secara asinkron. Pada `public/js/promo.js`, fungsi `pasangBannerPromo()` memanggil endpoint `/api/promo` (latensi ~1.800 ms) lalu menyisipkan banner menggunakan `$('#utama').prepend(banner);`.
  Karena kontainer tidak mencadangkan ruang sejak awal (*unreserved space / unsized injection*), penyisipan banner setinggi ~132px secara tiba-tiba mendorong seluruh konten di bawahnya ke bawah, menghasilkan skor CLS 0,475 dan memicu salah klik bagi pengguna yang hendak menekan produk teratas.
  Pipeline yang dicurigai:
  `JavaScript (async prepend) → Style → Layout (unexpected shift) → Paint`.
- **Rencana perubahan:**
  Menyisipkan struktur banner secara sinkron di JavaScript sebelum `fetch('/api/promo')` dikirim sebagai kerangka skeleton (*placeholder* teks), serta mencadangkan dimensi tinggi yang pasti di `public/css/toko.css` (`min-height: 132px` untuk desktop dan responsif mobile `min-height: 220px` pada layar $\le 640\text{ px}$ karena teks promo membungkus ke beberapa baris). Begitu data promo tiba, elemen hanya memperbarui teks di tempat tanpa mengubah tinggi kontainer. Selain itu, mengganti fungsi pemaksa reflow `samakanTinggiJudul()` dengan pembatasan 2 baris murni CSS (`-webkit-line-clamp: 2`).
- **Prediksi terukur:**
  Setelah perbaikan penuh, CLS pada skenario S0 diprediksi turun drastis dari 0,475 menjadi <= 0,1 (bahkan mendekati 0,000).
  Efek samping: Ruang banner akan menampilkan kerangka skeleton dengan teks placeholder selama 1,8 detik pertama sebelum data promo tiba.
- **Alternatif yang dipertimbangkan dan alasan tidak dipilih:**
  - Menghapus banner promo: Dilarang oleh aturan main (poin 4).
  - Memindahkan banner ke footer atau memakai fixed overlay popup: Tidak dipilih karena merusak tujuan bisnis promo Harbolnas dan melayang menutupi tombol filter kategori di layar mobile.

### Sesudah perbaikan

- **Hash commit perbaikan:** 4b03068
- **Hasil ukur (median 3 kali):**
  - Percobaan 1: CLS = 0,002 (pengukuran 10 detik dengan CPU 4x slowdown).
  - Percobaan 2: CLS = 0,002.
  - Percobaan 3: CLS = 0,002.
  - **Median:** CLS = 0,002 (konsisten 0,002 di seluruh pengujian, jauh melampaui batas target baku $\le 0{,}1$).
- **Prediksi vs kenyataan:**
  Prediksi terbukti akurat dan target tercapai melampaui target. Dengan penyisipan struktur `<section class="promo-banner">` secara sinkron sebelum fetch asinkron di `public/js/promo.js` dan penetapan dimensi responsif `min-height: 220px` pada viewport mobile di `public/css/toko.css`, kedatangan data promosi (latensi ~1,8 detik) tidak lagi mendorong elemen di bawahnya secara tiba-tiba. Elemen keping kategori, ringkasan, dan kartu produk teratas tetap berada stabil pada koordinat awalnya sejak frame pertama. Skor CLS turun drastis dari baseline 0,475 menjadi **0,002**, dan keluhan salah klik pada produk teratas teratasi sepenuhnya.
- **Efek samping yang muncul:**
  Selama ~1,8 detik pertama saat data promosi sedang diambil dari server, area banner menampilkan kerangka teks placeholder *"Memuat promo… Mohon tunggu, sedang mengambil syarat dan ketentuan promo."*. Hal ini memberikan umpan balik visual yang jelas bagi pengguna (*perceived performance*) tanpa menggeser tata letak.
