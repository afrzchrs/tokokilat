# Audit usulan perbaikan dari AI

Peran Anda di sini adalah **reviewer**. Minta sebuah AI (asisten chat atau coding agent) memperbaiki
minimal dua tiket, sebaiknya di branch terpisah. Uji usulannya dengan protokol pengukuran yang sama.
Temukan minimal **dua** usulan bermasalah. Usulan AI yang bagus juga boleh dicatat, tetapi tidak
menggantikan dua temuan wajib.

Alat AI yang dipakai: Claude 3.5 Sonnet & Antigravity
Branch atau commit tempat usulan diterapkan: `audit-ai-eval` (evaluasi pada tiket TK-1044 dan TK-1052)

---

## A-03: Usulan AI memakai `async` dan `debounce` pada tombol "+ Keranjang"

- **Tiket yang diminta diperbaiki:** TK-1044 (Skenario S2)
- **Prompt yang diberikan (ringkas):**
  > "Tombol + Keranjang di berkas `keranjang.js` terasa sangat lambat dan bikin aplikasi hang di HP Android spek rendah. Tolong perbaiki kodenya agar cepat dan tidak freeze."
  >
- **Usulan AI (ringkas, sertakan potongan kode yang relevan):** AI mengira masalahnya karena manipulasi DOM dan logging analitik berjalan berurutan, lalu menyarankan mengubah handler jadi `async` dan menambahkan `debounce` 300 ms:
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
  - [X] Salah diagnosis (memperbaiki hal yang bukan penyebab)
  - [X] Tidak lengkap (gejala berkurang tetapi akar masalah masih ada)
  - [X] Menimbulkan regresi (metrik lain, fitur, aksesibilitas, atau memori memburuk)
  - [ ] Melanggar aturan main (menghapus fitur, mengubah berkas terlarang, dan sebagainya)
  - [ ] Memperbaiki sesuatu yang tidak berpengaruh terukur
- **Bukti:**
  - Saat diuji dan direkam di Performance panel, `await Promise.resolve()` hanya memindahkan sisa eksekusi ke antrean microtask pada Main Thread yang sama. Begitu `Lacak.kirim` dipanggil, loop 2.000.000 iterasi hash tetap berjalan di Main Thread dan membekukan browser.
  - Long Task tetap terjadi sekitar **> 500 ms**. Terdapat bukti screenshoot pada github di folder laporan/trace/baseline/s2
  - Penambahan `debounce` 300 ms justru membuat respons tombol terasa semakin telat karena notifikasi toast baru muncul setelah jeda 300 ms.
- **Mengapa AI bisa keliru di sini:** AI hanya membaca kode teks di `keranjang.js` tanpa melihat flame chart profiler. AI mengira kata kunci `async` otomatis membuat komputasi CPU berat berjalan di background, padahal operasi CPU-bound di JavaScript tetap memblokir Main Thread jika tidak memakai Web Worker. AI juga tidak memeriksa bahwa data riwayat 9.000 entri yang dikirimkan itulah yang memicu ledakan perhitungan hash di SDK vendor.
- **Perbaikan yang benar menurut tim:**
  Solusi yang kami terapkan adalah memindahkan eksekusi SDK vendor sepenuhnya ke Web Worker di background thread (dibuat via Blob di `util.js`). Dengan cara ini, perulangan hash 2 juta kali tidak lagi membebani main thread. Kami juga memangkas data analitik agar hanya mengirim info produk yang penting saja tanpa membawa seluruh array riwayat, menyimpan riwayat di memori (cache) supaya tidak perlu parse ulang dari localStorage tiap klik, dan menunda panggilan kirim event memakai `setTimeout(..., 0)` agar keluar dari task klik. Hasilnya, browser langsung merender toast dan badge keranjang seketika, dan INP kami turun drastis dari 520 ms menjadi 81 ms.

---

