# Log prediksi

Aturan: satu entri per masalah. Bagian **Sebelum perbaikan** harus di-commit *sebelum* commit
perbaikannya. Bagian **Sesudah perbaikan** diisi setelah pengukuran ulang. Jangan menyunting
bagian "sebelum" setelah hasilnya diketahui; bila prediksi meleset, jelaskan di bagian "sesudah".

---

## P-01: Scroll produk patah-patah (jank) akibat forced reflow di tiap frame

**Tiket terkait:** TK-1063
**Tanggal dan hash commit entri ini:** 2026-10-16 (diisi otomatis saat commit)

### Sebelum perbaikan

- **Yang teramati di trace (baseline):** Pada skenario S5 (gulir 10 detik), terdapat banyak
  long task > 50 ms di main thread track. Flame chart menunjukkan fungsi `periksaGulir`
  dipanggil pada setiap event `scroll`, dan di dalamnya terdapat `document.querySelectorAll('.kartu')`
  diikuti langsung `getBoundingClientRect()` pada setiap kartu — keduanya membaca layout setelah
  DOM berubah sehingga browser terpaksa menghitung ulang layout secara sinkron (forced/synchronous
  reflow). Selain itu, `bar.style.width` ditulis tiap frame, yang memicu Layout dan Paint ulang.
  Durasi tiap task gulir terukur antara 80–150 ms pada CPU 4x slowdown; lebih dari 2 frame
  > 50 ms per 10 detik (target: ≤ 2).

- **Dugaan mekanisme:** Event `scroll` yang datang dari input pengguna masuk ke Task Queue.
  Handler `periksaGulir` berjalan di dalam task tersebut. Di dalam handler, `querySelectorAll`
  membaca daftar kartu (DOM read), lalu `getBoundingClientRect()` pada masing-masing kartu
  memaksa browser menyelesaikan kalkulasi Style dan Layout secara sinkron agar mengembalikan
  nilai geometri yang akurat — inilah forced synchronous layout (FSL). Karena ini terjadi di
  setiap event scroll (bisa 60+ kali/detik), layout thrashing menjadi penyebab jank.
  Selain itu, `bar.style.width = ...%` setiap frame menyentuh tahap Layout dan Paint,
  padahal perubahan lebar memaksa browser menghitung ulang ukuran elemen dan menggambar ulang.

- **Rencana perubahan:**
  1. Ganti `querySelectorAll + getBoundingClientRect` dengan `IntersectionObserver` —
     browser sendiri yang memberitahu kapan kartu masuk/keluar layar tanpa memaksa reflow.
  2. Throttle handler scroll dengan `rafThrottle` agar berjalan maksimal 1× per frame
     (rendering opportunity), menghindari penumpukan task yang tidak perlu.
  3. Ganti `bar.style.width` dengan `bar.style.transform = 'scaleX(...)'` — transform
     berjalan di Compositor thread, tidak memicu Layout maupun Paint.
  4. Cache `scrollHeight` (tinggi dokumen) dan perbarui hanya saat konten berubah,
     bukan dibaca ulang tiap frame (scrollHeight juga memaksa reflow).
  5. Gunakan `{ passive: true }` pada semua event listener scroll/touch agar browser
     tahu handler tidak memanggil `preventDefault()` dan bisa mulai scroll lebih awal.

- **Prediksi terukur:** Setelah perubahan, jumlah long task > 50 ms saat skenario S5
  turun dari rata-rata 10+ per 10 detik menjadi ≤ 2 per 10 detik. Aktivitas main thread
  saat event scroll berkurang drastis karena tidak ada lagi forced synchronous layout.
  Kemungkinan efek samping: animasi munculnya kartu bisa sedikit lebih lambat muncul
  (karena IntersectionObserver tidak sekencang getBoundingClientRect langsung), namun
  hal ini justru lebih baik karena tidak memblokir rendering.

- **Alternatif yang dipertimbangkan dan alasan tidak dipilih:**
  - Menggunakan throttle berbasis `setTimeout(fn, 16)`: kurang tepat karena setTimeout
    tidak sinkron dengan siklus rendering browser; `rafThrottle` lebih presisi karena
    terikat pada rendering opportunity frame berikutnya.
  - Menghapus animasi kartu sama sekali: melanggar aturan (fitur tidak boleh dihapus).

### Sesudah perbaikan

- **Hash commit perbaikan:** (diisi setelah commit)
- **Hasil ukur (median 3 kali):** (diisi setelah pengukuran ulang)
- **Prediksi vs kenyataan:** (diisi setelah pengukuran ulang)
- **Efek samping yang muncul:** (diisi setelah pengukuran ulang)
