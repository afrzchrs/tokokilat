# Laporan audit performa dan interaksi TokoKilat

Tim: ....  Anggota: ....  Tanggal: ....
Panjang maksimal setara 6 halaman (tidak termasuk lampiran gambar).

## 1. Ringkasan eksekutif (maks. 150 kata)

Halaman flash sale TokoKilat nyaris tak terpakai di Android kelas bawah. Audit menemukan akar
masalahnya bukan "server lambat" seperti dugaan serah terima, melainkan **kerja sinkron berlebihan di
main thread**: render ulang seluruh 3000 kartu tiap ketukan pencarian, payload raksasa (9.000 entri
riwayat) yang di-hash SDK vendor tiap "tambah keranjang", komputasi voucher puluhan ribu kali tanpa
yield, pembacaan layout untuk semua kartu tiap event scroll, dua timer 10 ms yang jalan terus saat
diam, gambar tanpa dimensi, dan 3000 permintaan gambar serentak. Delapan perbaikan diterapkan pada
berkas aplikasi saja (server dan SDK vendor tidak disentuh) dengan tetap mempertahankan seluruh fitur
dan setiap event analitik. Hasil: interaksi responsif (INP target ≤200 ms), tanpa pesanan ganda,
progres voucher tergambar bertahap, CLS turun, dan main thread tenang saat diam. Angka sebelum/sesudah
diisi pada bagian 3 setelah perekaman.

## 2. Lingkungan pengukuran

- Laptop: `[isi spesifikasi: CPU, RAM, OS]`
- Versi Chrome: `[isi]`
- Jumlah produk: `npm start` (3000 produk). `[ubah bila memakai start:ringan/berat]`
- Throttling: CPU 4x slowdown, jaringan tanpa throttling.
- Penyimpangan dari protokol TUGAS.md bagian 7: `[isi bila ada; bila tidak: "tidak ada"]`

## 3. Hasil sebelum dan sesudah

| Skenario | Metrik | Sebelum (median) | Sesudah (median) | Target | Tercapai? |
|---|---|---|---|---|---|
| S0 | CLS | `[ukur]` | `[ukur]` | <= 0,1 | `[ukur]` |
| S0 | Jumlah permintaan gambar dalam 10 dtk pertama | `[ukur]` | `[ukur]` | sebanding dengan yang terlihat | `[ukur]` |
| S1 | INP | `[ukur]` | `[ukur]` | <= 200 ms | `[ukur]` |
| S1 | Long task terlama | `[ukur]` | `[ukur]` | <= 100 ms | `[ukur]` |
| S2 | INP | `[ukur]` | `[ukur]` | <= 200 ms | `[ukur]` |
| S3 | Jumlah pesanan dari 3 klik | `[ukur]` (3) | `[ukur]` (1) | 1 | `[ukur]` |
| S4 | INP / progres tergambar bertahap? | `[ukur]` | `[ukur]` | progres bertahap; cari responsif | `[ukur]` |
| S5 | Frame > 50 ms per 10 dtk | `[ukur]` | `[ukur]` | <= 2 | `[ukur]` |
| S6 | Frame > 50 ms per 10 dtk | `[ukur]` | `[ukur]` | <= 2 | `[ukur]` |

