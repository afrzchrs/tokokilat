# Log prediksi

Aturan: satu entri per masalah. Bagian **Sebelum perbaikan** harus di-commit *sebelum* commit
perbaikannya. Bagian **Sesudah perbaikan** diisi setelah pengukuran ulang. Jangan menyunting
bagian "sebelum" setelah hasilnya diketahui; bila prediksi meleset, jelaskan di bagian "sesudah".

---

## P-05: Optimasi rendering kartu katalog, pencarian, dan pemuatan gambar

**Tiket terkait:** TK-1041, TK-1081 (dan TK-1063 sisi katalog)
**Tanggal dan hash commit entri ini:** [isi setelah commit]

### Sebelum perbaikan

- **Yang teramati di trace (baseline):**
  - Pada S1 (ketik pencarian): INP baseline sebesar 3.328 ms (median dari 2.464, 3.328, 4.648 ms) dan Long Task terlama 2.031 ms (median dari 1.840, 2.031, 2.481 ms). Trace menunjukkan blok panjang di bawah `samakanTinggiJudul()` dengan tanda segitiga merah "Forced reflow".
  - Pada S0 (pemuatan gambar): 1.500 event `ResourceSendRequest` untuk tipe Image (`/img/p/1.svg` sampai `/img/p/1500.svg`) diminta serentak. Semua unduhan selesai dalam waktu 1,1 menit karena antrean jaringan jenuh (*head-of-line blocking*).
- **Dugaan mekanisme:**
  1. Pada `public/js/pencarian.js` dan `public/js/katalog.js`: Setiap ketukan huruf di kolom cari menghapus dan membangun ulang seluruh 1.500 kartu di DOM, lalu memanggil `samakanTinggiJudul()` yang memaksa browser menghitung ulang geometri (*Forced Synchronous Layout / Layout Thrashing*).
  2. Pada `public/js/katalog.js`: Elemen `<img>` langsung diberi atribut `src` tanpa `loading="lazy"`. Browser menembakkan 1.500 request HTTP bersamaan sehingga melampaui batas 6 koneksi paralel HTTP/1.1 per host, membuat gambar pada viewport tertahan antrean panjang.
  Pipeline yang dicurigai:
  `JavaScript (DOM reconstruction) → Forced Layout (samakanTinggiJudul) → Network Congestion (1.500 concurrent images)`.
- **Rencana perubahan:**
  1. Pembuatan kartu dilakukan bertahap (misal 24 per kelompok) dan tinggi judul kartu diatur menggunakan CSS murni (`-webkit-line-clamp`) tanpa manipulasi JavaScript berulang.
  2. Menambahkan atribut native `loading="lazy"` dan `decoding="async"` pada elemen `<img>` kartu produk.
- **Prediksi terukur:**
  - S1: INP diprediksi turun dari 3.328 ms menjadi <= 200 ms, dan Long Task terlama turun dari 2.031 ms menjadi <= 100 ms.
  - S0: Permintaan gambar awal dalam 10 detik pertama diprediksi turun dari 1.500 menjadi puluhan (sebanding dengan yang terlihat di viewport).
  Efek samping: Gambar produk yang jauh di bawah baru mulai dimuat saat pengguna menggulir mendekatinya.
- **Alternatif yang dipertimbangkan dan alasan tidak dipilih:**
  - Menggunakan library virtual scrolling pihak ketiga: Tidak dipilih karena aturan tugas melarang framework/library eksternal.
  - Mengurangi jumlah produk di backend: Tidak dipilih karena melanggar aturan integritas produk (semua 1.500 produk harus tetap ada).

### Sesudah perbaikan

- **Hash commit perbaikan:** ....
- **Hasil ukur (median 3 kali):** ....
- **Prediksi vs kenyataan:** ....
- **Efek samping yang muncul:** ....



## P-07: Pencegahan layout shift pada pemuatan awal

**Tiket terkait:** TK-1078
**Tanggal dan hash commit entri ini:** [isi setelah commit]

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
  Mencadangkan ruang sejak awal lewat CSS (*reserved space / placeholder / skeleton*) dengan dimensi yang pasti untuk keping kategori dan banner promo, sehingga saat data promo masuk, elemen hanya mengisi ruang yang telah disiapkan tanpa mendorong elemen lain.
- **Prediksi terukur:**
  Setelah perbaikan penuh, CLS pada skenario S0 diprediksi turun drastis dari 0,475 menjadi <= 0,1 (bahkan mendekati 0,000).
  Efek samping: Ruang banner akan tampak kosong atau berbentuk kerangka skeleton selama 1,8 detik pertama sebelum data promo tiba.
- **Alternatif yang dipertimbangkan dan alasan tidak dipilih:**
  - Menghapus banner promo: Dilarang oleh aturan main (poin 4).
  - Memindahkan banner ke footer atau memakai fixed overlay popup: Tidak dipilih karena merusak tujuan bisnis promo Harbolnas dan mengganggu pandangan pengguna di layar mobile.

### Sesudah perbaikan

- **Hash commit perbaikan:** ....
- **Hasil ukur (median 3 kali):** ....
- **Prediksi vs kenyataan:** ....
- **Efek samping yang muncul:** ....
