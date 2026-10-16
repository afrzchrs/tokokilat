// Katalog: menyimpan data produk dan menggambar kisi kartu produk.

import { $, el, formatRupiah, formatRibuan, hargaSetelahDiskon } from './util.js';
import { tambahKeKeranjang, beliSekarang } from './keranjang.js';
import { periksaGulir, amatiKartu, lupakanKartu, perbaruiTinggiDokumen } from './gulir.js';

export const keadaan = {
  semuaProduk: [],
  ditampilkan: [],
  hargaVoucher: new Map(), // id produk -> harga setelah voucher
};

// --- penggambaran bertahap (windowing) ---
// Semua produk tetap ada di keadaan.ditampilkan dan dihitung di ringkasan,
// tetapi hanya sebagian kartu yang diletakkan di DOM. Sisa kartu ditambahkan
// ketika sentinel di ujung kisi mendekati layar. Ukuran chunk dibuat kecil (24)
// supaya tiap task pembuatan kartu tetap < 100 ms walau pada CPU 4x.
const UKURAN_CHUNK = 24;
let daftarAktif = [];
let posisiChunk = 0;
let sentinel = null;
let pengamatSentinel = null;

export async function muatProduk() {
  const respons = await fetch('/api/produk');
  keadaan.semuaProduk = await respons.json();
  return keadaan.semuaProduk;
}

function buatKartu(produk) {
  const kartu = el('article', 'kartu');
  kartu.dataset.id = produk.id;

  if (produk.flashSale) kartu.append(el('span', 'lencana-kilat', '⚡ Kilat'));

  const media = el('a', 'kartu-media');
  media.href = '#produk-' + produk.id;
  const gambar = document.createElement('img');
  gambar.src = produk.gambar;
  gambar.alt = produk.nama;
  // Muat gambar hanya ketika mendekati layar (kuota & CPU), dan beri tahu
  // browser rasio aspek (SVG server selalu 480x480) agar ruangnya sudah
  // dialokasikan sebelum gambar tiba -> tidak ada layout shift.
  gambar.loading = 'lazy';
  gambar.decoding = 'async';
  gambar.width = 480;
  gambar.height = 480;
  media.append(gambar);

  const badan = el('div', 'kartu-badan');
  const judul = el('h3', 'kartu-judul', produk.nama);
  badan.append(judul);

  const harga = el('div', 'harga');
  harga.append(el('span', 'harga-kini', formatRupiah(hargaSetelahDiskon(produk))));
  if (produk.diskon > 0) {
    harga.append(el('span', 'harga-asli', formatRupiah(produk.harga)));
    harga.append(el('span', 'harga-diskon', '-' + produk.diskon + '%'));
  }
  const hargaVoucher = keadaan.hargaVoucher.get(produk.id);
  if (hargaVoucher) harga.append(el('span', 'harga-voucher', 'Pakai voucher: ' + formatRupiah(hargaVoucher)));
  badan.append(harga);

  badan.append(el('div', 'keterangan', '★ ' + produk.rating.toLocaleString('id-ID') + ' | ' + formatRibuan(produk.terjual) + ' terjual'));
  badan.append(el('div', 'keterangan', produk.kota));

  const aksi = el('div', 'aksi');
  const tombolTambah = el('button', 'tombol-tambah', '+ Keranjang');
  tombolTambah.type = 'button';
  tombolTambah.addEventListener('click', () => tambahKeKeranjang(produk, tombolTambah));
  const tombolBeli = el('button', 'tombol-beli', 'Beli sekarang');
  tombolBeli.type = 'button';
  tombolBeli.addEventListener('click', () => beliSekarang(produk, tombolBeli));
  aksi.append(tombolTambah, tombolBeli);
  badan.append(aksi);

  kartu.append(media, badan);
  return kartu;
}

