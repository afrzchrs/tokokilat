# Laporan audit performa dan interaksi TokoKilat

Tim: ....  Anggota: ....  Tanggal: ....
Panjang maksimal setara 6 halaman (tidak termasuk lampiran gambar).

## 1. Ringkasan eksekutif (maks. 150 kata)

Apa masalah terbesar, apa yang dilakukan, berapa hasilnya. Tulis untuk manajer produk, bukan untuk engineer.

## 2. Lingkungan pengukuran

| Item           | Nilai                                                         |
| -------------- | ------------------------------------------------------------- |
| Laptop         | Lenovo Idepad Slim 5i, Intel (R) Core (TM) Ultra 7,16 GB DDRS |
| Sistem operasi | Windows 11 Home (64-bit)                                      |
| Chrome         | `Google Chrome v154.0.8037.922`Incognito, tanpa ekstensi    |
| Viewport       | 412 x 915 (device toolbar)                                    |
| CPU throttling | 4x slowdown                                                   |
| Jumlah produk  | 1.500 (`npm run start:ringan`)                              |
| Pengulangan    | 3 kali per skenario, median                                   |

## 3. Hasil sebelum dan sesudah

| Skenario | Metrik                                        | Sebelum (median) | Sesudah (median) | Target                         | Tercapai? |
| -------- | --------------------------------------------- | ---------------- | ---------------- | ------------------------------ | --------- |
| S0       | CLS                                           |                  |                  | <= 0,1                         |           |
| S0       | Jumlah permintaan gambar dalam 10 dtk pertama |                  |                  | sebanding dengan yang terlihat |           |
| S1       | INP                                           |                  |                  | <= 200 ms                      |           |
| S1       | Long task terlama                             |                  |                  | <= 100 ms                      |           |
| S2       | INP                                           | 520 ms           |                  | <= 200 ms                      |           |
| S3       | Jumlah pesanan dari 3 klik                    | 3 pesanan        |                  | 1                              |           |
| S4       | INP / progres tergambar bertahap?             |                  |                  |                                |           |
| S5       | Frame > 50 ms per 10 dtk                      |                  |                  | <= 2                           |           |
| S6       | Frame > 50 ms per 10 dtk                      |                  |                  | <= 2                           |           |

## 4. Temuan

Ulangi blok berikut untuk tiap temuan. Urutkan berdasarkan dampak, bukan urutan tiket.

### T-01: [judul]

- **Tiket terkait:** ....
- **Gejala bagi pengguna:** ....
- **Bukti:** tangkapan layar flame chart beranotasi (tandai task, fungsi dominan, dan tahap pipeline).
- **Akar masalah dan mekanismenya:** berkas, fungsi, dan penjelasan menurut event loop atau rendering pipeline.
- **Kualitas yang terdampak (ISO/IEC 25010):** sub-karakteristik performance efficiency dan
  interaction capability, beserta hubungan sebab-akibatnya.
- **Perbaikan:** apa yang diubah dan mengapa itu bekerja.
- **Trade-off:** alternatif yang dipertimbangkan, harga dari pilihan Anda.
- **Hasil:** angka sebelum dan sesudah.

## 5. Dugaan yang ternyata keliru

Dugaan dari catatan serah terima, dari tiket, atau dari tim Anda sendiri yang terbantah oleh
pengukuran. Sertakan angkanya. Bagian ini sama pentingnya dengan bagian temuan.

## 6. Yang belum beres dan rekomendasi

Masalah yang tersisa, risiko, dan usulan untuk tim lain (backend, vendor SDK, desain).

## 7. Pernyataan penggunaan AI dan pembagian kerja

Alat AI yang dipakai dan untuk apa. Kontribusi tiap anggota.
