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

### T-01: Setiap huruf memicu pembuatan ulang seluruh hasil (ribuan kartu)

**Tiket terkait:** TK-1041

**Gejala bagi pengguna:** Huruf yang diketik muncul terlambat, kadang beberapa huruf sekaligus, dan layar terasa beku.

**Bukti:** [isi: tangkapan layar flame chart S1 baseline. Tandai (1) satu task `input` pada track Main, (2) fungsi
dominan di bottom-up: `renderProduk`, `buatKartu`, `formatRupiah`/`Intl.NumberFormat`, `Function call`, (3) tahap
pipeline sesudah task: Recalculate Style, Layout, Paint dan lebarnya, (4) event `keydown`/`input` di track
Interactions yang tertunda di belakang task ini.]

**Akar masalah dan mekanismenya:**
`pencarian.js`, pendengar `input` memanggil `terapkanSaringan()` pada **setiap** ketikan. Fungsi itu memanggil
`renderProduk()` (`katalog.js`) yang mengosongkan `#kisi` dengan `innerHTML = ''` lalu membuat ulang **semua** kartu
yang cocok lewat `buatKartu()`. Jumlah kartu per langkah (dihitung dari data server 1.500 produk, normalisasi yang
sama dengan `normalkan()`):

| Teks cari | s | se | sep | sepa | sepat | sepatu | sepat | sepa | sep | se | s | (kosong) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Kartu dibuat | 1.456 | 585 | 70 | 51 | 51 | 51 | 51 | 51 | 70 | 585 | 1.456 | 1.500 |

Totalnya **5.977 kartu** (setiap kartu sekitar 12 node DOM, satu `<img>` yang langsung meminta gambar, dan
beberapa panggilan `formatRupiah`). Biaya terbesar yang bisa kami buktikan di luar browser ada di `util.js`:
versi baseline `formatRupiah()` membuat `new Intl.NumberFormat(...)` **di setiap panggilan**. Benchmark Node
(mesin V8 yang sama dengan Chrome, tanpa throttling, median 25 kali): 2.912 panggilan (kira-kira 2 per kartu
untuk 1.456 kartu pada ketikan "s") memakan **105 ms** bila membuat pemformat baru tiap kali, dan **1,6 ms** bila
satu pemformat dipakai ulang. Angka ini bukan pengganti flame chart; ia menunjukkan arah dan ordenya
(kali 4 untuk perkiraan kasar di throttling 4x, jadi urutan 400 ms hanya untuk satu ketikan "s").

Menurut event loop: seluruh pekerjaan ini berjalan **di dalam satu task** (callback `input`). Browser baru
mendapat *rendering opportunity* setelah task selesai. Selama task berlangsung, tidak ada frame yang bisa
digambar dan ketikan berikutnya hanya menunggu di antrean (input delay). Karena satu task jauh lebih lama daripada
jeda antar ketikan, antrean makin panjang, dan itulah "huruf muncul telat-telat". Setelah task berakhir, pipeline
masih harus menjalankan Style, Layout, dan Paint untuk ribuan node, sehingga *presentation delay* juga besar.

**Kualitas yang terdampak (ISO/IEC 25010):**
- *Performance efficiency, time behaviour:* waktu respons terhadap ketikan jauh melewati ambang yang terasa
  instan. *Resource utilization:* CPU habis untuk membuat dan membuang ribuan node yang tidak pernah terlihat
  (hanya sekitar satu sampai dua layar kartu yang terlihat).
- *Interaction capability, operability:* pengguna tidak bisa mengendalikan kolom cari dengan nyaman karena umpan
  baliknya terlambat. *Inclusivity:* beban yang tidak terasa di laptop pengembang menjadi penghalang di Android
  entry-level, yaitu sebagian besar pembeli kita. *User engagement:* Bu Wulan meninggalkan toko ("saya cari di toko sebelah").
- Rantai sebab-akibat: render penuh per huruf, lalu task panjang, lalu tidak ada rendering opportunity, lalu
  echo huruf tertunda, lalu pengguna kehilangan kendali dan beralih ke toko lain.

**Perbaikan:**
1. `pencarian.js` + `util.js`: `debounce(fn, 150)`. Handler `input` hanya menyimpan teks dan menjadwalkan
   `terapkanSaringan()` setelah 150 ms tanpa ketikan baru. Task `input` menjadi sangat pendek sehingga browser
   dapat menggambar huruf di frame berikutnya.
