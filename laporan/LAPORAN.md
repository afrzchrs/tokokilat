# Laporan audit performa dan interaksi TokoKilat

Tim: ....  Anggota: Devi Maulani (Fokus: Tiket TK-1044 / S2 & TK-1052 / S3)  Tanggal: 16 Oktober 2026
Panjang maksimal setara 6 halaman (tidak termasuk lampiran gambar).

---

## 1. Ringkasan eksekutif (maks. 150 kata)

Di halaman flash sale TokoKilat, kami menemukan dua masalah utama saat pengguna bertransaksi:

1. Tombol "+ Keranjang" bikin layar HP sempat nge-freeze karena SDK analitik vendor menjalankan perulangan hash 2 juta kali dan membaca 9.000 data riwayat di main thread. Pengguna mengira tombolnya macet, lalu menekannya berulang kali sampai isi keranjang melonjak.
2. Tombol "Beli sekarang" tidak punya status loading dan pengaman klik, sehingga klik berturut-turut menghasilkan pesanan ganda (3 pesanan dari 3 klik).

Kami memperbaikinya dengan memindahkan eksekusi SDK analitik ke background thread (Web Worker), menyimpan riwayat di memori (cache), serta menambahkan status "Memproses…" dan pengunci transaksi di tombol beli. Dari hasil uji langsung di laptop, INP tombol keranjang berhasil turun dari 520 ms jadi 81 ms (target <= 200 ms tercapai), dan 3 klik cepat di tombol beli menghasilkan tepat 1 pesanan.

---

## 2. Lingkungan pengukuran

| Item           | Nilai                                                         |
| -------------- | ------------------------------------------------------------- |
| Laptop         | Lenovo Idepad Slim 5i, Intel (R) Core (TM) Ultra 7,16 GB DDRS |
| Sistem operasi | Windows 11 Home (64-bit)                                      |
| Chrome         | `Google Chrome v154.0.8037.922` Incognito, tanpa ekstensi   |
| Viewport       | 412 x 915 (device toolbar)                                    |
| CPU throttling | 4x slowdown                                                   |
| Jumlah produk  | 1.500 (`npm run start:ringan`)                              |
| Pengulangan    | 3 kali per skenario, median                                   |

---

## 3. Hasil sebelum dan sesudah

| Skenario | Metrik                                        | Sebelum (median) | Sesudah (median) | Target                         | Tercapai?    |
| -------- | --------------------------------------------- | ---------------- | ---------------- | ------------------------------ | ------------ |
| S0       | CLS                                           |                  |                  | <= 0,1                         |              |
| S0       | Jumlah permintaan gambar dalam 10 dtk pertama |                  |                  | sebanding dengan yang terlihat |              |
| S1       | INP                                           |                  |                  | <= 200 ms                      |              |
| S1       | Long task terlama                             |                  |                  | <= 100 ms                      |              |
| S2       | INP                                           | 520 ms           | 81 ms            | <= 200 ms                      | ya, tercapai |
| S3       | Jumlah pesanan dari 3 klik                    | 3 pesanan        | 1 pesanan        | 1                              | ya, tercapai |
| S4       | INP / progres tergambar bertahap?             |                  |                  |                                |              |
| S5       | Frame > 50 ms per 10 dtk                      |                  |                  | <= 2                           |              |
| S6       | Frame > 50 ms per 10 dtk                      |                  |                  | <= 2                           |              |

---

## 4. Temuan

### T-01: Tombol "+ Keranjang" bikin main thread freeze akibat looping hash SDK analitik dan parsing riwayat besar

- **Tiket terkait:** TK-1044 (Pak Anton: *"Pencet '+ Keranjang' tidak ada reaksi apa-apa. Saya pencet lagi, tahu-tahu isi keranjang sudah 3"*).
- **Gejala bagi pengguna:** Pas tombol diklik, layar sempat diam dan tidak ada respon sama sekali. Toast notifikasi "Ditambahkan ke keranjang" dan angka di keranjang baru muncul setelah jeda freeze selesai. Karena dikira tidak merespons, pengguna menekan tombol berkali-kali sampai keranjang bertambah 3.
- **Bukti (tersimpan di repositori GitHub pada folder `laporan/trace/`):**
  - Pada pengujian baseline (`laporan/trace/baseline/s2/`), rekaman DevTools menunjukkan interaksi klik berwarna merah dengan INP tinggi:
    - Percobaan 1: 528 ms (Long Task 410 ms) — berkas `percobaan 1/perulangan1-sebelum.png`
    - Percobaan 2: 448 ms (Long Task 266 ms) — berkas `percobaan 2/perulangan2-sebelum.png`
    - Percobaan 3: 520 ms (Long Task 283 ms) — berkas `percobaan 3/perulangan3-sebelum.png`
    - **Median sebelum:** **520 ms**.
  - Dari tab Bottom-Up dan flame chart, waktu CPU habis di fungsi `k` dan loop `f` milik `lacak.min.js`, ditambah proses `JSON.parse` dan `JSON.stringify`.
  - Pada pengujian sesudah perbaikan (`laporan/trace/sesudah/s2/`), balok interaksi berubah jadi hijau dan tipis:
    - Percobaan 1: 171 ms — berkas `percobaan 1/perulangan1-sesudah.png`
    - Percobaan 2: 81 ms — berkas `percobaan 2/perulangan2-sesudah.png`
    - Percobaan 3: 55 ms — berkas `percobaan 3/perulangan3-sesudah.png`
    - **Median sesudah:** **81 ms**.
