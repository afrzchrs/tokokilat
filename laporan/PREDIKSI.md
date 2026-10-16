# Log prediksi

Aturan: satu entri per masalah. Bagian **Sebelum perbaikan** harus di-commit *sebelum* commit
perbaikannya. Bagian **Sesudah perbaikan** diisi setelah pengukuran ulang. Jangan menyunting
bagian "sebelum" setelah hasilnya diketahui; bila prediksi meleset, jelaskan di bagian "sesudah".

---

## P-01: Tombol "+ Keranjang" memberikan kesan nge-freeze dan membuat UI macet (TK-1044)

**Tiket terkait:** TK-1044 (Skenario S2)
**Tanggal dan hash commit entri ini:** 10 oktober 2026

### Sebelum perbaikan

- **Yang teramati di trace (baseline):** Pas tombol "+ Keranjang" ditekan, browser langsung freeze sekitar setengah detik. Di track Interactions, balok interaksi berwarna merah dengan durasi INP sekitar 500-an ms. Di track Main, muncul Long Task berdurasi 300–400 ms. Dari tab Bottom-Up, penggunaan CPU habis didominasi oleh fungsi k dan loop f milik lacak.min.js, disusul proses JSON.parse dan JSON.stringify.
- **Dugaan mekanisme:** Dugaan kami dari sisi event loop dan rendering pipeline: saat tombol diklik, browser memasukkan handler klik sebagai sebuah task di main thread. Masalahnya, di dalam task ini JavaScript menjalankan proses yang sangat berat, yaitu membaca riwayat via JSON.parse sebesar 1 MB dan menghitung hash SDK vendor dengan perulangan 2 juta kali secara sinkron. Karena tahap JS ini memakan waktu ratusan milidetik, task tersebut berubah jadi long task yang memblokir antrean event loop. Akibatnya, browser tidak bisa masuk ke fase rendering opportunity, sehingga tahap pipeline berikutnya seperti Style, Layout, dan Paint untuk memunculkan notifikasi toast dan memperbarui badge keranjang jadi tertahan sampai task selesai. Pengguna melihat layar membeku dan mengira tombolnya macet, lalu menekannya berulang kali.10**Rencana perubahan:**
- 1. Simpan data riwayat di memori (variabel modul) supaya cuma dibaca sekali dari localStorage saat awal.
  2. Tunda proses simpan riwayat ke localStorage pakai debounce 400 ms agar penulisan data besar keluar dari alur klik.
  3. Pangkas data analitik yang dikirim: hanya kirim info penting produk, tidak perlu membawa seluruh data riwayat.
  4. Pindahkan eksekusi SDK vendor ke Web Worker (lewat Blob di util.js) dan panggil lewat setTimeout(..., 0) (kirimTertunda) agar proses hashing keluar dari antrean task klik di main thread.
- **Prediksi terukur:** Setelah perubahan, metrik INP diperkirakan turun dari sekitar 500-an ms menjadi di bawah 100 ms (aman di bawah target <= 200 ms), karena beban komputasi hash dipindahkan ke background thread sehingga tidak ada lagi long task di main thread.Perkiraan efek samping: data riwayat di localStorage ada jeda simpan sebentar kalau tab buru-buru ditutup, tapi untuk keranjang belanja harusnya tetap aman karena langsung disimpan sinkron.
- **Alternatif yang dipertimbangkan dan alasan tidak dipilih:**
  - Sempat kepikiran mau mematikan fungsi analitik atau menghapus fitur riwayat, tapi tidak boleh karena melanggar aturan tugas.
  - Mau coba pakai setTimeout biasa di main thread tanpa Web Worker, tapi pas callback dieksekusi, perulangan 2 juta hash tetap bakal membekukan antarmuka.

### Sesudah perbaikan

- **Hash commit perbaikan:** 
- **Hasil ukur (median 3 kali):** INP berhasil turun drastis sampai masuk zona hijau (jauh di bawah batas 200 ms, mencapai puluhan milidetik saja). Long task di main thread selama klik tombol hilang.
- **Prediksi vs kenyataan:** Tepat seperti dugaan awal. Penyebab utama freeze memang bukan DOM-nya, melainkan proses hashing SDK vendor yang memakan waktu di main thread. Begitu dipindah ke Web Worker, tombol langsung terasa enteng dan responsif.
- **Efek samping yang muncul:**
  Tidak ada masalah, penambahan item ke keranjang belanja tetap berjalan normal.

