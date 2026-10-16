// Fungsi bantu yang dipakai di banyak tempat.

export const $ = (selektor, akar = document) => akar.querySelector(selektor);

export function el(tag, kelas, teks) {
  const node = document.createElement(tag);
  if (kelas) node.className = kelas;
  if (teks !== undefined) node.textContent = teks;
  return node;
}

// Dibuat sekali di scope modul. Membuat Intl.NumberFormat baru tiap panggilan
// sangat mahal (dipanggil ribuan kali saat menggambar kartu).
const PEMFORMAT_RUPIAH = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

export function formatRupiah(angka) {
  return PEMFORMAT_RUPIAH.format(angka);
}

// Menunda pemanggilan sampai tidak ada pemanggilan baru selama `jeda` ms.
// Dipakai untuk input pencarian supaya tiap huruf tidak memicu render penuh.
export function debounce(fn, jeda) {
  let pengatur;
  return function (...args) {
    clearTimeout(pengatur);
    pengatur = setTimeout(() => fn.apply(this, args), jeda);
  };
}

// Menjalankan fn paling banyak sekali per frame (rendering opportunity).
// Dipakai untuk handler gulir supaya event yang menumpuk digabung jadi satu.
export function rafThrottle(fn) {
  let menunggu = false;
  let argumenTerakhir;
  return function (...args) {
    argumenTerakhir = args;
    if (menunggu) return;
    menunggu = true;
    requestAnimationFrame(() => {
      menunggu = false;
      fn.apply(this, argumenTerakhir);
    });
  };
}

export function formatRibuan(angka) {
  if (angka >= 1000) return (Math.floor(angka / 100) / 10).toLocaleString('id-ID') + ' rb';
  return String(angka);
}

export function hargaSetelahDiskon(produk) {
  return Math.round((produk.harga * (100 - produk.diskon)) / 100 / 100) * 100;
}

// Salinan dalam (deep copy) supaya objek konfigurasi tidak termutasi.
export function salinDalam(objek) {
  return JSON.parse(JSON.stringify(objek));
}

// Pengurutan sederhana, dipakai untuk daftar pendek di bagian kaki halaman.
export function urutkanGelembung(daftar, banding) {
  const hasil = daftar.slice();
  for (let i = 0; i < hasil.length; i++) {
    for (let j = 0; j < hasil.length - i - 1; j++) {
      if (banding(hasil[j], hasil[j + 1]) > 0) {
        const tmp = hasil[j];
        hasil[j] = hasil[j + 1];
        hasil[j + 1] = tmp;
      }
    }
  }
  return hasil;
}

let pengaturWaktuToast;
export function tampilkanToast(pesan) {
  const toast = $('#toast');
  toast.textContent = pesan;
  toast.classList.add('tampil');
  clearTimeout(pengaturWaktuToast);
  pengaturWaktuToast = setTimeout(() => toast.classList.remove('tampil'), 2600);
}

// ===========================================================================
// Telemetri — semua pemanggilan SDK analitik lewat bagian ini.
//
// Akar masalah yang terukur: satu panggilan Lacak.kirim menghitung hash tetap
// 2.000.000 iterasi (lihat F=2000000 di lacak.min.js), jadi biayanya ~90 ms
// pada CPU 4x TERLEPAS dari ukuran payload, dan itu memblokir main thread.
// Karena itu SDK dijalankan di Web Worker supaya hashing keluar dari main thread.
//
// Worker dibuat dari Blob di sini, sehingga TIDAK perlu berkas terpisah. Vendor
// tetap dimuat APA ADANYA lewat importScripts, dengan URL ABSOLUT yang dihitung
// di main thread (sebab base URL worker blob adalah "blob:..." tanpa path /vendor).
//
// Selain itu: panggilan yang dipicu interaksi ditunda ke macrotask berikutnya,
// dan event impression digabung lalu dikirim sekali saat gulir berhenti.
// ===========================================================================

let pekerja = null;