## A-04: Usulan AI menggunakan `debounce` untuk mengatasi pesanan ganda pada "Beli sekarang"

- **Tiket yang diminta diperbaiki:** TK-1052 (Skenario S3)
- **Prompt yang diberikan (ringkas):**
  > "Pelanggan komplain tagihannya jadi dobel karena tombol 'Beli sekarang' diklik berkali-kali secara cepat. Bagaimana cara mencegah double order pada fungsi `beliSekarang` di `keranjang.js`?"
  >
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
  - [X] Salah diagnosis (memperbaiki hal yang bukan penyebab)
  - [X] Tidak lengkap (gejala berkurang tetapi akar masalah masih ada)
  - [X] Menimbulkan regresi (metrik lain, fitur, aksesibilitas, atau memori memburuk)
  - [ ] Melanggar aturan main (menghapus fitur, mengubah berkas terlarang, dan sebagainya)
  - [ ] Memperbaiki sesuatu yang tidak berpengaruh terukur
- **Bukti:**
  - Skenario S3 menguji penekanan tombol 3 kali dengan cepat. Pemakaian `debounce(..., 500)` membuat klik pertama sengaja ditunda selama 500 ms, sehingga aplikasi terasa lambat merespons.
  - Lebih buruk lagi, jika respon server butuh waktu di atas 500 ms (misal 700 ms) dan pengguna klik lagi setelah 500 ms (karena tombol masih aktif dan belum berubah), request kedua tetap terkirim ke server saat request pertama masih berjalan. Masalah pesanan ganda tetap terjadi.
  - Tombol juga tidak di-disable dan tidak ada tulisan loading, sehingga pengguna tidak tahu prosesnya sudah berjalan atau belum.
  - Terdapat pada github di folder laporan/trace/baseline/s3
  - Dan juga pada gambar hasil_console_sebelum.png menunjukan pada produk yang sama terdeteksi terdapat 3 pesanan yang masuk.
- **Mengapa AI bisa keliru di sini:** AI hanya memberi solusi umum (template debounce) tanpa memahami siklus hidup request jaringan yang asinkron. Masalah tombol beli ini bukan soal pembatasan laju klik (*rate limiting*), melainkan butuh penguncian transaksi (*concurrency guard*) dan perubahan status tombol selama request berjalan.
- **Perbaikan yang benar menurut tim:**
  Daripada menunda klik dengan debounce, kami memasang pengunci transaksi di frontend menggunakan `Set sedangDipesan` berdasarkan ID produk. Begitu tombol diklik pertama kali, tombolnya langsung kami buat `disabled = true` dan teksnya langsung diganti jadi "Memproses…". Kalau pengguna mencoba menekan tombol lagi saat prosesnya belum selesai, klik susulan tersebut langsung kami abaikan (return). Seluruh alur ini kami bungkus dalam blok `try...finally` agar tombol otomatis aktif kembali setelah respon dari server selesai diterima. Dengan cara ini, dari 3 klik cepat secepat apa pun, server hanya memproses tepat 1 pesanan saja dan pengguna langsung mendapat kepastian visual bahwa pesanannya sedang diproses.

---

## Refleksi (maks. 200 kata)

Dalam pengerjaan tugas ini, Namun kami harus sangat berhati-hati terhadap saran teknis perbaikan performa dari AI. AI hanya membaca pola kode teks dari sebuah file tertentu dan sering kali menyarankan solusi template generik, tanpa tahu apa yang sebenarnya terjadi di runtime browser. AI tidak bisa melihat flame chart DevTools, tidak tahu antrean task di event loop, dan tidak merasakan langsung jeda interaksi pada perangkat.

Pelajaran terpenting bagi kami: **jangan langsung percaya saran optimasi AI sebelum dibuktikan dengan trace profiling sendiri**. Pemeriksaan langsung lewat DevTools tetap diperlukan agar perbaikan benar-benar menyelesaikan akar masalah tanpa merusak pengalaman pengguna