// Judul produk panjangnya beda-beda (1-3 baris). Supaya harga & tombol dalam
// satu deret sejajar rapi, tinggi judul disamakan. Cara lama mengukur tinggi
// judul lalu menulisnya ke setiap elemen (baca offsetHeight + tulis style) yang
// memaksa reflow dan memakan ~83 ms pada CPU 4x. Diganti dengan pembatasan 2
// baris lewat CSS (.kartu-judul): tinggi tetap seragam tanpa pengukuran sama
// sekali, sehingga tak ada reflow dan tak ada long task saat menggambar kartu.
function pastikanSentinel(kisi) {
  if (!sentinel) {
    sentinel = el('div', 'sentinel');
    pengamatSentinel = new IntersectionObserver((entri) => {
      if (entri.some((e) => e.isIntersecting)) { tambahChunk(); isiSampaiLayarPenuh(); }
    }, { rootMargin: '800px 0px' });
  }
  kisi.append(sentinel);
  pengamatSentinel.observe(sentinel);
}

function tambahChunk() {
  const kisi = $('#kisi');
  if (posisiChunk >= daftarAktif.length) return;
  const batas = Math.min(posisiChunk + UKURAN_CHUNK, daftarAktif.length);
  const frag = document.createDocumentFragment();
  for (; posisiChunk < batas; posisiChunk++) {
    const kartu = buatKartu(daftarAktif[posisiChunk]);
    amatiKartu(kartu);
    frag.append(kartu);
  }
  kisi.append(frag);
  if (sentinel && sentinel.parentNode === kisi) kisi.append(sentinel); // jaga sentinel di ujung
  perbaruiTinggiDokumen();
}

export function renderProduk(daftar) {
  const kisi = $('#kisi');
  keadaan.ditampilkan = daftar;
  daftarAktif = daftar;
  posisiChunk = 0;
  lupakanKartu();
  kisi.innerHTML = '';

  if (daftar.length === 0) {
    const kosong = el('div', 'kosong');
    kosong.append(el('strong', '', 'Produk tidak ditemukan.'), el('p', '', 'Periksa ejaan, atau coba kata kunci yang lebih umum seperti "sepatu" atau "serum".'));
    kisi.append(kosong);
  } else {
    pastikanSentinel(kisi);
    // Isi sampai layar terisi; sisanya ditangani pengamat sentinel saat menggulir.
    tambahChunk();
    isiSampaiLayarPenuh();
  }

  // Ringkasan selalu melaporkan jumlah hasil yang sebenarnya, bukan jumlah kartu di DOM.
  $('#ringkasan').textContent = daftar.length.toLocaleString('id-ID') + ' produk ditampilkan';
  periksaGulir();
}

// Isi sampai layar terisi. Pemeriksaan posisi sentinel dilakukan di frame
// berikutnya (requestAnimationFrame), BUKAN di dalam task render. Membaca
// getBoundingClientRect tepat setelah menambah puluhan kartu memaksa layout
// sinkron (~89 ms pada CPU 4x) dan menjadikan task render sebuah long task.
function isiSampaiLayarPenuh() {
  if (posisiChunk >= daftarAktif.length) return;
  requestAnimationFrame(() => {
    if (posisiChunk >= daftarAktif.length || !sentinel || !sentinel.isConnected) return;
    if (sentinel.getBoundingClientRect().top < window.innerHeight + 800) {
      tambahChunk();
      isiSampaiLayarPenuh();
    }
  });
}

// Perbarui harga voucher hanya pada kartu yang benar-benar ada di DOM,
// tanpa menggambar ulang seluruh kisi (yang akan membuang posisi gulir).
export function perbaruiHargaVoucherDiKartu() {
  document.querySelectorAll('.kartu').forEach((kartu) => {
    const harga = keadaan.hargaVoucher.get(Number(kartu.dataset.id));
    const baris = kartu.querySelector('.harga');
    let label = kartu.querySelector('.harga-voucher');
    if (harga) {
      if (!label) { label = el('span', 'harga-voucher'); baris.append(label); }
      label.textContent = 'Pakai voucher: ' + formatRupiah(harga);
    } else if (label) {
      label.remove();
    }
  });
}
