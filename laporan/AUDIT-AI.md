# Audit Usulan Perbaikan dari AI
TokoKilat 12.12 – Peran: Reviewer

Peran Anda di sini adalah **reviewer**. Minta sebuah AI (asisten chat atau coding agent) memperbaiki minimal dua tiket, sebaiknya di branch terpisah. Uji usulannya dengan protokol pengukuran yang sama. Temukan minimal **dua** usulan bermasalah. Usulan AI yang bagus juga boleh dicatat, tetapi tidak menggantikan dua temuan wajib.

**Alat AI yang dipakai:** Google Antigravity Model 3.8 Flash Low  
**Branch atau commit tempat usulan diterapkan:** Afriza / Main

---

## A-01: Mengubah banner promo menjadi modal fixed overlay / menghapus fungsi samakanTinggiJudul

- **Tiket yang diminta diperbaiki:** TK-1078 (Skenario S0 – Layout Shift)
- **Prompt yang diberikan (ringkas):** Halaman meloncat ke bawah saat pemuatan awal dan nilai CLS 0,475. Perbaiki kode agar tidak terjadi layout shift.
- **Usulan AI (ringkas):** AI mengira layout shift disebabkan oleh _layout thrashing_ pada fungsi `samakanTinggiJudul()` di `katalog.js`, atau menyarankan banner promo berposisi `position: fixed` / `absolute` melayang di layar. Potongan kodenya:
  ```css
  .promo-banner {
    position: fixed;
    bottom: 20px;
    left: 20px;
    right: 20px;
    z-index: 9999;
  }
  ```
- **Jenis masalah pada usulan:**
  - [x] Salah diagnosis (memperbaiki hal yang bukan penyebab)
  - [ ] Tidak lengkap (gejala berkurang tetapi akar masalah masih ada)
  - [x] Menimbulkan regresi (metrik lain, fitur, aksesibilitas, atau memori memburuk)
  - [ ] Melanggar aturan main (menghapus fitur, mengubah berkas terlarang, dan sebagainya)
  - [x] Memperbaiki sesuatu yang tidak berpengaruh terukur
- **Bukti:**  
  Pada rekaman flame chart panel Performance, `samakanTinggiJudul()` hanya dieksekusi di awal (~20 ms) dan tidak menyumbang skor CLS.  
  **bukti berkas :** image/AUDIT-AI/1790864475021.png  
  Pergeseran tata letak sebesar 0,475 terjadi tepat pada detik 1,8 ketika respons asinkron `/api/promo` tiba dan disisipkan dengan `$('#utama').prepend(banner)`. Jika usulan `position: fixed` diterapkan, banner melayang menutupi tombol filter kategori, kolom input voucher, dan produk katalog di layar mobile (412 × 915 piksel), sehingga merusak aksesibilitas dan interaksi visual pengguna.  
  **bukti berkas :** image/AUDIT-AI/1790890875739.png
- **Mengapa AI bisa keliru di sini:** AI hanya menganalisis sintaks kode JavaScript secara statis. AI melihat adanya fungsi manipulasi layout DOM (`samakanTinggiJudul()`) dan mengira itu penyebab CLS. AI tidak membaca rekaman flame chart Chrome DevTools, sehingga tidak tahu bahwa event LayoutShift sesungguhnya dipicu penyisipan elemen asinkron di bagian paling atas dokumen tanpa pencadangan ruang (_unreserved space_). Fungsi `samakanTinggiJudul()` memang memicu layout thrashing pada rendering kartu, tetapi bukan pemicu pergeseran banner.
- **Perbaikan yang benar menurut tim:**
  1. Menyisipkan kerangka `<section class="promo-banner">` secara sinkron di JavaScript sebelum `fetch('/api/promo')` dikirim, dengan teks placeholder informatif, sehingga ruang banner sudah terbentuk sejak frame rendering pertama.
  2. Menetapkan `min-height: 132px` di CSS untuk desktop dan `@media (max-width: 640px) { .promo-banner { min-height: 220px; } }` untuk layar mobile agar sesuai pembungkusan teks multi-baris. Begitu data `/api/promo` tiba, teks diperbarui di tempat tanpa mengubah dimensi elemen. Skor CLS turun dari 0,475 menjadi **0,002** tanpa mengganggu antarmuka.
  3. Mengganti `samakanTinggiJudul()` dengan pembatasan 2 baris murni CSS (`-webkit-line-clamp: 2; height: calc(2 * 1.35em)`). Ini bukan untuk memperbaiki CLS, melainkan untuk mengeliminasi reflow sinkron pada kartu katalog.

