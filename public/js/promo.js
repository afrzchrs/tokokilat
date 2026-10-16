// Elemen kampanye: hitung mundur, teks berjalan, dan banner promo.

import { $, el, tampilkanToast, kirimTertunda } from './util.js';

// Flash sale berakhir tengah malam nanti (waktu perangkat).
function akhirFlashSale() {
  const t = new Date();
  t.setHours(24, 0, 0, 0);
  return t.getTime();
}

const duaDigit = (n) => String(n).padStart(2, '0');

function pasangHitungMundur() {
  const akhir = akhirFlashSale();
  const awal = Date.now();
  const garis = $('#hm-garis');
  const jam = $('#hm-jam'), menit = $('#hm-menit'), detik = $('#hm-detik'), senti = $('#hm-senti');

  const rentang = akhir - awal + 1;
  const nilaiTerakhir = { jam: '', menit: '', detik: '', senti: '', rasio: -1 };

  const segarkan = () => {
    const sisa = Math.max(akhir - Date.now(), 0);
    const j = duaDigit(Math.floor(sisa / 3600000));
    const m = duaDigit(Math.floor((sisa % 3600000) / 60000));
    const d = duaDigit(Math.floor((sisa % 60000) / 1000));
    const s = duaDigit(Math.floor((sisa % 1000) / 10));
    // Tulis ke DOM hanya bila nilainya berubah (hindari kerja sia-sia).
    if (j !== nilaiTerakhir.jam) { jam.textContent = j; nilaiTerakhir.jam = j; }
    if (m !== nilaiTerakhir.menit) { menit.textContent = m; nilaiTerakhir.menit = m; }
    if (d !== nilaiTerakhir.detik) { detik.textContent = d; nilaiTerakhir.detik = d; }
    if (s !== nilaiTerakhir.senti) { senti.textContent = s; nilaiTerakhir.senti = s; }

    // Garis menyusut lewat transform: scaleX (tidak memicu layout/paint ulang).
    const rasio = Math.round((sisa / rentang) * 1000) / 1000;
    if (rasio !== nilaiTerakhir.rasio) {
      garis.style.transform = 'scaleX(' + rasio + ')';
      nilaiTerakhir.rasio = rasio;
    }
  };

  // 50 ms: perseratus detik masih terbaca, tetapi jumlah task main thread saat
  // diam turun 5x dibanding 10 ms dan tanpa reflow paksa.
  let pengatur;
  const mulai = () => { if (!pengatur) pengatur = setInterval(segarkan, 50); };
  const hentikan = () => { clearInterval(pengatur); pengatur = null; };
  document.addEventListener('visibilitychange', () => (document.hidden ? hentikan() : mulai()));
  segarkan();
  mulai();
}

// Teks berjalan kini dianimasikan CSS (lihat .berjalan-jalur di toko.css),
// sehingga bergerak di compositor thread dan tidak membebani main thread.
function pasangTeksBerjalan() {
  const teks = $('#berjalan-teks');
  if (teks && !teks.dataset.jalan) {
    teks.dataset.jalan = '1';
    teks.parentElement.classList.add('berjalan-aktif');
  }
}

async function pasangBannerPromo() {
  // Sisipkan struktur banner SECARA SINKRON (skeleton) sebelum data tiba,
  // lalu isi teksnya di tempat. Karena node & tata letaknya sudah ada lebih
  // dulu, tidak ada konten yang bergeser ketika data promo tiba (CLS ~0).
  const banner = el('section', 'promo-banner');
  const teks = el('div');
  const judul = el('h2', '', 'Memuat promo…');
  const isi = el('p', '', 'Mohon tunggu, sedang mengambil syarat dan ketentuan promo.');
  teks.append(judul, isi);
  const tombol = el('button', '', 'Lihat syarat promo');
  tombol.type = 'button';
  banner.append(teks, tombol);
  $('#utama').prepend(banner);

  const respons = await fetch('/api/promo');
  const promo = await respons.json();

  judul.textContent = promo.judul;
  isi.textContent = promo.isi;
  tombol.textContent = promo.tombol;
  tombol.addEventListener('click', () => {
    tampilkanToast('Syarat promo: berlaku 12 Desember, satu voucher per akun, tidak bisa digabung.');
    kirimTertunda('promo_click', { judul: promo.judul });
  });
}

export function pasangPromo() {
  pasangHitungMundur();
  pasangTeksBerjalan();
  pasangBannerPromo();
}
