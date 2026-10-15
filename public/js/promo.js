// Elemen kampanye: hitung mundur, teks berjalan, dan banner promo.

import { $, el, tampilkanToast } from './util.js';

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
  const wadah = $('#hitung-mundur');
  const garis = $('#hm-garis');
  const jam = $('#hm-jam'), menit = $('#hm-menit'), detik = $('#hm-detik'), senti = $('#hm-senti');

  // 10 ms supaya angka perseratus detik terlihat mulus
  setInterval(() => {
    const sisa = Math.max(akhir - Date.now(), 0);
    jam.textContent = duaDigit(Math.floor(sisa / 3600000));
    menit.textContent = duaDigit(Math.floor((sisa % 3600000) / 60000));
    detik.textContent = duaDigit(Math.floor((sisa % 60000) / 1000));
    senti.textContent = duaDigit(Math.floor((sisa % 1000) / 10));

    // garis di bawah angka menyusut mengikuti sisa waktu
    const lebarPenuh = wadah.offsetWidth;
    garis.style.width = Math.round(lebarPenuh * (sisa / (akhir - awal + 1))) + 'px';
  }, 10);
}

function pasangTeksBerjalan() {
  const teks = $('#berjalan-teks');
  let x = teks.parentElement.offsetWidth;
  setInterval(() => {
    x -= 1;
    if (x < -teks.offsetWidth) x = teks.parentElement.offsetWidth;
    teks.style.left = x + 'px';
  }, 10);
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
    if (window.Lacak) window.Lacak.kirim('promo_click', { judul: promo.judul });
  });
}

export function pasangPromo() {
  pasangHitungMundur();
  pasangTeksBerjalan();
  pasangBannerPromo();
}
