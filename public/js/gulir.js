// Perilaku saat halaman digulir: bayangan header, bar progres baca,
// tombol "Ke atas", efek kartu muncul, dan pencatatan impresi produk.

import { $, rafThrottle, kirimImpresi } from './util.js';

const sudahTercatat = new Set();
let pengamatKartu = null;

// Satu IntersectionObserver untuk semua kartu: memunculkan kartu (animasi)
// dan mencatat impresi saat kartu masuk layar. Ini menggantikan pemindaian
// querySelectorAll('.kartu') + getBoundingClientRect() pada tiap event gulir,
// yang memaksa layout sinkron (reflow) berulang -> penyebab gulir patah-patah.
function pengamatKartuSekali() {
  if (pengamatKartu) return pengamatKartu;
  pengamatKartu = new IntersectionObserver((entri) => {
    const impresiBaru = [];
    for (const e of entri) {
      if (!e.isIntersecting) continue; // masih di luar layar, tetap dipantau
      const kartu = e.target;
      if (!kartu.classList.contains('terlihat')) kartu.classList.add('terlihat');
      const id = kartu.dataset.id;
      if (id && !sudahTercatat.has(id)) {
        sudahTercatat.add(id);
        impresiBaru.push(id);
      }
      // Sudah pernah terlihat & tercatat -> tidak perlu dipantau lagi.
      pengamatKartu.unobserve(kartu);
    }
    if (impresiBaru.length) kirimImpresi(impresiBaru);
  }, { rootMargin: '80px 0px 80px 0px' });
  return pengamatKartu;
}

// Dipanggil katalog setiap kartu baru dibuat.
export function amatiKartu(kartu) {
  pengamatKartuSekali().observe(kartu);
}

// Dipanggil katalog sebelum kisi digambar ulang: lepaskan observer lama agar
// kartu-kartu yang dibuang tidak menumpuk sebagai target di memori.
export function lupakanKartu() {
  if (pengamatKartu) { pengamatKartu.disconnect(); pengamatKartu = null; }
}

// Bagian yang bergantung posisi gulir (header, bar baca, tombol ke atas).
// Dijalankan paling banyak sekali per frame lewat rafThrottle. Tinggi dokumen
// TIDAK dibaca tiap frame (scrollHeight memaksa reflow, ~216 ms terukur di CPU
// 4x saat gulir). Tinggi di-cache dan disegarkan hanya ketika konten berubah
// (setelah render/chunk) atau saat resize, bukan lewat timer berkala (timer
// memicu reflow saat halaman diam -> merusak S0/S6).
let tinggiDokumen = 0;
export function perbaruiTinggiDokumen() {
  tinggiDokumen = document.documentElement.scrollHeight - window.innerHeight;
}
window.addEventListener('resize', perbaruiTinggiDokumen, { passive: true });

const perbaruiBilah = rafThrottle(() => {
  const kepala = $('#kepala');
  const bar = $('#bar-gulir');
  const keAtas = $('#ke-atas');

  const y = window.scrollY;
  kepala.classList.toggle('melayang', y > 8);
  keAtas.hidden = y < 900;

  const rasio = tinggiDokumen > 0 ? y / tinggiDokumen : 0;
  // Pakai transform: scaleX (tidak memicu layout) alih-alih menulis width.
  bar.style.transform = 'scaleX(' + rasio + ')';
});

// Nama lama dipertahankan supaya pemanggil (katalog) tidak perlu diubah.
export function periksaGulir() {
  perbaruiBilah();
}

export function pasangGulir() {
  window.addEventListener('scroll', perbaruiBilah, { passive: true });
  window.addEventListener('resize', perbaruiBilah, { passive: true });
  perbaruiTinggiDokumen();

  // Cegah "pull to refresh" tak sengaja di Android ketika pengguna sedang di puncak halaman.
  let yAwal = 0;
  const utama = $('#utama');
  utama.addEventListener('touchstart', (e) => { yAwal = e.touches[0].clientY; }, { passive: true });
  utama.addEventListener('touchmove', (e) => {
    const menarikKeBawah = e.touches[0].clientY > yAwal;
    if (window.scrollY === 0 && menarikKeBawah) e.preventDefault();
  }, { passive: false });

  $('#ke-atas').addEventListener('click', () => window.scrollTo({ top: 0 }));
}
