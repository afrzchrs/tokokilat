# Laporan audit performa dan interaksi TokoKilat

Tim: ....  Anggota: ....  Tanggal: ....
Panjang maksimal setara 6 halaman (tidak termasuk lampiran gambar).

## 1. Ringkasan eksekutif (maks. 150 kata)

Apa masalah terbesar, apa yang dilakukan, berapa hasilnya. Tulis untuk manajer produk, bukan untuk engineer.

## 2. Lingkungan pengukuran

Spesifikasi laptop, versi Chrome, jumlah produk (`npm start` atau varian lain), tingkat throttling,
dan penyimpangan apa pun dari protokol di TUGAS.md bagian 7.

## 3. Hasil sebelum dan sesudah

| Skenario | Metrik                                        | Sebelum (median) | Sesudah (median) | Target                         | Tercapai?          |
| -------- | --------------------------------------------- | ---------------- | ---------------- | ------------------------------ | ------------------ |
| S0       | CLS                                           | 0.475            | 0.032            | <= 0,1                         | **Tercapai** |
| S0       | Jumlah permintaan gambar dalam 10 dtk pertama | 1500             |                  | sebanding dengan yang terlihat | **Tercapai** |
| S1       | INP                                           |                  |                  | <= 200 ms                      |                    |
| S1       | Long task terlama                             |                  |                  | <= 100 ms                      |                    |
| S2       | INP                                           |                  |                  | <= 200 ms                      |                    |
| S3       | Jumlah pesanan dari 3 klik                    |                  |                  | 1                              |                    |
| S4       | INP / progres tergambar bertahap?             |                  |                  |                                |                    |
| S5       | Frame > 50 ms per 10 dtk                      |                  |                  | <= 2                           |                    |
| S6       | Frame > 50 ms per 10 dtk                      |                  |                  | <= 2                           |                    |

## 4. Temuan

Ulangi blok berikut untuk tiap temuan. Urutkan berdasarkan dampak, bukan urutan tiket.

### T-01: Penanganan katalog produk tidak efisien: pembuatan kartu massal dan pemuatan gambar agresif

- **Tiket terkait:** TK-1081
- **Gejala bagi pengguna:**

  Pak Hendra (TK-1081, S0): Gambar produk lama sekali muncul (kotak abu-abu bertahan lama), terutama saat scroll cepat ke bawah, dan penggunaan kuota internet terasa sangat boros.
- **Bukti:**

  1. Pada baseline trace S0, tercatat 1.500 event `ResourceSendRequest` dengan `resourceType: "Image"`, dari `/img/p/1.svg` sampai `/img/p/1500.svg`. Waktu tunggu `Queuing and connecting` gambar mencapai puluhan detik hingga lebih dari 1 menit karena antrean jaringan jenuh.

  ![1790854407049](image/LAPORAN/1790854407049.png)
- **Akar masalah dan mekanismenya:**

  1. Pada `public/js/pencarian.js` dan `public/js/katalog.js`: Setiap ketukan huruf di kolom cari menghapus dan membangun ulang seluruh 1.500 elemen kartu produk di DOM secara sinkron, kemudian menjalankan `samakanTinggiJudul()` yang membaca `offsetHeight` lalu menulis `style.height` secara berulang (Forced Synchronous Layout / Layout Thrashing).
  2. Pada `public/js/katalog.js`: Seluruh 1.500 elemen `<img>` langsung diberi atribut `src` saat kartu dibuat tanpa atribut `loading="lazy"`. Browser langsung menembakkan 1.500 permintaan HTTP serentak, melampaui batas koneksi paralel per host (maksimal 6 koneksi pada HTTP/1.1). Akibatnya, terjadi antrean jaringan masif (*head-of-line blocking*), di mana gambar yang sedang dilihat pengguna di viewport harus mengantre di belakang ribuan gambar off-screen.
- **Kualitas yang terdampak (ISO/IEC 25010):**

  - `Performance efficiency – time behaviour`: INP melonjak hingga 3.328 ms dan gambar membutuhkan waktu > 1 menit untuk selesai diunduh.
  - `Performance efficiency – resource utilization`: Boros kuota data dan memori karena mengunduh seluruh 1.500 resource gambar sekaligus.
  - `Performance efficiency – capacity`: Aplikasi tidak mampu berskala dengan baik ketika memproses ribuan data katalog.
  - `Interaction capability – operability & user engagement`: Kolom pencarian macet saat diketik dan tampilan dipenuhi kotak abu-abu dalam waktu lama.
- **Perbaikan:**
- **Trade-off:**
- **Hasil:**

### T-07: Halaman meloncat saat pemuatan awal (Layout Shift)

- **Tiket terkait:** TK-1078.
- **Gejala bagi pengguna:**
  Kak Rara (TK-1078, S0) melaporkan bahwa ketika hendak menekan produk yang berada di posisi paling atas, halaman tiba-tiba bergeser/meloncat turun sendiri sehingga elemen yang tertekan malah menjadi banner promo.
- **Bukti:**
  Pada trace baseline S0 terdapat event `LayoutShift` dengan cumulative score sekitar 0,475. Layout shift tersebut menggeser elemen:
  `DIV class='alat-kanan'`, `P id='ringkasan' class='ringkasan'`, kartu produk teratas, dan `FOOTER class='kaki'`.

![1790854396366](image/LAPORAN/1790854396366.png)

- **Akar masalah dan mekanismenya:**
  Keping kategori dan banner promo dimuat secara asinkron. Khususnya pada `public/js/promo.js`, fungsi `pasangBannerPromo()` memanggil endpoint `/api/promo` yang memiliki latensi server ~1.800 ms.
  Setelah data promo diterima, banner disisipkan ke bagian paling atas kontainer menggunakan `$('#utama').prepend(banner);`.
  Karena kontainer `#utama` tidak memesan ruang sebelumnya (*unreserved space / unsized injection*), penyisipan elemen banner setinggi ~132px secara mendadak mendorong seluruh elemen di bawahnya (keping kategori, ringkasan, kartu produk, dan footer) ke bawah. Pergeseran mendadak setelah pemuatan awal inilah yang menghasilkan skor CLS masif sebesar 0,475 dan memicu salah klik pada target pengguna.
- **Kualitas yang terdampak (ISO/IEC 25010):**

  - `Performance efficiency – time behaviour`: Pekerjaan reflow/re-layout besar setelah response asinkron tiba.
  - `Interaction capability – user error protection`: Pengguna melakukan kesalahan klik tanpa sengaja (*accidental click*) akibat elemen berpindah posisi saat hendak disentuh.
  - `Interaction capability – operability`: Tata letak halaman tidak stabil sehingga menyulitkan navigasi.
- **Perbaikan:**
- **Trade-off:**
- **Hasil:**

## 5. Dugaan yang ternyata keliru

Dugaan dari catatan serah terima, dari tiket, atau dari tim Anda sendiri yang terbantah oleh
pengukuran. Sertakan angkanya. Bagian ini sama pentingnya dengan bagian temuan.

## 6. Yang belum beres dan rekomendasi

Masalah yang tersisa, risiko, dan usulan untuk tim lain (backend, vendor SDK, desain).

## 7. Pernyataan penggunaan AI dan pembagian kerja

Alat AI yang dipakai dan untuk apa. Kontribusi tiap anggota.
