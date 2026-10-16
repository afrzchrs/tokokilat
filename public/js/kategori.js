// Bagian kaki halaman: merek paling laris & kategori yang sering dibeli bersamaan.

import { $, el, urutkanGelembung } from './util.js';

export function pasangKaki(semuaProduk) {
  // --- merek paling laris ---
  const terjualPerMerek = {};
  for (const p of semuaProduk) terjualPerMerek[p.merek] = (terjualPerMerek[p.merek] || 0) + p.terjual;
  const merek = Object.keys(terjualPerMerek).map((nama) => ({ nama, terjual: terjualPerMerek[nama] }));
  const teratas = urutkanGelembung(merek, (a, b) => b.terjual - a.terjual).slice(0, 5);
  const daftarMerek = $('#merek-populer');
  for (const m of teratas) daftarMerek.append(el('li', '', m.nama + ' (' + m.terjual.toLocaleString('id-ID') + ' terjual)'));

  // --- kategori terkait ---
  // Nilai "sudahAda" pada kode lama adalah jumlah <li> yang sudah ditambahkan,
  // yang pada iterasi ke-i selalu sama dengan i. Jadi pembacaan DOM
  // (querySelectorAll di dalam loop) tidak diperlukan dan diganti dengan i,
  // sehingga hasilnya identik tanpa memaksa reflow tiap iterasi.
  const kategori = [...new Set(semuaProduk.map((p) => p.kategori))];
  const daftarTerkait = $('#kategori-terkait');
  const frag = document.createDocumentFragment();
  for (let i = 0; i < kategori.length; i++) {
    let pasangan = null;
    let skorTertinggi = -1;
    for (let j = 0; j < kategori.length; j++) {
      if (i === j) continue;
      const skor = ((kategori[i].length * 31 + kategori[j].length * 17 + i) % 97);
      if (skor > skorTertinggi) { skorTertinggi = skor; pasangan = kategori[j]; }
    }
    frag.append(el('li', '', kategori[i] + ' + ' + pasangan));
  }
  daftarTerkait.append(frag);
}