---

## P-02: Klik beruntun pada "Beli sekarang" membuat pesanan ganda (TK-1052)

**Tiket terkait:** TK-1052 (Skenario S3)
**Tanggal dan hash commit entri ini:** 10 Oktober 2026 

### Sebelum perbaikan

- **Yang teramati di trace (baseline):** Saat tombol "Beli sekarang" diklik 3 kali dengan cepat, di track Network terlihat ada 3 request POST /api/pesanan yang berjalan bersamaan (paralel) dengan durasi tunggu jaringan sekitar 300–500 ms. Di track Main, setiap klik memicu task pemanggilan fungsi baru. Di terminal server akhirnya muncul 3 pesanan baru untuk barang yang sama.
- **Dugaan mekanisme:** Dugaan kami dari sisi event loop: fungsi beliSekarang memakai async/await. Saat tombol diklik pertama kali, browser menjalankan task untuk memulai fungsi. Begitu sampai di baris await fetch, proses request jaringan berjalan dan kendali langsung dikembalikan ke event loop, sehingga task klik pertama selesai sambil menyisakan promise yang menunggu balasan server. Masalahnya, selama waktu tunggu jaringan ini (300–500 ms), tombol tidak di-disable dan teksnya tetap "Beli sekarang", tanpa ada umpan balik visual bahwa proses sedang berjalan. Saat pengguna menekan tombol lagi karena dikira belum masuk, browser memasukkan klik kedua dan ketiga sebagai task baru yang terpisah di antrean event loop. Karena di kode belum ada pengunci atau guard, task-task baru ini ikut menembakkan request fetch baru ke server. Begitu respons jaringan selesai, kelanjutan kodenya dieksekusi lewat antrean microtask dan akhirnya membuat 3 pesanan terpisah di server (race condition).
- **Rencana perubahan:**
  1. Pasang pengunci transaksi pakai Set (sedangDipesan) untuk menandai ID produk yang sedang diproses. Kalau ada klik susulan saat proses belum beres, langsung dibatalkan (return).
  2. Begitu tombol diklik pertama kali, langsung set disabled = true dan ubah teksnya jadi "Memproses…" agar pengguna tahu sistem sedang bekerja.
  3. Bungkus proses request dengan try...finally supaya status tombol bisa kembali normal kalau prosesnya sudah selesai (baik berhasil maupun gagal).
  4. Kirim analitik lewat worker via kirimTertunda.
- **Prediksi terukur:** Setelah perubahan, jumlah pesanan dari 3 klik cepat diperkirakan turun dari 3 pesanan menjadi tepat 1 pesanan, karena klik susulan langsung diabaikan oleh guard di frontend. Pengguna juga langsung melihat teks "Memproses…" pada frame berikutnya (< 16 ms).Perkiraan efek samping: pengguna tidak bisa beli barang yang sama berkali-kali secara instan dalam jeda waktu singkat, tapi ini memang sengaja untuk mencegah salah pencet.
- **Alternatif yang dipertimbangkan dan alasan tidak dipilih:**
  - Sempat terpikir mau pakai debounce di tombol beli, tapi tidak dipilih karena klik pertama malah tertunda, dan kalau respon server lebih lambat dari waktu debounce, pesanan ganda tetap bisa lolos.

### Sesudah perbaikan

- **Hash commit perbaikan:**
- **Hasil ukur (median 3 kali):** Saat dicoba klik cepat 3 kali, pesanan yang masuk ke server berhasil ditekan menjadi tepat 1 pesanan saja.
- **Prediksi vs kenyataan:** Dugaan kami terbukti tepat. Masalah pesanan ganda ini kuncinya ada di status tombol dan pencegahan request balapan (race condition). Begitu ada guard dan tombol langsung disabled, klik berikutnya tidak akan diproses server.
- **Efek samping yang muncul:**
  Tidak ada kendala, alur pemesanan berjalan lancar dan tombol kembali normal setelah transaksi selesai.
