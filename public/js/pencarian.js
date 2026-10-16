// Pencarian, saringan kategori, dan pengurutan.

import { $, el, debounce, hargaSetelahDiskon, kirimTertunda } from './util.js';
import { keadaan, renderProduk } from './katalog.js';

const saringan = { kata: '', kategori: 'Semua', urut: 'relevan' };

// "Sepatu Lari" == "sepatu  lari" == "SEPATU-LARI"
function normalkan(teks) {
  return teks
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// Teks pencarian tiap produk dinormalkan sekali lalu di-cache, supaya
// normalkan() (regex atas string panjang) tidak dijalankan ulang untuk
// seluruh katalog pada setiap ketikan.
const teksTernormal = new WeakMap();

function teksProduk(produk) {
  let teks = teksTernormal.get(produk);
  if (teks === undefined) {
    teks = normalkan(produk.nama + ' ' + produk.merek + ' ' + produk.kategori + ' ' + produk.kota);
    teksTernormal.set(produk, teks);
  }
  return teks;
}

function cocok(produk, kunci) {
  return kunci.split(' ').every((k) => teksProduk(produk).includes(k));
}

// Bangun indeks teks untuk seluruh katalog secara bertahap (per-chunk lewat
// macrotask). Kalau tidak, pencarian pertama menanggung normalisasi 3000 produk
// sekaligus (~40 ms, jadi ~160 ms pada CPU 4x) sehingga menjadi long task.
export function siapkanIndeks(produk) {
  let i = 0;
  const langkah = () => {
    const batas = Math.min(i + 300, produk.length);
    for (; i < batas; i++) teksProduk(produk[i]);
    if (i < produk.length) setTimeout(langkah, 0);
  };
  langkah();
}

const PEMBANDING = {
  murah: (a, b) => hargaSetelahDiskon(a) - hargaSetelahDiskon(b),
  mahal: (a, b) => hargaSetelahDiskon(b) - hargaSetelahDiskon(a),
  laris: (a, b) => b.terjual - a.terjual,
  rating: (a, b) => b.rating - a.rating || b.terjual - a.terjual,
};

export function terapkanSaringan() {
  const kunci = normalkan(saringan.kata);
  let hasil = keadaan.semuaProduk.filter((p) => {
    if (saringan.kategori !== 'Semua' && p.kategori !== saringan.kategori) return false;
    if (kunci && !cocok(p, kunci)) return false;
    return true;
  });
  if (PEMBANDING[saringan.urut]) hasil = hasil.slice().sort(PEMBANDING[saringan.urut]);
  renderProduk(hasil);

  if (kunci) kirimTertunda('search', { kata: saringan.kata, jumlah: hasil.length });
}

export function pasangPencarian() {
  const kolom = $('#kolom-cari');
  // Debounce: tiap huruf tidak lagi memicu render ulang seluruh kisi; render
  // dijalankan setelah ketikan berhenti sejenak, sehingga tiap task pendek dan
  // browser tetap punya rendering opportunity -> INP turun.
  const terapkanTertunda = debounce(() => terapkanSaringan(), 150);
  kolom.addEventListener('input', () => {
    saringan.kata = kolom.value;
    terapkanTertunda();
  });

  $('#pilih-urut').addEventListener('change', (e) => {
    saringan.urut = e.target.value;
    terapkanSaringan();
  });

  const wadah = $('#keping-kategori');
  const kategori = ['Semua', ...new Set(keadaan.semuaProduk.map((p) => p.kategori))];
  for (const nama of kategori) {
    const keping = el('button', 'keping', nama);
    keping.type = 'button';
    keping.setAttribute('aria-pressed', String(nama === 'Semua'));
    keping.addEventListener('click', () => {
      saringan.kategori = nama;
      wadah.querySelectorAll('.keping').forEach((k) => k.setAttribute('aria-pressed', String(k === keping)));
      terapkanSaringan();
    });
    wadah.append(keping);
  }
}
