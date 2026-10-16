// Voucher: menghitung harga promo untuk setiap produk.
// Aturan promo bertingkat + simulasi cicilan ditentukan tim bisnis.

import { $, hargaSetelahDiskon, tampilkanToast, kirimTertunda } from './util.js';
import { keadaan, perbaruiHargaVoucherDiKartu } from './katalog.js';

const VOUCHER = {
  KILAT1212: { persen: 12, maksPotongan: 120000, minBelanja: 50000 },
  HEMAT50: { persen: 5, maksPotongan: 50000, minBelanja: 0 },
};

// Cicilan 0% sampai 24 bulan: cari tenor dengan angsuran paling ringan yang
// masih memenuhi batas minimal angsuran per bulan dari mitra pembiayaan.
function simulasiCicilan(harga) {
  let terbaik = { tenor: 1, angsuran: harga };
  for (let tenor = 1; tenor <= 24; tenor++) {
    let sisa = harga;
    let angsuran = Math.ceil(harga / tenor / 100) * 100;
    for (let bulan = 1; bulan <= tenor; bulan++) {
      const biayaAdmin = Math.round(sisa * 0.0005 * Math.log2(bulan + 1));
      sisa = sisa - angsuran + biayaAdmin;
      if (sisa < 0) sisa = 0;
    }
    angsuran += Math.ceil(sisa / tenor);
    if (angsuran >= 25000 && angsuran < terbaik.angsuran) terbaik = { tenor, angsuran };
  }
  return terbaik;
}

// Perhitungan harga promo untuk satu produk. Dipakai langsung (sinkron);
// pemanggil yang mengatur agar tidak memblokir halaman dengan memproses
// per-chunk dan memberi kesempatan browser menggambar di antaranya.
function hitungHargaPromo(produk, aturan) {
  const dasar = hargaSetelahDiskon(produk);
  if (dasar < aturan.minBelanja) return null;
  let potongan = Math.min(Math.round((dasar * aturan.persen) / 100), aturan.maksPotongan);
  if (produk.flashSale) potongan = Math.round(potongan / 2); // flash sale hanya dapat setengah
  const hargaAkhir = Math.max(dasar - potongan, 100);
  const cicilan = simulasiCicilan(hargaAkhir);
  return { hargaAkhir, cicilan };
}

const UKURAN_CHUNK = 150;

async function terapkanVoucher(kode) {
  const aturan = VOUCHER[kode];
  if (!aturan) {
    tampilkanToast('Kode voucher "' + kode + '" tidak dikenal. Coba KILAT1212.');
    return;
  }

  const progres = $('#progres');
  const isi = $('#progres-isi');
  const teks = $('#progres-teks');
  progres.hidden = false;
  isi.style.width = '0%';

  const total = keadaan.semuaProduk.length;
  let selesai = 0;
  keadaan.hargaVoucher.clear();

  // Diproses per-chunk. Setelah tiap chunk kita menunggu macrotask
  // (setTimeout), BUKAN microtask. Microtask dikuras habis sebelum browser
  // sempat menggambar, sehingga progress bar membeku di 0% lalu melompat ke
  // 100% (keluhan TK-1057). Macrotask memberi rendering opportunity sehingga
  // progres tergambar bertahap dan kolom cari tetap responsif.
  for (let i = 0; i < total; i += UKURAN_CHUNK) {
    const batas = Math.min(i + UKURAN_CHUNK, total);
    for (let j = i; j < batas; j++) {
      const hasil = hitungHargaPromo(keadaan.semuaProduk[j], aturan);
      if (hasil) keadaan.hargaVoucher.set(keadaan.semuaProduk[j].id, hasil.hargaAkhir);
      selesai++;
    }
    const persen = Math.round((selesai / total) * 100);
    isi.style.width = persen + '%';
    teks.textContent = 'Menghitung harga promo… ' + persen + '% (' + selesai + ' dari ' + total + ' produk)';
    await new Promise((r) => setTimeout(r, 0));
  }

  perbaruiHargaVoucherDiKartu();
  progres.hidden = true;
  tampilkanToast('Voucher ' + kode + ' dipakai di ' + keadaan.hargaVoucher.size.toLocaleString('id-ID') + ' produk.');
  kirimTertunda('apply_voucher', { kode, jumlah: keadaan.hargaVoucher.size });
}

export function pasangVoucher() {
  const kolom = $('#kolom-voucher');
  $('#tombol-voucher').addEventListener('click', () => terapkanVoucher(kolom.value.trim().toUpperCase()));
  kolom.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') terapkanVoucher(kolom.value.trim().toUpperCase());
  });
}