---

## A-02: Paginasi server di server.js / memasang library virtual list eksternal

- **Tiket yang diminta diperbaiki:** TK-1081 (Skenario S0 – 1.500 load gambar)
- **Prompt yang diberikan (ringkas):** Ada 1.500 gambar produk yang diminta bersamaan sehingga antrean jaringan macet. Tolong perbaiki agar hanya memuat gambar yang terlihat.
- **Usulan AI (ringkas):** AI mengusulkan mengubah backend di `server.js` untuk membatasi respons produk menjadi 20 data per halaman (paginasi server), atau memasang pustaka pihak ketiga seperti `react-window` atau script Virtual DOM Scroll eksternal:
  ```javascript
  app.get("/api/produk", (req, res) => {
    const limit = 20;
    res.json(PRODUK.slice(0, limit));
  });
  ```
- **Jenis masalah pada usulan:**
  - [ ] Salah diagnosis (memperbaiki hal yang bukan penyebab)
  - [ ] Tidak lengkap (gejala berkurang tetapi akar masalah masih ada)
  - [x] Menimbulkan regresi (metrik lain, fitur, aksesibilitas, atau memori memburuk)
  - [x] Melanggar aturan main (menghapus fitur, mengubah berkas terlarang, dan sebagainya)
  - [ ] Memperbaiki sesuatu yang tidak berpengaruh terukur
- **Bukti:**  
  Di panel Network, waktu respons `/api/produk` sangat cepat (~180 ms), sehingga backend tidak bermasalah.  
  **Bukti:** image/AUDIT-AI/1790891060961.png  
  Mengubah `server.js` melanggar aturan integritas berkas tugas (bagian 5: berkas terlarang). Selain itu, memotong katalog menjadi 20 produk merusak fitur filter pencarian instan di `katalog.js`, karena pengguna tidak bisa lagi mencari sisa 1.480 produk di sisi klien.  
  **Bukti Berkas:** image/AUDIT-AI/1790891206943.png
- **Mengapa AI bisa keliru di sini:** AI terbiasa dengan arsitektur web umum (katalog ribuan produk biasanya di-paginate di server) dan tidak membaca `TUGAS.md` yang secara eksplisit melarang memodifikasi `server.js`, melarang pustaka eksternal, dan mewajibkan seluruh 1.500 produk tetap ada di sisi klien. AI juga tidak sadar bahwa peramban modern sudah punya fitur native (`loading="lazy"` dan `decoding="async"`) serta Web API standar (`IntersectionObserver`) yang menyelesaikan masalah antrean HTTP/1.1 murni di sisi klien.
- **Perbaikan yang benar menurut tim:**
  - Menerapkan atribut native `gambar.loading = 'lazy'` dan `gambar.decoding = 'async'` di `katalog.js`, dimensi eksplisit `width="480"` `height="480"`, serta `aspect-ratio: 1 / 1` di CSS.
  - Menerapkan _windowing/chunked rendering_ bertahap (`UKURAN_CHUNK = 24`) dengan `IntersectionObserver` sentinel tanpa pustaka pihak ketiga.
  - Seluruh 1.500 produk tetap ada di memori klien untuk filter dan pencarian instan, tetapi permintaan jaringan awal turun dari 1.500 menjadi **10 gambar** (selesai ~1,97 detik).

---

## Refleksi

_Maksimal 200 kata. Untuk jenis pekerjaan apa AI paling membantu di tugas ini, dan di mana Anda harus paling waspada?_