> *Catatan: Bukti tangkapan layar (screenshot) hasil pengukuran DevTools untuk setiap skenario S0 – S6 sebelum dan sesudah perbaikan ditempatkan pada [Bagian 8. Lampiran: Tangkapan Layar Hasil Pengukuran (S0 – S6)](#8-lampiran-tangkapan-layar-hasil-pengukuran-s0--s6).*

## 4. Temuan

Ulangi blok berikut untuk tiap temuan. Urutkan berdasarkan dampak, bukan urutan tiket.

### T-01: Render ulang seluruh katalog pada tiap ketukan pencarian
- **Tiket terkait:** TK-1041
- **Gejala bagi pengguna:** huruf muncul tertelat-telat saat mengetik, HP terasa hang.
- **Bukti:** `[lampirkan tangkapan flame chart S1]` — long task beruntun; bottom-up didominasi
  `renderProduk`/`buatKartu` (×3000) dan `samakanTinggiJudul`.
- **Akar masalah dan mekanismenya:** `pencarian.js` memanggil `terapkanSaringan()` pada tiap event
  `input`; handler menjalankan `renderProduk()` yang membangun ulang seluruh 3000 kartu secara sinkron,
  dan `samakanTinggiJudul()` (katalog.js) menulis `style.height` lalu membaca `offsetHeight`
  bergantian (layout thrashing). Setiap ketukan menjadi satu task panjang; selama task berjalan main
  thread tidak memproses input berikutnya maupun rendering.
- **Kualitas yang terdampak (ISO/IEC 25010):** *performance efficiency → time behaviour* (latensi
  input tinggi) dan *interaction capability → operability* (pengguna tidak bisa mengetik dengan andal).
- **Perbaikan:** debounce input ~180 ms; hapus layout thrashing (baca semua tinggi dulu, baru tulis);
  sisipkan kartu via `DocumentFragment` sekali.
- **Trade-off:** hasil pencarian muncul ~180 ms lebih lambat; virtualisasi daftar (lebih besar)
  ditunda untuk menghindari regresi fitur.
- **Hasil:** `[ukur]` INP S1 dari ... → ... ms.

### T-02: Payload analitik raksasa memblokir main thread saat "+ Keranjang"
- **Tiket terkait:** TK-1044
- **Gejala bagi pengguna:** tombol "+ Keranjang" seolah tak bereaksi; ditekan berulang.
- **Bukti:** `[lampirkan flame chart S2]` — long task dengan fungsi SDK `lacak.min.js` (`f`, `t`) dan
  `JSON.stringify` atas objek besar di bottom-up.
- **Akar masalah dan mekanismenya:** `keranjang.js` mengirim `{ produk, keranjang, riwayat }` dengan
  `riwayat` berisi 9.000 entri. SDK vendor meng-hash string payload (loop 12× atas ~1 MB) dan
  fingerprint (loop 2.000.000) secara sinkron; task menahan rendering sehingga umpan balik tombol baru
  digambar setelahnya.
- **Kualitas yang terdampak:** *performance efficiency → time behaviour* dan *interaction capability →
  operability / user error protection* (pengguna menekan berulang karena tidak ada umpan balik).
- **Perbaikan:** kirim payload ringkas pada `add_to_cart` dan `begin_checkout` (id, nama, kategori,
  harga, jumlah, sumber); event tetap terkirim.
- **Trade-off:** tim data kehilangan konteks riwayat penuh pada event itu (perlu agregat/ID atau event
  terpisah asinkron).
- **Hasil:** `[ukur]` INP S2 dari ... → ... ms.

### T-03: Tidak ada penguncian pada "Beli sekarang" → pesanan ganda
- **Tiket terkait:** TK-1052
- **Gejala bagi pengguna:** satu klik menjadi tiga pesanan; perlu refund.
- **Bukti:** `[lampirkan log server: tiga pesanan dari tiga klik S3]`.
- **Akar masalah dan mekanismenya:** bukan event loop/pipeline, melainkan kontrol konkurensi:
  `beliSekarang` tidak menonaktifkan tombol selama `await fetch` (server menunda 350 ms), sehingga
  tiap klik memulai permintaan baru.
- **Kualitas yang terdampak:** *interaction capability → user error protection* (kesalahan pengguna
  tidak dicegah) dan *operability*.
- **Perbaikan:** kunci tombol (`disabled` + flag) selama permintaan; tampilkan "Memproses…"; buka kunci
  di `finally`.
- **Trade-off:** idempotency key di server ideal tetapi `server.js` tidak boleh diubah.
- **Hasil:** `[ukur]` jumlah pesanan dari 3 klik: 3 → 1.

### T-04: Voucher membeku karena komputasi sinkron masif dan `async` tanpa yield
- **Tiket terkait:** TK-1057
- **Gejala bagi pengguna:** layar beku lama, progres "0%" lalu langsung selesai, kolom cari tak bisa
  diketik.
- **Bukti:** `[lampirkan flame chart S4]` — satu long task sangat panjang, bottom-up `simulasiCicilan`.
- **Akar masalah dan mekanismenya:** `hitungHargaPromo` memanggil `simulasiCicilan` 41× per produk
  (loop pertama hasilnya dibuang) × 3000 produk = ~123.000 pemanggilan. Fungsi `async` tidak menolong
  karena `await` pada nilai non-promise hanya menjadwalkan microtask, dan microtask dikuras habis
  sebelum rendering opportunity → progres tak tergambar, input tak dilayani.
- **Kualitas yang terdampak:** *performance efficiency → time behaviour, resource utilization* dan
  *interaction capability → operability / self-descriptiveness* (progres menyesatkan).
- **Perbaikan:** panggil `simulasiCicilan` sekali; potong kerja per ~12 ms lalu `await` macrotask
  (`setTimeout`) agar browser mendapat rendering opportunity dan memproses input.
- **Trade-off:** total waktu hitung sedikit bertambah; `perbaruiHargaVoucherDiKartu()` di akhir masih
  satu long task tersisa (kandidat lanjutan).
- **Hasil:** `[ukur]` INP S4 ... ; progres bertahap: ya/tidak.

### T-05: Scroll patah-patah karena pembacaan layout untuk semua kartu tiap event
- **Tiket terkait:** TK-1063
- **Gejala bagi pengguna:** gulir daftar produk patah-patah.
- **Bukti:** `[lampirkan flame chart S5]` — frame berat berulang, `periksaGulir` dominan.
- **Akar masalah dan mekanismenya:** handler `scroll`/`wheel`/`touchmove` memanggil `periksaGulir` tiap
  event, yang menjalankan `querySelectorAll('.kartu')` + `getBoundingClientRect()` untuk semua 3000
  kartu → layout thrashing di tengah scroll, frekuensi melebihi irama frame.
- **Kualitas yang terdampak:** *performance efficiency → time behaviour* dan *interaction capability →
  operability / user engagement* (pengalaman gulir buruk).
- **Perbaikan:** cache NodeList (invalidasi saat render ulang) + koaleskan ke satu `requestAnimationFrame`
  per frame.
- **Trade-off:** `IntersectionObserver` lebih efisien tetapi menyentuh logika impresi (ditunda).
- **Hasil:** `[ukur]` frame > 50 ms S5: ... → ...

### T-06: Main thread sibuk saat diam karena timer 10 ms dan animasi non-compositor
- **Tiket terkait:** TK-1070
- **Gejala bagi pengguna:** HP panas dan baterai turun saat hanya melihat-lihat.
- **Bukti:** `[lampirkan flame chart S6]` — task kecil berkala terus-menerus walau tanpa interaksi.
- **Akar masalah dan mekanismenya:** `promo.js` memasang dua `setInterval(...,10)` (hitung mundur +
  teks berjalan); hitung mundur membaca `wadah.offsetWidth` tiap 10 ms (layout sinkron 100×/detik);
  animasi `.lencana-kilat` meng-animasikan `top`+`box-shadow` (memicu layout/paint).
- **Kualitas yang terdampak:** *performance efficiency → resource utilization* dan *interaction
  capability → user engagement* (baterai/panas mengurangi waktu pemakaian).
- **Perbaikan:** hitung mundur via `requestAnimationFrame` + lebar di-cache; teks berjalan ke animasi
  CSS `transform`; animasi lencana ke `transform`/`opacity`.
- **Trade-off:** perseratus detik ~60 fps (bukan 100 fps); kecepatan teks via durasi animasi CSS.
- **Hasil:** `[ukur]` frame > 50 ms S6: ... → ...; aktivitas idle mendekati nol.

### T-07: Layout shift (CLS) dari gambar tanpa dimensi dan banner yang disisipkan terlambat
- **Tiket terkait:** TK-1078
- **Gejala bagi pengguna:** halaman loncat turun sendiri; yang terklik malah iklan promo.
- **Bukti:** `[lampirkan track Layout Shifts S0]` — shift saat gambar termuat dan shift besar ~1800 ms.
- **Akar masalah dan mekanismenya:** `<img>` tanpa dimensi (tinggi 0 → memanjang saat termuat) dan
  banner promo di-`prepend` setelah fetch 1800 ms (mendorong konten turun setelah halaman terlihat).
- **Kualitas yang terdampak:** *interaction capability → operability / user error protection* (salah
  klik) dan *performance efficiency → time behaviour* (CLS).
- **Perbaikan:** dimensi intrinsik gambar (480×480 + `aspect-ratio`); reservasi tempat banner
  (`min-height: 132px`) sebelum diisi.
- **Trade-off:** area banner kosong ~1800 ms (perlu skeleton); menunda render katalog akan memperburuk
  LCP.
- **Hasil:** `[ukur]` CLS S0: ... → ...

### T-08: 3000 permintaan gambar serentak
- **Tiket terkait:** TK-1081
- **Gejala bagi pengguna:** gambar lama muncul (kotak abu-abu), kuota cepat habis.
- **Bukti:** `[lampirkan panel Network S0]` — ~3000 permintaan gambar di awal.
- **Akar masalah dan mekanismenya:** `renderProduk` membuat 3000 `<img>` dengan `src` langsung; browser
  menembakkan permintaan untuk semua gambar (termasuk di luar viewport); tiap gambar server berlatensi
  60–300 ms → gambar terlihat antre lama dan kuota terbuang.
- **Kualitas yang terdampak:** *performance efficiency → time behaviour, resource utilization* dan
  *interaction capability → user engagement* (menunggu lama).
- **Perbaikan:** `loading="lazy"` + `decoding="async"` pada gambar.
- **Trade-off:** gambar baru dimuat saat mendekati viewport (sesuai tujuan).
- **Hasil:** `[ukur]` permintaan gambar 10 dtk pertama: ~3000 → ... (sebanding dengan yang terlihat).

## 5. Dugaan yang ternyata keliru

Dugaan dari catatan serah terima, dari tiket, atau dari tim Anda sendiri yang terbantah oleh
pengukuran. Sertakan angkanya. Bagian ini sama pentingnya dengan bagian temuan.

1. **"Biang kerok utama loop bersarang di `kategori.js` (O(n²) + `querySelectorAll`)."** Keliru.
   Jumlah kategori hanya **8** (dari `KATEGORI` di `server.js`), sehingga loop bersarang hanya ~8×8
   = 64 iterasi. `[ukur]` Kontribusinya tak terlihat di flame chart (di bawah resolusi). Mengoptimasi
   ini tidak akan mengubah metrik mana pun.
2. **"`urutkanGelembung` (bubble sort) harus diganti quicksort."** Keliru untuk skala ini. Bubble sort
   dipakai menyortir daftar **merek = 12 item**; O(n²) = 144 pembandingan, tak terukur.
   `[ukur]` Tidak muncul sebagai penyebab long task.
3. **"API produk lambat, minta backend tambah server."** Tidak relevan. `/api/produk` hanya menunda
   **180 ms** sekali di awal; `[ukur]` tidak ada di daftar penyebab pemblokiran interaksi. Bottleneck
   ada di main thread klien, bukan server.
4. **"Perhitungan voucher sudah saya buat `async`, jadi aman dan tidak memblokir."** **Ini keliru dan
   justru sumber masalah TK-1057.** `async` tanpa `await` nyata (atau `await` pada nilai non-promise)
   hanya menjadwalkan microtask; microtask dikuras habis sebelum rendering, sehingga tetap memblokir.
5. **"SDK analitik agak berat tapi tidak boleh disentuh."** Sebagian benar: SDK memang mahal
   (`f()` loop 2.000.000), tetapi **pemicu utamanya adalah payload raksasa yang kita kirim**, bukan
   SDK-nya sendiri. Karena aturan mengizinkan mengubah *isi data* saat memanggil SDK, masalahnya bisa
   diselesaikan tanpa menyentuh berkas vendor.

## 6. Yang belum beres dan rekomendasi

- **`perbaruiHargaVoucherDiKartu()`** masih membangun ulang seluruh kartu (satu long task tersisa di
  akhir penerapan voucher). Rekomendasi: perbarui hanya elemen harga pada kartu yang berubah.
- **Virtualisasi daftar** untuk pencarian/scroll akan memberi margin besar, tetapi menyentuh logika
  impresi dan efek muncul kartu; perlu desain hati-hati.
- **Untuk tim backend:** berikan endpoint gambar dengan `Cache-Control` yang tepat dan/atau ukuran
  gambar responsif; latensi 60–300 ms per gambar membatasi berapa cepat kartu terisi.
- **Untuk vendor SDK:** sediakan mode pengiriman non-blokir (mis. `sendBeacon`/Worker) dan batasi
  ukuran payload yang di-hash.
- **Untuk desain:** skeleton/placeholder banner agar area kosong 1800 ms tidak terasa seperti bug.

## 7. Pernyataan penggunaan AI dan pembagian kerja

- Alat AI yang dipakai: `[isi, mis. asisten coding X]`. Peran: membantu analisis kode dan menyusun
  draf perbaikan; setiap usulan diverifikasi dengan pengukuran dan penjelasan mekanisme oleh tim
  (lihat `laporan/AUDIT-AI.md`).
- Kontribusi tiap anggota: `[isi]`.

## 8. Lampiran: Tangkapan Layar Hasil Pengukuran (S0 – S6)

> Bagian lampiran ini memuat bukti tangkapan layar (screenshot) DevTools Performance (flame chart, track Interactions, Layout Shifts, Frames, Bottom-Up) serta Network/Console sebelum dan sesudah optimasi. Sesuai panduan, simpan berkas gambar pada folder `laporan/trace/baseline/` dan `laporan/trace/sesudah/`.

---

### S0 — Muat halaman, diam 10 detik (TK-1078, TK-1081)
**Fokus Metrik:** Cumulative Layout Shift (CLS) dan jumlah permintaan gambar (Network waterfall).

#### S0 - Sebelum (Baseline)
![S0 Sebelum - Layout Shifts & Network](trace/baseline/anotasi-s0.png)
*Keterangan / Analisis:* `[Lampirkan screenshot track Layout Shifts yang menunjukkan lonjakan CLS saat banner promo disisipkan (~1800 ms) & saat gambar termuat, serta panel Network yang memuat ~3000 gambar serentak.]`

#### S0 - Sesudah (Perbaikan)
![S0 Sesudah - Layout Shifts & Network](trace/sesudah/anotasi-s0.png)
*Keterangan / Analisis:* `[Lampirkan screenshot track Layout Shifts yang stabil (CLS <= 0,1) berkat reservasi min-height banner & dimensi gambar, serta panel Network yang hanya memuat gambar dalam viewport (lazy loading).]`

---

### S1 — Ketik "sepatu" huruf demi huruf, lalu hapus (TK-1041)
**Fokus Metrik:** Interaction to Next Paint (INP) dan Long Task terlama selama input teks.

#### S1 - Sebelum (Baseline)
![S1 Sebelum - Interactions & Long Tasks](trace/baseline/anotasi-s1.png)
*Keterangan / Analisis:* `[Lampirkan screenshot track Interactions & flame chart Main Thread yang didominasi long task berulang dari renderProduk (x3000) dan samakanTinggiJudul (layout thrashing).]`

#### S1 - Sesudah (Perbaikan)
![S1 Sesudah - Interactions & Long Tasks](trace/sesudah/anotasi-s1.png)
*Keterangan / Analisis:* `[Lampirkan screenshot track Interactions (INP <= 200 ms) dan flame chart setelah penerapan debounce input ~180 ms dan DocumentFragment.]`

---

### S2 — Tekan "+ Keranjang" pada satu produk, sekali (TK-1044)
**Fokus Metrik:** Responsivitas klik tombol, INP, dan durasi long task pemblokiran thread.

#### S2 - Sebelum (Baseline)
![S2 Sebelum - Long Task Analitik](trace/baseline/anotasi-s2.png)
*Keterangan / Analisis:* `[Lampirkan screenshot long task sinkron setelah klik tombol akibat hashing payload raksasa 9.000 riwayat oleh lacak.min.js.]`

#### S2 - Sesudah (Perbaikan)
![S2 Sesudah - Respons Cepat Keranjang](trace/sesudah/anotasi-s2.png)
*Keterangan / Analisis:* `[Lampirkan screenshot respons klik instan tanpa long task setelah payload analitik dipangkas menjadi ringkas.]`

---

### S3 — Tekan "Beli sekarang" tiga kali cepat (TK-1052)
**Fokus Metrik:** Pencegahan duplikasi pesanan (concurrency guard) & umpan balik UI.

#### S3 - Sebelum (Baseline)
![S3 Sebelum - Multiple Order Request](trace/baseline/anotasi-s3.png)
*Keterangan / Analisis:* `[Lampirkan screenshot panel Network (3 POST /api/pesanan) dan log terminal server yang mencetak 3 pesanan dari 3 klik cepat.]`

#### S3 - Sesudah (Perbaikan)
![S3 Sesudah - Single Order & Disabled Button](trace/sesudah/anotasi-s3.png)
*Keterangan / Analisis:* `[Lampirkan screenshot tombol terkunci ("Memproses...") dan log server yang membuktikan hanya 1 pesanan yang terbentuk.]`

---

### S4 — Pakai voucher KILAT1212, lalu ketik di kolom cari (TK-1057)
**Fokus Metrik:** Rendering opportunity bertahap (progress bar) dan responsivitas input selama komputasi.

#### S4 - Sebelum (Baseline)
![S4 Sebelum - Main Thread Freeze](trace/baseline/anotasi-s4.png)
*Keterangan / Analisis:* `[Lampirkan screenshot satu long task masif simulasiCicilan yang memblokir rendering sehingga progres macet di 0% dan input cari tidak merespons.]`

#### S4 - Sesudah (Perbaikan)
![S4 Sesudah - Macrotask Yielding & Responsif](trace/sesudah/anotasi-s4.png)
*Keterangan / Analisis:* `[Lampirkan screenshot pembagian komputasi dengan jeda macrotask (setTimeout/yield) yang memungkinkan browser merender progres dan melayani ketikan pencarian.]`

---

### S5 — Gulir daftar produk terus-menerus 10 detik (TK-1063)
**Fokus Metrik:** Kelancaran gulir (track Frames), frame dropped (> 50 ms), dan penghapusan layout thrashing.

#### S5 - Sebelum (Baseline)
![S5 Sebelum - Dropped Frames & Layout Thrashing](trace/baseline/anotasi-s5.png)
*Keterangan / Analisis:* `[Lampirkan screenshot track Frames dengan banyak frame merah (> 50 ms) yang diakibatkan oleh querySelectorAll + getBoundingClientRect di handler scroll.]`

#### S5 - Sesudah (Perbaikan)
![S5 Sesudah - Smooth 60fps Scrolling](trace/sesudah/anotasi-s5.png)
*Keterangan / Analisis:* `[Lampirkan screenshot track Frames yang mulus (frame > 50 ms <= 2) setelah koalesing via requestAnimationFrame dan caching elemen.]`

---

### S6 — Diam 10 detik tanpa menyentuh apa pun (TK-1070)
**Fokus Metrik:** Konsumsi CPU saat idle, timer 10 ms, dan pemindahan animasi ke GPU Compositor.

#### S6 - Sebelum (Baseline)
![S6 Sebelum - Idle Activity & Timer Thrashing](trace/baseline/anotasi-s6.png)
*Keterangan / Analisis:* `[Lampirkan screenshot flame chart saat diam yang dipenuhi task berkala setInterval 10 ms dan layout/paint sinkron dari animasi top/box-shadow.]`

#### S6 - Sesudah (Perbaikan)
![S6 Sesudah - Main Thread Idle Tenang](trace/sesudah/anotasi-s6.png)
*Keterangan / Analisis:* `[Lampirkan screenshot main thread yang hampir sepenuhnya tenang saat diam (aktivitas mendekati nol) dengan animasi CSS transform/opacity di compositor.]`