// Sumber worker (dijalankan di thread terpisah). SDK vendor mengakses
// window/document/screen/navigator, jadi disediakan tiruan (shim) minimal
// sebelum SDK dimuat.
function sumberPekerja(urlVendor) {
  return [
    'self.window = self;',
    'let lokasiPath = "/";',
    'let layar = { width: 0, height: 0, colorDepth: 24 };',
    'self.document = { location: { get pathname() { return lokasiPath; } } };',
    'try {',
    '  if (typeof self.screen === "undefined") {',
    '    Object.defineProperty(self, "screen", { configurable: true, get() { return layar; } });',
    '  }',
    '} catch (e) { /* sebagian lingkungan sudah menyediakan screen */ }',
    'importScripts(' + JSON.stringify(urlVendor) + ');',
    'self.onmessage = (e) => {',
    '  const pesan = e.data || {};',
    '  if (pesan.init) {',
    '    lokasiPath = pesan.init.pathname || "/";',
    '    if (pesan.init.screen) layar = pesan.init.screen;',
    '    return;',
    '  }',
    '  if (self.Lacak) {',
    '    self.Lacak.kirim(pesan.nama, pesan.data);',
    '    self.postMessage({ terkirim: pesan.nama, total: self.Lacak.antrian.length });',
    '  }',
    '};',
    '',
  ].join('\n');
}

function inisialisasiPekerja() {
  if (pekerja) return;
  try {
    // URL absolut vendor dihitung di main thread (location asli), lalu dipakai
    // di dalam worker karena worker blob tidak punya path yang berguna.
    const urlVendor = new URL('/vendor/lacak.min.js', location.href).href;
    const blob = new Blob([sumberPekerja(urlVendor)], { type: 'application/javascript' });
    pekerja = new Worker(URL.createObjectURL(blob));
    pekerja.onerror = () => { pekerja = null; }; // fallback ke main thread
    pekerja.postMessage({
      init: {
        pathname: location.pathname,
        screen: { width: screen.width, height: screen.height, colorDepth: screen.colorDepth },
      },
    });
  } catch {
    pekerja = null;
  }
}

function kirim(nama, data) {
  if (pekerja) {
    pekerja.postMessage({ nama, data });
    return;
  }
  // Fallback: main thread (mis. Worker tidak tersedia).
  if (window.Lacak) window.Lacak.kirim(nama, data);
}

// Untuk event tunggal (search, add_to_cart, begin_checkout, apply_voucher,
// promo_click, page_view): tetap dikirim, tetapi keluar dari task interaksi.
export function kirimTertunda(nama, data) {
  setTimeout(() => kirim(nama, data), 0);
}

// --- penggabungan impresi ---
const antreanImpresi = new Set();
let pengaturImpresi = null;
let waktuFlushTerakhir = Date.now();
const JEDA_DIAM = 500;      // kirim setelah gulir berhenti sejenak
const MAKS_MENAHAN = 6000;  // jaminan: tetap dikirim minimal tiap 6 detik

export function kirimImpresi(ids) {
  if (!ids.length) return;
  for (const id of ids) antreanImpresi.add(id);
  jadwalkanImpresi();
}

function jadwalkanImpresi() {
  clearTimeout(pengaturImpresi);
  const sejakFlush = Date.now() - waktuFlushTerakhir;
  pengaturImpresi = setTimeout(flushImpresi, sejakFlush >= MAKS_MENAHAN ? 0 : JEDA_DIAM);
}

function flushImpresi() {
  if (!antreanImpresi.size) return;
  const ids = [...antreanImpresi];
  antreanImpresi.clear();
  waktuFlushTerakhir = Date.now();
  kirim('impression', { produk: ids });
}

// Jangan sampai impresi terakhir hilang saat tab disembunyikan/ditutup.
document.addEventListener('visibilitychange', () => { if (document.hidden) flushImpresi(); });
window.addEventListener('pagehide', flushImpresi);

export function mulaiTelemetri() {
  inisialisasiPekerja();
}
