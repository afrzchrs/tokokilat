# Log prediksi

Aturan: satu entri per masalah. Bagian **Sebelum perbaikan** harus di-commit *sebelum* commit
perbaikannya. Bagian **Sesudah perbaikan** diisi setelah pengukuran ulang. Jangan menyunting
bagian "sebelum" setelah hasilnya diketahui; bila prediksi meleset, jelaskan di bagian "sesudah".

---

## P-01: Pemblokiran Main Thread saat Penerapan Voucher dan Pencarian Produk S4

**Tiket terkait:** TK-1044
**Tanggal dan hash commit entri ini:** 10 oktober 2026

### Sebelum perbaikan

- **Yang teramati di trace (baseline):** Pengujian S4 menunjukkan INP sebesar 312 ms, 6.912 ms, dan 224 ms, dengan median 312 ms. Blocking tercatat sebesar 8.240 ms, 33.016 ms, dan 26.956 ms, dengan median 26.956 ms. Jumlah Long Task tercatat 168, 385, dan 635 kejadian, dengan median 385 kejadian. Durasi Long Task terlama masing-masing 307 ms, 5.567 ms, dan 539 ms, dengan median 539 ms.
Pada Chrome Performance, trace memperlihatkan aktivitas terapkanVoucher, perbaruiHargaVoucherDiKartu, dan renderProduk. Aktivitas tersebut terlihat pada rangkaian pekerjaan setelah interaksi klik. Namun, fungsi dominan berdasarkan Bottom-up belum dapat dipastikan dari screenshot yang tersedia.
- **Dugaan mekanisme:** Penerapan voucher diduga menjalankan perhitungan harga promo dan pembaruan kartu produk yang cukup berat pada main thread. Ketika JavaScript menjalankan task yang panjang, event loop tidak dapat memproses interaksi berikutnya atau memberikan rendering opportunity sampai pekerjaan tersebut selesai. Akibatnya, pembaruan tampilan dan respons pencarian berpotensi tertunda.
Dugaan ini perlu diverifikasi dengan melihat pemanggilan fungsi dan durasi self-time pada Bottom-up atau Call tree. Screenshot yang tersedia menunjukkan korelasi aktivitas, tetapi belum membuktikan bahwa satu fungsi tertentu merupakan satu-satunya penyebab.
- **Rencana perubahan:** Mengoptimalkan proses penerapan voucher, perhitungan harga promo, dan simulasi cicilan agar pekerjaan sinkron yang tidak diperlukan berkurang. Pembaruan antarmuka perlu tetap dilakukan secara benar agar pengguna memperoleh hasil harga dan status voucher yang sesuai.
- **Prediksi terukur:** "Setelah perubahan, [metrik] turun dari ... menjadi sekitar ..., karena ...".
  Sertakan juga prediksiSetelah perubahan, INP diprediksi turun dari median 312 ms menjadi ≤200 ms, karena berkurangnya pekerjaan yang menghambat pemrosesan interaksi pada main thread.
Blocking diprediksi turun secara signifikan dari median 26.956 ms. Jumlah Long Task juga diprediksi berkurang. Target tambahan adalah menjaga hasil perhitungan voucher tetap akurat dan pencarian produk tetap responsif.
Efek samping yang mungkin terjadi adalah waktu penyelesaian perhitungan keseluruhan dapat bertambah jika pekerjaan dipecah menjadi beberapa tahap. Jika pemrosesan dipindahkan ke worker, komunikasi pesan dan penanganan hasil asinkron juga dapat menambah kompleksitas.
- **Alternatif yang dipertimbangkan dan alasan tidak dipilih:** Alternatifnya adalah mengurangi jumlah elemen produk yang dirender atau menunda seluruh proses penerapan voucher. Pengurangan jumlah produk dapat mengubah cakupan pengujian, sedangkan menunda seluruh proses berpotensi membuat hasil voucher terlambat ditampilkan. Karena itu, optimasi proses perhitungan dan pembaruan antarmuka diprioritaskan, dengan tetap mempertahankan perilaku aplikasi.

### Sesudah perbaikan

- **Hash commit perbaikan:** 16 Oktober 2026
- **Hasil ukur (median 3 kali):** INP: 56 ms, dari 312 ms. Blocking: 11 ms, dari 26.956 ms.
Jumlah Long Task: 1 kejadian, dari 385 kejadian. Long Task terlama: 58 ms, dari 539 ms. Frame di atas 50 ms: 9 kejadian, dari 802 kejadian. Frame terburuk: 97 ms, dari 3.133 ms.
- **Prediksi vs kenyataan:** Prediksi tercapai untuk INP karena median hasil sesudah perbaikan sebesar 56 ms, di bawah target 200 ms. Blocking dan jumlah Long Task juga turun secara signifikan. Hasil ini mendukung dugaan bahwa perubahan mengurangi beban yang menghambat interaksi.
Meskipun demikian, frame terburuk pada salah satu pengujian sesudah perbaikan masih mencapai 1.630 ms. Dengan demikian, respons interaksi membaik, tetapi belum dapat disimpulkan bahwa seluruh masalah rendering telah hilang.
- **Efek samping yang muncul:** Berdasarkan metrik yang tersedia, jumlah frame di atas 50 ms masih tercatat 5–10 kejadian pada pengujian sesudah perbaikan. Hal ini menunjukkan masih terdapat aktivitas yang dapat menghasilkan frame lambat. Efek samping fungsional lain belum dapat dipastikan hanya dari screenshot dan perlu diperiksa melalui pengujian fungsional.