Jenis pekerjaan yang paling membantu di tugas ini adalah memberikan pemahaman mengenai bagaimana program aplikasi bekerja dan di mana potensi error yang menyebabkan keluhan pengguna, serta memberikan beberapa alternatif perbaikan yang bisa dilakukan. Namun, kita juga harus waspada terhadap saran perbaikan dari AI, karena terkadang saran tersebut tidak sesuai dengan kebutuhan program dan AI bisa membuat kesalahan dalam perbaikannya, seperti membuat program hardcoded credentials yang mengekspos kredensial rahasia karena tidak memahami konteks penggunaannya, atau tidak mempertimbangkan trade-off dari perbaikannya. Karena itu kita harus tetap melakukan verifikasi dan pengujian terhadap saran AI dan memastikan jawabannya sesuai dengan spesifikasi dan kebutuhan kita.

---

## A-03: Usulan AI memakai `async` dan `debounce` pada tombol "+ Keranjang"

- **Tiket yang diminta diperbaiki:** TK-1044 (Skenario S2)
- **Prompt yang diberikan (ringkas):** "Tombol + Keranjang di berkas `keranjang.js` terasa sangat lambat dan bikin aplikasi hang di HP Android spek rendah. Tolong perbaiki kodenya agar cepat dan tidak freeze."
- **Usulan AI (ringkas, sertakan potongan kode yang relevan):** AI mengira masalahnya karena manipulasi DOM dan logging analitik berjalan berurutan, lalu menyarankan mengubah handler jadi async dan menambahkan debounce 300 ms:
  ```javascript
  // Usulan AI
  export const tambahKeKeranjang = debounce(async (produk, tombol) => {
    const keranjang = bacaKeranjang();
    // ... update keranjang ...
    await Promise.resolve(); // AI berasumsi ini memberi napas ke event loop
    window.Lacak.kirim('add_to_cart', { produk, keranjang, riwayat: bacaRiwayat() });
    tampilkanToast('Ditambahkan ke keranjang');
  }, 300);
  ```
- **Jenis masalah pada usulan:**
  - [x] Salah diagnosis (memperbaiki hal yang bukan penyebab)
  - [x] Tidak lengkap (gejala berkurang tetapi akar masalah masih ada)
  - [x] Menimbulkan regresi (metrik lain, fitur, aksesibilitas, atau memori memburuk)
  - [ ] Melanggar aturan main (menghapus fitur, mengubah berkas terlarang, dan sebagainya)
  - [ ] Memperbaiki sesuatu yang tidak berpengaruh terukur
- **Bukti:**  
  Saat diuji dan direkam di Performance panel, `await Promise.resolve()` hanya memindahkan sisa eksekusi ke antrean microtask pada Main Thread yang sama. Begitu `Lacak.kirim` dipanggil, loop 2.000.000 iterasi hash tetap berjalan di Main Thread dan membekukan browser.  
  Long Task tetap terjadi sekitar **> 500 ms**. Terdapat bukti screenshot pada GitHub di folder `laporan/trace/baseline/s2`.  
  Penambahan debounce 300 ms justru membuat respons tombol terasa semakin telat karena notifikasi toast baru muncul setelah jeda 300 ms.
- **Mengapa AI bisa keliru di sini:** AI hanya membaca kode teks di `keranjang.js` tanpa melihat flame chart profiler. AI mengira kata kunci `async` otomatis membuat komputasi CPU berat berjalan di background, padahal operasi CPU-bound di JavaScript tetap memblokir Main Thread jika tidak memakai Web Worker. AI juga tidak memeriksa bahwa data riwayat 9.000 entri yang dikirimkan itulah yang memicu ledakan perhitungan hash di SDK vendor.
- **Perbaikan yang benar menurut tim:**  
  Solusi yang kami terapkan adalah memindahkan eksekusi SDK vendor sepenuhnya ke Web Worker di background thread (dibuat via Blob di `util.js`). Dengan cara ini, perulangan hash 2 juta kali tidak lagi membebani main thread. Kami juga memangkas data analitik agar hanya mengirim info produk yang penting saja tanpa membawa seluruh array riwayat, menyimpan riwayat di memori (cache) supaya tidak perlu parse ulang dari `localStorage` tiap klik, dan menunda panggilan kirim event memakai `setTimeout(..., 0)` (`kirimTertunda`) agar keluar dari task klik. Hasilnya, browser langsung merender toast dan badge keranjang seketika, dan INP kami turun drastis dari 520 ms menjadi **81 ms**.