2. `katalog.js`: *penggambaran bertahap*. Seluruh hasil tetap disimpan di `keadaan.ditampilkan` dan jumlah di
   `#ringkasan` tetap jumlah sebenarnya, tetapi hanya 24 kartu (`UKURAN_CHUNK`) yang dibuat per chunk. Chunk
   berikutnya ditambahkan saat `IntersectionObserver` pada elemen sentinel (margin 800 px) mendekati layar.
   Pembuatan DOM sebanding dengan yang terlihat, bukan dengan jumlah hasil.
3. `util.js`: `Intl.NumberFormat` dibuat sekali di scope modul (`PEMFORMAT_RUPIAH`).
4. `pencarian.js`: teks tiap produk dinormalkan sekali dan di-cache di `WeakMap` (`teksProduk`), indeks dibangun
   bertahap per 300 produk lewat `setTimeout` (`siapkanIndeks`) supaya ketikan pertama tidak menanggung
   normalisasi seluruh katalog.
5. `toko.css`: `content-visibility: auto` + `contain-intrinsic-size` pada `.kartu` agar kartu di luar layar tidak
   ikut dihitung layout dan paint.

**Trade-off:**
- *Debounce 150 ms:* hasil pencarian baru tampil sekitar 150 ms setelah ketikan berhenti (ditambah waktu render
  chunk pertama). Pengguna yang mengetik pelan (jeda > 150 ms) tetap memicu beberapa render, jadi manfaat
  penggabungan bergantung pada kecepatan ketik. Kami memilih 150 ms sebagai kompromi: lebih kecil mengurangi
  penggabungan, lebih besar membuat hasil terasa lambat.
- *Penggambaran bertahap:* pencarian bawaan browser (Ctrl+F) tidak menemukan kartu yang belum dibuat, dan tinggi
  halaman bertambah seiring chunk sehingga posisi scrollbar bergeser. Aturan "semua produk bisa dijangkau dengan
  menggulir" tetap terpenuhi lewat sentinel, tetapi lompat langsung ke produk ke-1.000 tidak lagi instan.
- *Alternatif yang dipertimbangkan:* (a) virtualisasi penuh (DOM hanya berisi jendela kartu yang terlihat): paling
  hemat, tetapi rumit untuk grid responsif, fokus keyboard, dan pembaca layar, dan terlalu besar untuk lingkup
  tugas. (b) Paginasi: sederhana, tetapi mengubah pola penjelajahan flash sale. (c) Memindahkan filter ke
  Web Worker: **tidak dipilih karena filter hanya memakan 2,75 ms** untuk 1.500 produk (benchmark Node), bukan
  sumber masalah. (d) Hanya `content-visibility: auto`: mengurangi Layout/Paint tetapi tidak mengurangi biaya
  JavaScript membuat ribuan node.

**Hasil:** INP S1 [isi: ... ms] menjadi [isi: ... ms]. Long task terlama [isi: ... ms] menjadi [isi: ... ms].
Kartu yang dibuat selama S1: 5.977 menjadi [isi: ... ].

---

### T-02: Layout sinkron yang dipaksa di dalam jalur render

**Tiket terkait:** TK-1041

**Gejala bagi pengguna:** Sama dengan T-01. Ini adalah bagian dari jeda yang tidak hilang walaupun jumlah kartu berkurang.

**Bukti:** [isi: tangkapan layar flame chart baseline, zoom ke dalam task render. Tandai blok ungu "Layout"
yang muncul **di dalam** `renderProduk`, dengan peringatan "Forced reflow" dan *stack trace*-nya menunjuk ke
`samakanTinggiJudul` (`offsetHeight`) dan `periksaGulir` (`scrollHeight`, `getBoundingClientRect`).]

**Akar masalah dan mekanismenya:**
Pada baseline, `renderProduk()` diakhiri dua fungsi yang membaca geometri tepat setelah DOM diubah:
- `samakanTinggiJudul()` (`katalog.js`): untuk 24 judul pertama, menulis `style.height = 'auto'`, membaca
  `offsetHeight`, lalu menulis `style.height` lagi; kemudian menulis tinggi ke **semua** judul.
- `periksaGulir()` (`gulir.js`): menulis kelas header dan lebar bar, membaca `document.documentElement.scrollHeight`,
  lalu menelusuri seluruh `.kartu` dengan `getBoundingClientRect()` sambil menulis `classList`/`style.minHeight`
  pada kartu yang terlihat.