- **Akar masalah dan mekanismenya:**
  1. Waktu tombol diklik, fungsi `tambahKeKeranjang` memanggil `bacaRiwayat()` yang mem-parse ~9.000 riwayat (~1 MB) dari `localStorage` setiap kali tombol ditekan.
  2. Seluruh 9.000 riwayat itu ikut dikirim ke `window.Lacak.kirim`.
  3. Di dalam `lacak.min.js`, SDK menghitung hash fingerprint dengan loop 2 juta iterasi dan hash payload string 12 x panjang karakter.
  4. Karena semua proses ini jalan sinkron di main thread, browser tidak sempat merender toast maupun update badge keranjang (*rendering opportunity* tertunda sampai task selesai).
- **Kualitas yang terdampak (ISO/IEC 25010):**
  - *Performance Efficiency (Time behaviour):* Waktu respon klik jadi lambat karena CPU tertahan oleh perhitungan hash sinkron.
  - *Interaction Capability (Operability & User error protection):* Tombol terasa macet dan membuat pengguna tidak sengaja memasukkan barang berulang kali.
- **Perbaikan:**
  - Simpan riwayat di memori (`riwayatMemori`) setelah pembacaan pertama, dan tunda penulisan ke `localStorage` pakai debounce 400 ms.
  - Ringkas data analitik yang dikirim: hanya kirim info penting produk, tidak perlu membawa seluruh data riwayat.
  - Pindahkan SDK vendor ke Web Worker lewat Blob di `util.js` dan tunda pemanggilan ke macrotask via `setTimeout(..., 0)` (`kirimTertunda`).
- **Trade-off:** Penyimpanan riwayat ke `localStorage` ada jeda 400 ms jika tab ditutup mendadak, tapi data keranjang belanja tetap aman karena langsung disimpan saat itu juga.
- **Hasil:** INP turun dari **520 ms** jadi **81 ms** (target <= 200 ms tercapai).

---

### T-02: Pesanan dobel saat klik cepat di tombol "Beli sekarang" karena belum ada penanganan konkurensi

- **Tiket terkait:** TK-1052 (Mbak Sari: *"SAYA CUMA BELI SATU. Kenapa tagihannya tiga pesanan?? Saya pencet 'Beli sekarang', diam saja, ya saya pencet lagi. Minta refund"*).
- **Gejala bagi pengguna:** Waktu tombol "Beli sekarang" diklik, layar kelihatan diam tanpa respon selama beberapa ratus milidetik karena menunggu server. Pengguna mengira kliknya tidak masuk lalu mengklik lagi, akhirnya tagihan keluar 3 pesanan.
- **Bukti (tersimpan di repositori GitHub pada folder `laporan/trace/`):**
  - Pada baseline (`laporan/trace/baseline/s3/`):
    - Di tangkapan layar `hasil_console_sebelum.png`, terminal server mencatat setiap 3 klik cepat menghasilkan 3 pesanan terpisah untuk produk yang sama (`TK-00001`, `TK-00002`, `TK-00003`).
    - Di flame chart `perulangan1-sebelum.png`, track Network memperlihatkan 3 request `POST /api/pesanan` berjalan secara paralel karena tombol tetap aktif.
  - Pada sesudah perbaikan (`laporan/trace/sesudah/s3/`):
    - Di tangkapan layar `hasil_console_sesudah.png`, terminal server membuktikan bahwa saat tombol diklik 3 kali dengan cepat, server hanya memproses **tepat 1 pesanan saja** per transaksi.
- **Akar masalah dan mekanismenya:**
  1. Fungsi `beliSekarang` berjalan asinkron (`async`). Saat kode menunggu `await fetch('/api/pesanan')`, kendali kembali ke browser.
  2. Selama menunggu balasan server (sekitar 300–500 ms), tombol tetap aktif (`disabled = false`) dan teksnya tetap "Beli sekarang".
  3. Tidak ada pengaman transaksi ganda (*concurrency guard*), jadi klik kedua dan ketiga kembali memicu `fetch` baru. Akibatnya terjadi race condition dan server memproses 3 pesanan sekaligus.
