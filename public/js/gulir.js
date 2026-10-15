// Perilaku saat halaman digulir: bayangan header, bar progres baca,
// tombol "Ke atas", efek kartu muncul, dan pencatatan impresi produk.

import { $ } from './util.js';

const sudahTercatat = new Set();
let pengamatKartu = null;

// Satu IntersectionObserver untuk semua kartu: memunculkan kartu (animasi)
// dan mencatat impresi saat kartu masuk layar. Ini menggantikan pemindaian
// querySelectorAll('.kartu') + getBoundingClientRect() pada tiap event gulir/render,
// yang memaksa layout sinkron (reflow) berulang saat pemuatan awal dan gulir.
function pengamatKartuSekali() {
  if (pengamatKartu) return pengamatKartu;
  pengamatKartu = new IntersectionObserver((entri) => {
    const impresiBaru = [];
    for (const e of entri) {
      if (!e.isIntersecting) continue;
      const kartu = e.target;
      if (!kartu.classList.contains('terlihat')) kartu.classList.add('terlihat');
      const id = kartu.dataset.id;
      if (id && !sudahTercatat.has(id)) {
        sudahTercatat.add(id);
        impresiBaru.push(id);
      }
      pengamatKartu.unobserve(kartu);
    }
    if (impresiBaru.length && window.Lacak) window.Lacak.kirim('impression', { produk: impresiBaru });
  }, { rootMargin: '80px 0px 80px 0px' });
  return pengamatKartu;
}

// Dipanggil katalog setiap kartu baru dibuat
export function amatiKartu(kartu) {
  pengamatKartuSekali().observe(kartu);
}

// Dipanggil katalog sebelum kisi digambar ulang
export function lupakanKartu() {
  if (pengamatKartu) { pengamatKartu.disconnect(); pengamatKartu = null; }
}

let tinggiDokumen = 0;
export function perbaruiTinggiDokumen() {
  tinggiDokumen = document.documentElement.scrollHeight - window.innerHeight;
}
window.addEventListener('resize', perbaruiTinggiDokumen, { passive: true });

export function periksaGulir() {
  const kepala = $('#kepala');
  const bar = $('#bar-gulir');
  const keAtas = $('#ke-atas');

  const y = window.scrollY;
  kepala.classList.toggle('melayang', y > 8);
  keAtas.hidden = y < 900;

  const rasio = tinggiDokumen > 0 ? y / tinggiDokumen : 0;
  bar.style.width = (rasio * 100) + '%';
}

export function pasangGulir() {
  window.addEventListener('scroll', periksaGulir);
  window.addEventListener('resize', periksaGulir);

  // Cegah "pull to refresh" tak sengaja di Android ketika pengguna sedang di puncak halaman.
  let yAwal = 0;
  const utama = $('#utama');
  utama.addEventListener('touchstart', (e) => { yAwal = e.touches[0].clientY; }, { passive: false });
  utama.addEventListener('touchmove', (e) => {
    const menarikKeBawah = e.touches[0].clientY > yAwal;
    if (window.scrollY === 0 && menarikKeBawah) e.preventDefault();
    periksaGulir();
  }, { passive: false });
  utama.addEventListener('wheel', () => { periksaGulir(); }, { passive: false });

  $('#ke-atas').addEventListener('click', () => window.scrollTo({ top: 0 }));
}
