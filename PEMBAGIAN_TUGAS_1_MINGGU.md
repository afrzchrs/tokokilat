# 🚀 Rencana Kerja & Pembagian Tugas Tim (Sprint 1 Minggu)
> **Proyek:** Operasi Penyelamatan Flash Sale 12.12 TokoKilat  
> **Target:** Selesai dalam 7 Hari (Pengerjaan Efektif Tim 3–4 Orang)  
> **Dokumen Induk:** [TUGAS.md](file:///d:/College/semester%205/Pengembangan%20Web/P/pertemuan%203/tokokilat/TUGAS.md)

---

## 📌 1. Pembagian Peran & Tanggung Jawab Anggota

### Skenario Tim 4 Orang (Ideal)
* **Anggota 1 — Interaction & Transaction Lead**
  * **Tiket:** 
    * `TK-1041` (Input cari macet/lag — Skenario S1)
    * `TK-1044` (Klik "+ Keranjang" tanpa reaksi visual — Skenario S2)
    * `TK-1052` (Klik "Beli sekarang" 3x timbul 3 tagihan — Skenario S3)
  * **Berkas:** [`public/js/pencarian.js`](file:///d:/College/semester%205/Pengembangan%20Web/P/pertemuan%203/tokokilat/public/js/pencarian.js), [`public/js/keranjang.js`](file:///d:/College/semester%205/Pengembangan%20Web/P/pertemuan%203/tokokilat/public/js/keranjang.js)
  * **Luaran Khusus:** Pengarsipan trace S1–S3, pengawalan alur commit Git & PR.

* **Anggota 2 — Event Loop & CPU-Bound Lead**
  * **Tiket:**
    * `TK-1057` (Hitung voucher KILAT1212 membekukan UI — Skenario S4)
    * Verifikasi Dugaan Rudi #1, #3, #4 (Loop O(n²), Bubble sort, dan async palsu).
  * **Berkas:** [`public/js/harga-promo.js`](file:///d:/College/semester%205/Pengembangan%20Web/P/pertemuan%203/tokokilat/public/js/harga-promo.js), [`public/js/kategori.js`](file:///d:/College/semester%205/Pengembangan%20Web/P/pertemuan%203/tokokilat/public/js/kategori.js), [`public/js/util.js`](file:///d:/College/semester%205/Pengembangan%20Web/P/pertemuan%203/tokokilat/public/js/util.js)
  * **Luaran Khusus:** Penanggung jawab dokumen [laporan/AUDIT-AI.md](file:///d:/College/semester%205/Pengembangan%20Web/P/pertemuan%203/tokokilat/laporan/AUDIT-AI.md) & trace S4.

* **Anggota 3 — Rendering Pipeline & Compositor Lead**
  * **Tiket:**
    * `TK-1063` (Scroll produk jank / patah-patah — Skenario S5)
    * `TK-1070` (HP panas & boros baterai saat idle — Skenario S6)
  * **Berkas:** [`public/js/gulir.js`](file:///d:/College/semester%205/Pengembangan%20Web/P/pertemuan%203/tokokilat/public/js/gulir.js), [`public/js/promo.js`](file:///d:/College/semester%205/Pengembangan%20Web/P/pertemuan%203/tokokilat/public/js/promo.js)
  * **Luaran Khusus:** Perekaman & editing **Video Demo** (maks. 3 menit, CPU 4x slowdown) & trace S5–S6.

* **Anggota 4 — Visual Stability & Network Lead**
  * **Tiket:**
    * `TK-1078` (Layout shift loncat ke bawah / CLS — Skenario S0)
    * `TK-1081` (Gambar lambat / request ribuan gambar — Skenario S0)
    * Verifikasi Dugaan Rudi #2 & #5 (API backend & Vendor SDK).
  * **Berkas:** [`public/js/katalog.js`](file:///d:/College/semester%205/Pengembangan%20Web/P/pertemuan%203/tokokilat/public/js/katalog.js), CSS layout, HTML.
  * **Luaran Khusus:** Koordinator penggabungan dokumen [laporan/LAPORAN.md](file:///d:/College/semester%205/Pengembangan%20Web/P/pertemuan%203/tokokilat/laporan/LAPORAN.md) & trace S0.

---

### Skenario Tim 3 Orang
* **Anggota 1:** Tangani `TK-1041`, `TK-1044`, `TK-1052` + Video Demo.
* **Anggota 2:** Tangani `TK-1057` + Evaluasi 5 Dugaan Rudi + [laporan/AUDIT-AI.md](file:///d:/College/semester%205/Pengembangan%20Web/P/pertemuan%203/tokokilat/laporan/AUDIT-AI.md).
* **Anggota 3:** Tangani `TK-1063`, `TK-1070`, `TK-1078`, `TK-1081` + Koordinator [laporan/LAPORAN.md](file:///d:/College/semester%205/Pengembangan%20Web/P/pertemuan%203/tokokilat/laporan/LAPORAN.md).

---

## 📅 2. Jadwal Harian (Sprint 7 Hari)

```mermaid
gantt
    title Jadwal Kerja 1 Minggu TokoKilat
    dateFormat  YYYY-MM-DD
    section Baseline & Riset
    Hari 1: Setup, Baseline S0-S6, Trace Awal       :done,    h1, 2026-09-26, 1d
    Hari 2: Commit PREDIKSI.md & Rancang Solusi    :active,  h2, 2026-09-27, 1d
    section Coding Perbaikan
    Hari 3: Perbaikan Batch 1 (Input & Keranjang)   :         h3, 2026-09-28, 1d
    Hari 4: Perbaikan Batch 2 (Voucher, Scroll, CLS):         h4, 2026-09-29, 1d
    section Pengujian & Luaran
    Hari 5: Ukur Ulang, Trace Sesudah, Audit AI     :         h5, 2026-09-30, 1d
    Hari 6: Finalisasi LAPORAN.md & Rekam Video     :         h6, 2026-10-01, 1d
    Hari 7: Simulasi Live Debugging (Persiapan 40%) :         h7, 2026-10-02, 1d
```

### 🗓️ Hari 1: Setup Lingkungan & Baseline Measurement (Diagnosis)
- [ ] Tentukan **satu laptop referensi** dalam tim agar spesifikasi pengukuran tidak berubah.
- [ ] Setup Chrome: Incognito, Viewport `412 x 915`, CPU Throttling `4x slowdown`, jaringan tanpa throttling.
- [ ] Buka `http://localhost:3000/?ukur=1`, refresh 1 kali agar localStorage terisi.
- [ ] Jalankan Skenario Baku (S0 s.d. S6) sebanyak **3 kali** (ambil nilai **median**).
- [ ] Ekspor file trace awal dari panel DevTools Performance, simpan di `laporan/trace/sebelum/`.
- [ ] Tangkap layar Flame Chart beranotasi untuk setiap tiket sebagai bukti diagnosis.
- [ ] Uji 5 dugaan Rudi: catat mana yang benar-benar membebani dan mana yang mitos.

### 🗓️ Hari 2: Tulis Hipotesis & Git Commit PREDIKSI.md
> ⚠️ **ATURAN KRITIS DARI DOSEN:** File `laporan/PREDIKSI.md` harus di-commit ke Git **SEBELUM** menulis satu baris pun kode perbaikan!
- [ ] Setiap anggota menuliskan hipotesis tiketnya di [laporan/PREDIKSI.md](file:///d:/College/semester%205/Pengembangan%20Web/P/pertemuan%203/tokokilat/laporan/PREDIKSI.md):
  - Apa dugaan akar masalahnya (apakah task terlalu lama, microtask, atau forced reflow)?
  - Apa teknik perbaikan yang dipilih?
  - Berapa perkiraan metrik setelah perbaikan?
- [ ] Lakukan commit Git: `git commit -m "docs: log prediksi perbaikan awal tiket"`

### 🗓️ Hari 3: Eksekusi Perbaikan Batch 1 (Interaktivitas & Transaksi)
- [ ] **TK-1041 (Anggota 1):** Terapkan debouncing/throttling pada input pencarian, hindari query DOM berulang di setiap ketikan keyboard.
- [ ] **TK-1044 (Anggota 1):** Berikan immediate feedback visual (optimistic UI) saat tombol "+ Keranjang" ditekan, cegah long task.
- [ ] **TK-1052 (Anggota 1):** Tambahkan debounce/disable/idempotency guard pada tombol "Beli sekarang" agar 3 klik cepat hanya menghasilkan tepat 1 pesanan.
- [ ] Uji cepat apakah interaksi sudah responsif tanpa error. Lakukan commit Git bertahap.

### 🗓️ Hari 4: Eksekusi Perbaikan Batch 2 (Voucher, Scroll, Idle, & CLS)
- [ ] **TK-1057 (Anggota 2):** Pecah komputasi voucher menjadi potongan kecil (chunking menggunakan `scheduler.yield()`, `requestAnimationFrame`, atau `setTimeout`) agar main thread sempat merender progres persentase dan merespons input.
- [ ] **TK-1063 (Anggota 3):** Hilangkan forced reflow / layout thrashing pada event scroll, pastikan event listener pasif (`passive: true`).
- [ ] **TK-1070 (Anggota 3):** Ubah animasi teks berjalan/timer agar tidak memicu Layout/Paint di main thread. Pindahkan ke CSS `transform` (Compositor thread) atau hentikan interval yang tidak perlu saat idle.
- [ ] **TK-1078 (Anggota 4):** Berikan atribut `width`/`height` atau CSS `aspect-ratio` eksplisit pada banner/iklan promo dinamis untuk mengunci CLS <= 0.1.
- [ ] **TK-1081 (Anggota 4):** Terapkan lazy loading pada gambar produk (`loading="lazy"` atau `IntersectionObserver`) agar browser tidak meminta ribuan gambar sekaligus di awal.

### 🗓️ Hari 5: Pengukuran Ulang, Trace Sesudah, & Audit AI
- [ ] Jalankan kembali protokol pengujian S0 s.d. S6 (3x repetisi, ambil median pada CPU 4x slowdown).
- [ ] Ekspor file trace sesudah perbaikan ke `laporan/trace/sesudah/`.
- [ ] Simpan tangkapan layar flame chart yang sudah bersih dari long task / jank.
- [ ] **Tugas Audit AI (Anggota 2):**
  - Minta AI (ChatGPT/Gemini/Claude) memberikan solusi perbaikan untuk minimal 2 tiket.
  - Uji solusi AI tersebut. Temukan **minimal 2 kelemahan/kesalahan** (misal: AI menyarankan algoritma baru padahal masalah aslinya ada di forced reflow, atau saran AI menimbulkan regresi).
  - Tuliskan bukti analisisnya di [laporan/AUDIT-AI.md](file:///d:/College/semester%205/Pengembangan%20Web/P/pertemuan%203/tokokilat/laporan/AUDIT-AI.md).

### 🗓️ Hari 6: Finalisasi Laporan & Perekaman Video Demo
- [ ] **Penyusunan Laporan (Anggota 4 memimpin, semua berkontribusi):**
  - Isi tabel perbandingan sebelum vs sesudah di [laporan/LAPORAN.md](file:///d:/College/semester%205/Pengembangan%20Web/P/pertemuan%203/tokokilat/laporan/LAPORAN.md).
  - Tulis analisis temuan T-01 s.d. T-08 lengkap dengan kaitan ke standar **ISO/IEC 25010** (*Performance efficiency* & *Interaction capability*).
  - Tulis evaluasi 5 dugaan Rudi di Bab 5.
  - Pastikan total halaman tidak lebih dari 6 halaman.
- [ ] **Pembuatan Video Demo (Anggota 3):**
  - Durasi maksimal 3 menit.
  - Rekam dengan mode CPU 4x slowdown.
  - Tampilkan komparasi *side-by-side* atau sebelum vs sesudah untuk Skenario S1 s.d. S5.

### 🗓️ Hari 7: Simulasi Sesi Langsung (Persiapan Ujian 40%) & Pengumpulan
- [ ] Lakukan *peer-review* di dalam tim: setiap anggota bergantian membuka DevTools tanpa melihat catatan untuk menjelaskan:
  - *"Apa yang sedang terjadi di Flame Chart ini?"*
  - *"Di tahap mana waktu terbuang (Task, Microtask, Style, Layout, Paint, Composite)?"*
  - *"Mengapa solusi yang kita buat bisa memperbaikinya?"*
- [ ] Cek kepatuhan aturan main:
  - [ ] Berkas `server.js`, `public/vendor/`, `public/alat/` TIDAK diubah.
  - [ ] Tidak menggunakan library/framework luar (Pure Vanilla Web APIs).
  - [ ] Semua produk dan fitur bisnis tetap utuh.
- [ ] Push seluruh commit Git dan persiapkan pengumpulan link repositori.

---

## 🎯 3. Target Angka Kinerja (Acuan Pengujian)

| Skenario | Terkait Tiket | Metrik | Target Mutlak |
|---|---|---|---|
| **S0** | TK-1078, TK-1081 | CLS & Request Gambar | CLS <= 0,1; Request gambar awal sebanding kartu yang terlihat di layar |
| **S1** | TK-1041 | INP & Long Task saat cari | INP <= 200 ms; Long task <= 100 ms |
| **S2** | TK-1044 | INP saat tekan Tambah Keranjang | INP <= 200 ms |
| **S3** | TK-1052 | 3 Klik Cepat "Beli sekarang" | Tepat 1 pesanan, tombol terkunci dengan status loading |
| **S4** | TK-1057 | INP & Progres Voucher | Input cari tetap responsif selama kalkulasi; persentase bertahap |
| **S5** | TK-1063 | Frame > 50 ms saat scroll | Maksimal 2 frame dropped per 10 detik |
| **S6** | TK-1070 | Aktivitas saat diam (idle) | Aktivitas main thread mendekati 0; animasi di compositor |

---

## 📂 4. Daftar Berkas Luaran Wajib
1. **Repositori Git:** Riwayat commit rapi dengan bukti bahwa `PREDIKSI.md` di-commit lebih awal.
2. [laporan/PREDIKSI.md](file:///d:/College/semester%205/Pengembangan%20Web/P/pertemuan%203/tokokilat/laporan/PREDIKSI.md): Log hipotesis awal sebelum perbaikan.
3. [laporan/LAPORAN.md](file:///d:/College/semester%205/Pengembangan%20Web/P/pertemuan%203/tokokilat/laporan/LAPORAN.md): Laporan audit performa lengkap (maks. 6 halaman).
4. [laporan/AUDIT-AI.md](file:///d:/College/semester%205/Pengembangan%20Web/P/pertemuan%203/tokokilat/laporan/AUDIT-AI.md): Analisis kritis terhadap 2 usulan salah dari AI.
5. **Folder Trace (`laporan/trace/`):** Minimal 3 pasang trace `.json` / `.json.gz` sebelum dan sesudah.
6. **Video Demo:** Maksimal 3 menit (CPU 4x slowdown, menunjukkan S1–S5).