Pola tulis-lalu-baca ini (*layout thrashing*) memaksa browser menyelesaikan Style dan Layout **sekarang**, di
tengah JavaScript, alih-alih menunda ke tahap Layout normal setelah task. Karena DOM baru saja diisi ribuan
kartu, pembacaan pertama menanggung layout seluruh kisi. Akibatnya biaya Layout ikut memperpanjang task `input`
(*long task*), dan tiap tulis-baca berikutnya dapat memicu layout ulang. Komentar pada kode hasil perbaikan mencatat
sekitar 83 ms (`samakanTinggiJudul`) dan 89 ms (`getBoundingClientRect` setelah menambah kartu) pada CPU 4x.
**Angka ini belum diverifikasi dalam laporan ini; ganti dengan angka dari Summary/Bottom-up trace Anda:
[isi: ... ms].**

**Kualitas yang terdampak (ISO/IEC 25010):**
- *Performance efficiency, time behaviour:* pekerjaan Layout yang sebenarnya bisa digabung di akhir frame malah
  dikerjakan berulang dan lebih awal. *Resource utilization:* CPU dipakai untuk menghitung layout yang segera
  dibuang pada ketikan berikutnya.
- *Interaction capability, operability:* memperbesar jeda antara ketikan dan respons visual.
- Sebab-akibat: forced reflow, lalu task `input` memanjang, lalu *presentation delay* membesar, lalu INP naik.

**Perbaikan:**
- `katalog.js` dan `toko.css`: `samakanTinggiJudul()` dihapus. Tinggi judul disamakan dengan CSS
  (`height: calc(2 * 1.35em)` + `-webkit-line-clamp: 2`), sehingga tidak ada pengukuran sama sekali.
- `katalog.js`: pengecekan posisi sentinel (`getBoundingClientRect`) dipindah ke `requestAnimationFrame`
  (`isiSampaiLayarPenuh`), jadi dibaca di awal frame berikutnya, bukan di dalam task render.
- `gulir.js`: `periksaGulir()` kini hanya menjadwalkan `perbaruiBilah` lewat `rafThrottle`; pemindaian
  `querySelectorAll('.kartu')` + `getBoundingClientRect` diganti `IntersectionObserver`; tinggi dokumen di-cache
  (`perbaruiTinggiDokumen`); bar progres memakai `transform: scaleX` (bukan `width`).

**Trade-off:**
- Judul dibatasi 2 baris: judul panjang terpotong (ellipsis tidak ditampilkan penuh). Visual berubah sedikit, tetapi
  aturan tugas membolehkan penyesuaian visual yang bisa dipertanggungjawabkan, dan semua judul tetap utuh di DOM
  serta atribut `alt`.
- `IntersectionObserver` bersifat asinkron: kelas `terlihat` (animasi muncul) dan pencatatan impresi sedikit
  tertunda dibanding pemindaian sinkron. Efek `margin` 80 px dipertahankan agar animasi tidak terlihat terlambat.
- *Risiko yang masih perlu diverifikasi di trace:* `tambahChunk()` memanggil `perbaruiTinggiDokumen()` (membaca
  `scrollHeight`) tepat setelah `kisi.append(frag)`. Itu masih membaca geometri sinkron, walau untuk 24 kartu
  dengan `content-visibility`. Periksa apakah masih muncul tanda "Forced reflow" di trace sesudah; bila ya,
  pindahkan ke `requestAnimationFrame` seperti `isiSampaiLayarPenuh`.
- *Alternatif:* menyamakan tinggi judul dengan ResizeObserver atau `grid-template-rows: subgrid`. Tidak dipilih
  karena CSS `line-clamp` tanpa JavaScript paling murah dan paling mudah dijelaskan.

**Hasil:** [isi: jumlah dan durasi "Forced reflow" pada task render: sebelum ... ms, sesudah ... ms].

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

---

## 7. Pernyataan penggunaan AI dan pembagian kerja

**Alat AI yang dipakai dan untuk apa:** [isi: nama alat dan versi. Draf laporan S1 ini disusun dengan bantuan
Claude (Anthropic) dari membaca repositori: membandingkan baseline dan versi perbaikan, menelusuri jalur kode S1,
dan menjalankan benchmark mikro di Node untuk filter, `Intl.NumberFormat`, dan SDK. Sebutkan juga alat yang dipakai
untuk menulis kode perbaikan di repositori, bila ada, dan rujuk ke `laporan/AUDIT-AI.md`.]

**Hal yang harus Anda verifikasi sendiri:** semua angka bertanda `[isi]`, angka 83/89/90 ms (berasal dari
komentar di kode, bukan dari trace dalam laporan ini), dan klaim mekanisme pada flame chart Anda.

**Kontribusi tiap anggota:** [isi: nama dan kontribusi masing-masing].