## P-02: Aktivitas Pemrosesan dan Rendering Berlebih saat Halaman Idle (S6)

**Tiket terkait:** TK-1070
**Tanggal dan hash commit entri ini:** 10 oktober 2026

### Sebelum perbaikan

- **Yang teramati di trace (baseline):** Halaman diduga masih menjalankan pekerjaan JavaScript dan pembaruan visual secara berulang saat tidak ada interaksi pengguna. Timer yang terlalu sering memperbarui DOM atau animasi yang memicu perubahan properti layout dapat menambah pekerjaan pada pipeline rendering.
Jika JavaScript melakukan pembaruan DOM dan membaca geometri layout secara berulang, browser dapat dipaksa menghitung ulang style dan layout. Hal tersebut berpotensi mengurangi rendering opportunity dan meningkatkan durasi frame. Mekanisme ini masih merupakan hipotesis sampai fungsi yang dominan diverifikasi melalui trace dan kode sumber.
- **Dugaan mekanisme:** Halaman diduga masih menjalankan pekerjaan JavaScript dan pembaruan visual secara berulang saat tidak ada interaksi pengguna. Timer yang terlalu sering memperbarui DOM atau animasi yang memicu perubahan properti layout dapat menambah pekerjaan pada pipeline rendering.
Jika JavaScript melakukan pembaruan DOM dan membaca geometri layout secara berulang, browser dapat dipaksa menghitung ulang style dan layout. Hal tersebut berpotensi mengurangi rendering opportunity dan meningkatkan durasi frame. Mekanisme ini masih merupakan hipotesis sampai fungsi yang dominan diverifikasi melalui trace dan kode sumber.
- **Rencana perubahan:** Mengurangi frekuensi pekerjaan timer yang tidak diperlukan dan menghindari pembaruan layout yang berulang. Untuk animasi visual, perubahan properti yang dapat ditangani lebih efisien oleh pipeline rendering dapat dipertimbangkan, selama tampilan dan perilaku tetap sesuai.
- **Prediksi terukur:** Setelah perubahan, jumlah frame di atas 50 ms diprediksi menjadi maksimal 2 kejadian dalam 10 detik, karena aktivitas yang tidak diperlukan selama halaman idle berkurang.
Jumlah Long Task dan Blocking juga diprediksi turun mendekati nol. CLS diperkirakan tetap mendekati nol karena halaman tidak seharusnya mengalami pergeseran layout yang tidak diinginkan saat idle.
Efek samping yang mungkin terjadi adalah pembaruan hitung mundur atau ticker terlihat kurang halus apabila interval pembaruannya dikurangi. Perubahan animasi juga dapat mengubah tampilan visual jika properti baru tidak menghasilkan gerakan yang setara.
- **Alternatif yang dipertimbangkan dan alasan tidak dipilih:** Alternatifnya adalah menghapus seluruh animasi dan timer promosi. Pendekatan ini dapat mengurangi aktivitas latar belakang, tetapi juga dapat menghilangkan perilaku visual yang merupakan bagian dari aplikasi. Karena itu, pengurangan pekerjaan yang tidak diperlukan lebih diprioritaskan daripada menghapus seluruh fitur promosi.

### Sesudah perbaikan

- **Hash commit perbaikan:** 26 Oktober 2026
- **Hasil ukur (median 3 kali):** Durasi rekaman: 10,30 detik, 10,12 detik, dan 10,17 detik. 
INP: 120 ms, dari 192 ms. CLS: 0, tetap 0. Jumlah Long Task: 0 kejadian, dari median 285 kejadian. Long Task terlama: 0 ms, dari median 375 ms. Blocking: 0 ms, dari median 13.562 ms. Frame di atas 50 ms: 1 kejadian pada median tiga pengujian sesudah perbaikan. Frame terburuk: 61 ms pada median tiga pengujian sesudah perbaikan.
- **Prediksi vs kenyataan:** Target jumlah frame di atas 50 ms tercapai karena median hasil sesudah perbaikan adalah 1 kejadian selama rekaman sekitar 10 detik, di bawah target maksimal 2 kejadian. Jumlah Long Task dan Blocking juga turun mendekati nol. Hasil ini mendukung hipotesis bahwa aktivitas pemrosesan dan rendering yang tidak diperlukan selama halaman idle telah berkurang.
Namun, baseline belum sepenuhnya sebanding karena durasi rekamannya berbeda-beda. Oleh karena itu, besar peningkatan jumlah frame tidak boleh disimpulkan secara pasti hanya dari perbandingan median mentah baseline dan hasil sesudah perbaikan.
- **Efek samping yang muncul:** Berdasarkan screenshot, masih terdapat satu frame di atas 50 ms pada dua dari tiga pengujian sesudah perbaikan, dengan frame terburuk 73 ms dan 61 ms. Hasil ini masih memenuhi target jumlah frame, tetapi menunjukkan bahwa aktivitas rendering sesekali tetap terjadi.
Efek samping visual atau fungsional, seperti perubahan kelancaran hitung mundur atau ticker, belum dapat dipastikan dari metrik performa saja dan perlu diperiksa melalui pengujian tampilan serta fungsi aplikasi.