---

## A-04: Usulan AI menggunakan `debounce` untuk mengatasi pesanan ganda pada "Beli sekarang"

- **Tiket yang diminta diperbaiki:** TK-1052 (Skenario S3)
- **Prompt yang diberikan (ringkas):** "Pelanggan komplain tagihannya jadi dobel karena tombol 'Beli sekarang' diklik berkali-kali secara cepat. Bagaimana cara mencegah double order pada fungsi `beliSekarang` di `keranjang.js`?"
- **Usulan AI (ringkas, sertakan potongan kode yang relevan):** AI menyarankan membungkus fungsi `beliSekarang` dengan debounce:
  ```javascript
  // Usulan AI
  import { debounce } from './util.js';

  export const beliSekarang = debounce(async (produk, tombol) => {
    const respons = await fetch('/api/pesanan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ produkId: produk.id, nama: produk.nama }),
    });
    const pesanan = await respons.json();
    tombol.textContent = 'Dipesan ✓';
  }, 500);
  ```
- **Jenis masalah pada usulan:**
  - [x] Salah diagnosis (memperbaiki hal yang bukan penyebab)
  - [x] Tidak lengkap (gejala berkurang tetapi akar masalah masih ada)
  - [x] Menimbulkan regresi (metrik lain, fitur, aksesibilitas, atau memori memburuk)
  - [ ] Melanggar aturan main (menghapus fitur, mengubah berkas terlarang, dan sebagainya)
  - [ ] Memperbaiki sesuatu yang tidak berpengaruh terukur
- **Bukti:**  
  Skenario S3 menguji penekanan tombol 3 kali dengan cepat. Pemakaian `debounce(..., 500)` membuat klik pertama sengaja ditunda selama 500 ms, sehingga aplikasi terasa lambat merespons.  
  Lebih buruk lagi, jika respon server butuh waktu di atas 500 ms (misal 700 ms) dan pengguna klik lagi setelah 500 ms (karena tombol masih aktif dan belum berubah), request kedua tetap terkirim ke server saat request pertama masih berjalan. Masalah pesanan ganda tetap terjadi.  
  Tombol juga tidak di-disable dan tidak ada tulisan loading, sehingga pengguna tidak tahu prosesnya sudah berjalan atau belum.  
  Bukti tersimpan pada GitHub di folder `laporan/trace/baseline/s3` dan juga pada gambar `hasil_console_sebelum.png` menunjukkan pada produk yang sama terdeteksi terdapat 3 pesanan yang masuk.
- **Mengapa AI bisa keliru di sini:** AI hanya memberi solusi umum (template debounce) tanpa memahami siklus hidup request jaringan yang asinkron. Masalah tombol beli ini bukan soal pembatasan laju klik (_rate limiting_), melainkan butuh penguncian transaksi (_concurrency guard_) dan perubahan status tombol selama request berjalan.
- **Perbaikan yang benar menurut tim:**  
  Daripada menunda klik dengan debounce, kami memasang pengunci transaksi di frontend menggunakan `Set` `sedangDipesan` berdasarkan ID produk. Begitu tombol diklik pertama kali, tombolnya langsung kami buat `disabled = true` dan teksnya langsung diganti jadi "Memproses…". Kalau pengguna mencoba menekan tombol lagi saat prosesnya belum selesai, klik susulan tersebut langsung kami abaikan (`return`). Seluruh alur ini kami bungkus dalam blok `try...finally` agar tombol otomatis aktif kembali setelah respon dari server selesai diterima. Dengan cara ini, dari 3 klik cepat secepat apa pun, server hanya memproses tepat **1 pesanan saja** dan pengguna langsung mendapat kepastian visual bahwa pesanannya sedang diproses.

---

## Refleksi (maks. 200 kata)

