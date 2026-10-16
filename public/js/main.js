import { muatProduk, renderProduk } from './katalog.js';
import { pasangPencarian, siapkanIndeks } from './pencarian.js';
import { pasangKeranjang, siapkanRiwayatContoh } from './keranjang.js';
import { pasangVoucher } from './harga-promo.js';
import { pasangPromo } from './promo.js';
import { pasangGulir } from './gulir.js';
import { pasangKaki } from './kategori.js';
import { kirimTertunda, mulaiTelemetri } from './util.js';

async function mulai() {
  mulaiTelemetri();
  pasangPromo();
  pasangGulir();

  const produk = await muatProduk();
  siapkanRiwayatContoh(produk);

  pasangPencarian();
  pasangKeranjang();
  pasangVoucher();
  pasangKaki(produk);
  renderProduk(produk);
  siapkanIndeks(produk);

  if (window.Lacak) kirimTertunda('page_view', { halaman: 'flashsale-1212', jumlahProduk: produk.length });
}

mulai();

// Alat ukur untuk tugas: aktif jika URL diberi ?ukur=1
if (new URLSearchParams(location.search).has('ukur')) {
  import('/alat/ukur.js');
}