- **Kualitas yang terdampak (ISO/IEC 25010):**
  - *Interaction Capability (User error protection):* Sistem gagal mencegah klik berulang saat transaksi sedang berjalan.
  - *Interaction Capability (Self-descriptiveness):* Tidak ada tanda atau indikator bahwa pesanan sedang diproses.
- **Perbaikan:**
  - Pasang guard pakai `Set` `sedangDipesan`. Kalau ID produk masih ada di dalam Set, klik berikutnya langsung diabaikan (`return`).
  - Begitu tombol diklik pertama kali, langsung ubah `tombol.disabled = true` dan ganti teksnya jadi `'Memproses…'`.
  - Membungkus alur pemesanan dengan `try...finally` supaya tombol aktif kembali dan status di Set dibersihkan setelah selesai.
  - Kirim analitik lewat worker via `kirimTertunda`.
- **Trade-off:** Tombol dinonaktifkan sementara selama 1,5 detik untuk produk yang sama setelah berhasil dibeli untuk mencegah spam klik.
- **Hasil:** Dari 3 klik cepat, jumlah pesanan yang terbentuk di server turun dari **3 pesanan** jadi **tepat 1 pesanan**.

---

## 5. Dugaan yang ternyata keliru

1. **Dugaan bahwa penulisan `localStorage` yang bikin tombol lambat:** Awalnya kami menduga operasi simpan ke `localStorage` yang bikin tombol keranjang macet. Ternyata setelah dicek di DevTools, `localStorage.setItem` cuma memakan waktu sekitar 15 ms. Biang kerok utamanya adalah perulangan hash 2 juta kali di `lacak.min.js` yang terpicu karena data riwayat 9.000 entri ikut dikirim.
2. **Dugaan bahwa fungsi `async` otomatis aman (catatan Rudi #4):**
   Rudi menduga fungsi asinkron tidak akan memblokir dan sudah aman. Faktanya, fungsi `async` pada tombol beli tanpa adanya pengunci transaksi justru memicu *race condition* saat ada jeda jaringan, sehingga pesanan ganda malah terjadi.

---

## 6. Yang belum beres dan rekomendasi

1. **Rekomendasi untuk tim backend:**Pencegahan pesanan ganda saat ini baru ditangani di sisi frontend. Sebaiknya tim backend menambahkan **Idempotency Key** pada endpoint `POST /api/pesanan` agar server punya pengaman transaksi dobel sendiri dan bisa menolak request yang sama jika ada gangguan jaringan.
2. **Rekomendasi untuk vendor SDK analitik:**
   Perulangan hash fingerprint 2 juta iterasi di `lacak.min.js` sebaiknya dihilangkan dari thread utama atau disediakan opsi resmi untuk dijalankan di Web Worker bawaan.

---

## 7. Pernyataan penggunaan AI dan pembagian kerja

- **Penggunaan AI:** Penggunaan ai membantu perbaikan code dan melengkapi laporan AUDIT-AI.md . Semua saran kode selalu di uji dulu dan buktikan lewat DevTools. secara lebih lengkapnya catatan pengujian usulan AI didokumentasikan di berkas `AUDIT-AI.md`.
- **Pembagian Kerja:**
  - **Devi Maulani (Penulis – Tanggung Jawab Skenario S2 & S3):**
    - Mencari akar masalah lewat DevTools dan menyusun hipotesis sebelum perbaikan (P-01 dan P-02) pada `PREDIKSI.md`.
    - Memperbaiki S2 (TK-1044) pada tombol keranjang dengan memindahkan proses *hashing* SDK ke Web Worker via Blob, memangkas *payload* analitik, serta menerapkan *caching* memori dan *debounce* riwayat `localStorage`.
    - Memperbaiki S3 (TK-1052) pada tombol beli agar tidak terjadi pesanan dobel memakai *guard* `Set sedangDipesan`, menonaktifkan tombol ("Memproses…"), dan proteksi blok `try...finally`.
    - Mengukur ulang performa hingga target tercapai (INP 520 ms turun ke **81 ms**; 3 klik cepat tervalidasi jadi tepat **1 pesanan**) dan menyusun analisis *trade-off*.
    - Membantah catatan keliru Rudi (#4 fungsi *async* otomatis aman dan #5 SDK vendor tidak bisa dioptimasi) serta membuktikan lewat *profiler* bahwa `localStorage` bukan penyebab utama *freeze*.
    - Mendokumentasikan analisis temuan T-01 dan T-02 pada `LAPORAN.md` serta menuliskan evaluasi usulan perbaikan AI di `AUDIT-AI.md`.