Dalam pengerjaan tugas ini, kami harus sangat berhati-hati terhadap saran teknis perbaikan performa dari AI. AI hanya membaca pola kode teks dari sebuah file tertentu dan sering kali menyarankan solusi template generik, tanpa tahu apa yang sebenarnya terjadi di runtime browser. AI tidak bisa melihat flame chart DevTools, tidak tahu antrean task di event loop, dan tidak merasakan langsung jeda interaksi pada perangkat.

Pelajaran terpenting bagi kami: jangan langsung percaya saran optimasi AI sebelum dibuktikan dengan trace profiling sendiri. Pemeriksaan langsung lewat DevTools tetap diperlukan agar perbaikan benar-benar menyelesaikan akar masalah tanpa merusak pengalaman pengguna.

---

## A-05: Memecah perhitungan voucher menggunakan Microtask `Promise.resolve()`

- **Tiket yang diminta diperbaiki:** TK-1057 — Penerapan voucher lambat dan menghambat interaksi (S4).
- **Prompt yang diberikan (ringkas):** Bantu saya memperbaiki proses penerapan voucher agar tidak memblokir main thread. Buat progress bar berjalan bertahap dan biarkan halaman tetap responsif.
- **Usulan AI (ringkas, sertakan potongan kode yang relevan):** Gemini mengusulkan untuk melakukan chunking (memecah data), lalu menggunakan `await Promise.resolve()` di setiap iterasi dengan asumsi hal itu akan membebaskan main thread dan memberi jeda agar UI terbarui.
  ```javascript
  for (let i = 0; i < total; i += UKURAN_CHUNK) {
    const batas = Math.min(i + UKURAN_CHUNK, total);
    for (let j = i; j < batas; j++) {
      // ... hitung harga promo ...
    }
    // Usulan Gemini: Menyerahkan kendali ke browser dengan microtask
    await Promise.resolve();
  }
  ```
- **Jenis masalah pada usulan:**
  - [x] Tidak lengkap (gejala berkurang tetapi akar masalah masih ada)
  - [x] Salah diagnosis (memperbaiki hal yang bukan penyebab)
  - [ ] Menimbulkan regresi (metrik lain, fitur, aksesibilitas, atau memori memburuk)
  - [ ] Melanggar aturan main (menghapus fitur, mengubah berkas terlarang, dan sebagainya)
  - [ ] Memperbaiki sesuatu yang tidak berpengaruh terukur
- **Bukti:** Secara teknis, `Promise.resolve()` hanya memasukkan kelanjutan fungsi ke dalam Microtask Queue. Arsitektur peramban mewajibkan seluruh microtask dikuras sampai habis sebelum peramban melangkah ke fase Rendering. Akibatnya, progress bar tetap membeku di 0%, halaman tetap tidak responsif, dan tiba-tiba melompat ke 100% setelah seluruh kalkulasi selesai dikerjakan dalam satu putaran besar. Terdapat pada GitHub di folder `laporan/trace/baseline/s4`.
- **Mengapa AI bisa keliru di sini:** AI sering kali menyamakan semua bentuk "Asynchronous JavaScript" (seperti Promise atau async/await) sebagai solusi untuk menghindari pemblokiran (_blocking_). AI tidak membedakan antara Microtask (yang memblokir render) dengan Macrotask (yang mengizinkan render). AI tidak menyadari bahwa satu-satunya cara memberi ruang pada peramban untuk melukis (_paint_) adalah dengan mengeluarkan iterasi dari microtask queue.
- **Perbaikan yang benar menurut tim:** Ganti `await Promise.resolve()` dengan Macrotask, yaitu `await new Promise(r => setTimeout(r, 0))`. Jeda `setTimeout` akan memaksa eksekusi keluar dari siklus saat ini, memberikan kesempatan (_rendering opportunity_) bagi peramban untuk menggambar persentase progress bar dan menerima input pengguna, sebelum melanjutkan iterasi chunk berikutnya.

### Refleksi
Dari pengujian ini, saya memahami bahwa penggunaan async/await tidak selalu membuat proses JavaScript menjadi lebih responsif. `await Promise.resolve()` hanya menjadwalkan kelanjutan melalui microtask, sehingga browser belum tentu mendapat kesempatan untuk memperbarui tampilan. Saya belajar bahwa solusi optimasi harus mempertimbangkan cara kerja event loop, bukan sekadar menggunakan kode asinkron. Usulan AI tetap perlu diuji dan diverifikasi sebelum diterapkan.

