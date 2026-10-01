# Log prediksi

Aturan: satu entri per masalah. Bagian **Sebelum perbaikan** harus di-commit *sebelum* commit
perbaikannya. Bagian **Sesudah perbaikan** diisi setelah pengukuran ulang. Jangan menyunting
bagian "sebelum" setelah hasilnya diketahui; bila prediksi meleset, jelaskan di bagian "sesudah".

---

## P-05: Pemuatan gambar produk kartu katalog (TK-1081)

**Tiket terkait:** TK-1081 (Skenario S0). 
**Tanggal dan hash commit entri ini:** 4f47e84

### Sebelum perbaikan

- **Yang teramati di trace (baseline):**
  Pada S0 (pemuatan gambar): 1.500 event `ResourceSendRequest` untuk tipe Image (`/img/p/1.svg` sampai `/img/p/1500.svg`) diminta serentak sejak awal halaman dibuka. Semua unduhan selesai dalam waktu 1,1 menit karena antrean koneksi jaringan jenuh (*head-of-line blocking*).
- **Dugaan mekanisme:**
  Pada `public/js/katalog.js`, seluruh 1.500 elemen `<img>` langsung diberi atribut `src` saat kartu dibuat oleh `renderProduk()` tanpa atribut `loading="lazy"`. Browser langsung menembakkan 1.500 request HTTP bersamaan sehingga melampaui batas 6 koneksi paralel HTTP/1.1 per host, membuat gambar yang tampak di viewport tertahan antrean panjang.
  Pipeline yang dicurigai:
  `JavaScript (DOM creation) → Network Request Queue (1.500 concurrent images) → Resource Loading`.
- **Rencana perubahan:**
  Menambahkan atribut native `loading="lazy"` dan `decoding="async"` pada elemen `<img>` kartu produk di `public/js/katalog.js`, serta memastikan kontainer media memiliki rasio aspek tetap (`aspect-ratio: 1 / 1`) di `public/css/toko.css`.
- **Prediksi terukur:**
  Permintaan gambar awal dalam 10 detik pertama (S0) diprediksi turun drastis dari 1.500 menjadi puluhan (sebanding dengan jumlah kartu yang tampak di viewport, sekitar 12–24 request). Waktu tampil gambar pertama berkurang signifikan.
  Efek samping: Gambar produk yang jauh di bawah baru mulai dimuat saat pengguna menggulir mendekatinya.
- **Alternatif yang dipertimbangkan dan alasan tidak dipilih:**
  - Menggunakan library virtual scrolling pihak ketiga: Tidak dipilih karena aturan tugas melarang library/framework eksternal.
  - Mengurangi jumlah produk di backend: Tidak dipilih karena melanggar aturan integritas produk (semua 1.500 produk harus tetap ada).

### Sesudah perbaikan

- **Hash commit perbaikan:** ....
- **Hasil ukur (median 3 kali):** ....
- **Prediksi vs kenyataan:** ....
- **Efek samping yang muncul:** ....

## P-07: Pencegahan layout shift pada pemuatan awal

**Tiket terkait:** TK-1078 (Skenario S0)
**Tanggal dan hash commit entri ini:** 4f47e84

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