---

## A-06: Menggunakan `requestAnimationFrame` untuk mengatur ulang properti width

- **Tiket yang diminta diperbaiki:** TK-1070 — Aktivitas pemrosesan dan rendering berlebih saat halaman idle (S6).
- **Prompt yang diberikan (ringkas):** Kurangi beban CPU dan hilangkan patah-patah (_jank_) pada animasi garis hitung mundur promo saat halaman diam (_idle_).
- **Usulan AI (ringkas, sertakan potongan kode yang relevan):** AI menyarankan bahwa `setInterval` adalah praktik buruk untuk animasi, dan menggantinya dengan `requestAnimationFrame` (rAF) agar animasi sinkron dengan refresh rate layar.
  ```javascript
  const segarkan = () => {
    // ... kalkulasi waktu ...
    const rasio = sisa / rentang;
    // Usulan AI: Update style width di dalam rAF
    garis.style.width = (rasio * 100) + '%';
    requestAnimationFrame(segarkan);
  };
  requestAnimationFrame(segarkan);
  ```
- **Jenis masalah pada usulan:**
  - [x] Tidak lengkap (gejala berkurang tetapi akar masalah masih ada)
  - [ ] Salah diagnosis (memperbaiki hal yang bukan penyebab)
  - [ ] Menimbulkan regresi (metrik lain, fitur, aksesibilitas, atau memori memburuk)
  - [ ] Melanggar aturan main (menghapus fitur, mengubah berkas terlarang, dan sebagainya)
  - [x] Memperbaiki sesuatu yang tidak berpengaruh terukur
- **Bukti baseline:** Rekaman Performance untuk skenario S6 disimpan pada direktori `laporan/trace/baseline/s6` di repositori GitHub. Rekaman baseline digunakan untuk mengidentifikasi aktivitas pemrosesan pada main thread, Long Tasks, dan frame berdurasi lebih dari 50 ms ketika halaman dibiarkan idle selama 10 detik.
- **Bukti setelah usulan AI:** Rekaman Performance setelah usulan penggunaan `requestAnimationFrame()` perlu dibandingkan dengan baseline menggunakan konfigurasi dan durasi pengujian yang sama. Perbandingan dilakukan untuk menilai apakah usulan AI benar-benar mengurangi aktivitas pemrosesan dan rendering ketika halaman idle. Kesimpulan mengenai efektivitas usulan didasarkan pada hasil pengukuran, bukan hanya perubahan kode.
- **Mengapa AI bisa keliru di sini:** Melihat kata kunci "animasi lambat", model Gemini dilatih untuk langsung menyarankan `requestAnimationFrame` karena itu adalah standar buku teks (_best practice_). Kelemahan AI murni tekstual adalah tidak bisa "melihat" Rendering Pipeline. Bagi AI, mengubah properti DOM width dengan transform tampak sama saja (sekadar mengubah nilai variabel), padahal di level arsitektur peramban, biayanya ibarat bumi dan langit.
- **Perbaikan yang benar menurut tim:** Timer bisa dipertahankan (dengan jeda lebih santai seperti 50ms), tetapi animasi fisiknya wajib diubah dari manipulasi width menjadi `transform: scaleX(rasio)`. Properti transform sepenuhnya di-bypass dari Layout/Paint dan langsung dikerjakan oleh GPU (_Composite layer_), sehingga main thread benar-benar bisa bernapas lega saat idle.

### Refleksi A-06
Dari audit ini, saya memahami bahwa penggunaan `requestAnimationFrame()` tidak otomatis menghilangkan beban rendering. Memperbarui properti width berulang kali masih berpotensi memicu pekerjaan layout dan rendering. Saya belajar bahwa optimasi perlu mempertimbangkan properti CSS yang diubah serta aktivitas browser saat halaman idle. Rekomendasi AI dapat menjadi titik awal, tetapi efektivitasnya harus dibuktikan melalui pengukuran dan perbandingan Performance trace.
