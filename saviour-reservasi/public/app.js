const $ = (s) => document.querySelector(s);
const rp = (n) => 'Rp ' + n.toLocaleString('id-ID');
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const waLink = (no, teks) => `https://wa.me/${no}?text=${encodeURIComponent(teks)}`;
const HINT = { Small: 'City car / hatchback', Medium: 'Sedan / SUV kompak', Large: 'SUV / MPV besar', Luxury: 'Mobil mewah', 'All Size': 'Semua ukuran', 'Medium Bike': 'Motor menengah', 'Big Bike': 'Big bike / moge' };
const KEND = { mobil: 'Mobil', motor: 'Motor' };
document.documentElement.classList.add('js');
let kategori = [], semua = [], WA = '', langkah = 1, kend = 'mobil', katDipilih = '', ukDipilih = '', plKend = 'mobil', plKat = '', pilihId = '';

const ukuranDari = (k) => [...new Set(k.paket.map((p) => p.ukuran))];
const hargaHtml = (p) => (p.hargaAkhir < p.harga ? `<s>${rp(p.harga)}</s>${rp(p.hargaAkhir)}` : rp(p.harga));
const paketDipilih = () => semua.find((x) => x.id === (document.querySelector('[name=paket]:checked') || {}).value);
function toast(html) {
  const t = document.createElement('div');
  t.className = 'toast'; t.innerHTML = html;
  $('#toasts').appendChild(t);
  setTimeout(() => t.remove(), 5000);
}

async function awal() {
  const [cfg, pl] = await Promise.all([fetch('/api/config').then((r) => r.json()), fetch('/api/pricelist').then((r) => r.json())]);
  WA = cfg.wa; kategori = pl.kategori; semua = kategori.flatMap((k) => k.paket);
  const sapa = waLink(WA, 'Halo Saviour Auto Detailing, saya ingin bertanya tentang layanan Anda.');
  $('#waFloat').href = sapa; $('#waHero').href = sapa;
  $('#kendGrid').innerHTML = Object.entries(KEND).map(([v, n], i) =>
    `<div><input type="radio" name="kend" id="kd-${v}" value="${v}" ${i === 0 ? 'checked' : ''}><label for="kd-${v}"><b>${n}</b></label></div>`).join('');
  renderLokasi(cfg); renderPriceList(); renderKategori(); renderUkuran(); renderPaket();
  const terakhir = localStorage.getItem('kodeTerakhir');
  if (terakhir) $('#kodeCek').value = terakhir;
  tampilLangkah(); ringkas();
}

/* ---------- lokasi & estimasi ---------- */
function renderLokasi(c) {
  $('#petaBox').innerHTML = `<iframe title="Peta lokasi Saviour Auto Detailing" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="https://maps.google.com/maps?q=${c.lat},${c.lng}&z=17&output=embed"></iframe>`;
  $('#btnPeta').href = c.mapsUrl;
  $('#alamatLokasi').textContent = c.alamat;
  $('#jamOps').textContent = `${c.jamBuka.replace(':', '.')} - ${c.jamTerakhir.replace(':', '.')}`;
  $('#listEstimasi').innerHTML = kategori.map((k) =>
    `<li><span>${esc(k.nama)}</span><b>${esc([...new Set(k.paket.map((p) => p.durasi))].join(' / '))}</b></li>`).join('');
}

/* ---------- price list: kendaraan -> layanan ---------- */
function renderPriceList() {
  $('#kendHarga').innerHTML = Object.entries(KEND).map(([v, n]) => `<button role="tab" aria-selected="${v === plKend}" data-kend="${v}">${n}</button>`).join('');
  const ks = kategori.filter((k) => k.kendaraan === plKend);
  if (!ks.length) { $('#tabsHarga').innerHTML = ''; $('#panelHarga').innerHTML = '<p class="kosong">Belum ada layanan di kategori ini.</p>'; return; }
  if (!ks.find((k) => k.id === plKat)) plKat = ks[0].id;
  $('#tabsHarga').innerHTML = ks.map((k) => `<button role="tab" aria-selected="${k.id === plKat}" data-k="${k.id}">${esc(k.nama)}</button>`).join('');
  const k = ks.find((x) => x.id === plKat);
  let baris = '';
  for (const u of ukuranDari(k)) {
    const ps = k.paket.filter((p) => p.ukuran === u);
    ps.forEach((p, j) => {
      const rinci = p.rincian && p.rincian.length ? `<small>${p.rincian.map(esc).join(' · ')}</small>` : '';
      baris += `<tr class="${j ? '' : 'awal'}">${j ? '' : `<td class="ukuran" rowspan="${ps.length}">${esc(u)}</td>`}<td>${esc(p.label || k.nama)}<small class="est">Estimasi ${esc(p.durasi)}</small>${rinci}</td><td class="harga">${hargaHtml(p)}${p.promoNama ? `<small class="promo">${esc(p.promoNama)}</small>` : ''}<button type="button" class="btn ghost kecil pilih" data-pesan="${esc(p.id)}">Pesan</button></td></tr>`;
    });
  }
  $('#panelHarga').innerHTML = `<div class="tbl-scroll"><table class="pl"><thead><tr><th>Model</th><th>Paket</th><th class="harga">Harga</th></tr></thead><tbody>${baris}</tbody></table></div>
    <p class="inklusi">${esc(k.inklusi)}</p><p class="catatan">Home service tersedia. Biaya dan ketersediaan dikonfirmasi oleh admin.</p>`;
}
$('#kendHarga').addEventListener('click', (e) => { if (e.target.dataset.kend) { plKend = e.target.dataset.kend; renderPriceList(); } });
$('#tabsHarga').addEventListener('click', (e) => { if (e.target.dataset.k) { plKat = e.target.dataset.k; renderPriceList(); } });

/* ---------- pemilih paket: kendaraan -> layanan -> ukuran -> paket ---------- */
function renderKategori() {
  const ks = kategori.filter((k) => k.kendaraan === kend);
  $('#katGrid').innerHTML = ks.length ? ks.map((k) => {
    const min = Math.min(...k.paket.map((p) => p.hargaAkhir));
    return `<div><input type="radio" name="kat" id="k-${k.id}" value="${k.id}" ${k.id === katDipilih ? 'checked' : ''}><label for="k-${k.id}"><b>${esc(k.nama)}</b><small>${esc(k.ringkas)}</small><em>Mulai ${rp(min)}</em></label></div>`;
  }).join('') : '<div class="kosong">Belum ada layanan untuk kendaraan ini.</div>';
}
function renderUkuran() {
  const k = kategori.find((x) => x.id === katDipilih), el = $('#ukGrid');
  if (!k) { el.style.setProperty('--n', 1); el.innerHTML = '<div class="kosong">Pilih layanan terlebih dahulu.</div>'; return; }
  const uk = ukuranDari(k);
  if (!uk.includes(ukDipilih)) ukDipilih = uk.length === 1 ? uk[0] : '';
  el.style.setProperty('--n', uk.length);
  el.innerHTML = uk.map((u) => { const id = 'u-' + u.replace(/\W/g, ''); return `<div><input type="radio" name="ukuran" id="${id}" value="${esc(u)}" ${u === ukDipilih ? 'checked' : ''}><label for="${id}"><b>${esc(u)}</b><small>${HINT[u] || ''}</small></label></div>`; }).join('');
}
function renderPaket() {
  const el = $('#paketGrid'), k = kategori.find((x) => x.id === katDipilih);
  if (!k || !ukDipilih) { el.innerHTML = `<div class="kosong">${!k ? 'Pilih layanan' : 'Pilih ukuran'} terlebih dahulu.</div>`; return; }
  const ps = k.paket.filter((p) => p.ukuran === ukDipilih);
  el.innerHTML = ps.map((p) =>
    `<div><input type="radio" name="paket" id="pk-${p.id}" value="${p.id}" ${ps.length === 1 || p.id === pilihId ? 'checked' : ''}>
     <label for="pk-${p.id}"><span><b>${esc(p.label || k.nama)}</b><small>Estimasi ${esc(p.durasi)}${p.rincian && p.rincian.length ? ' · ' + esc(p.rincian.join(' · ')) : ''}</small></span><em>${hargaHtml(p)}${p.promoNama ? `<small class="promo">${esc(p.promoNama)}</small>` : ''}</em></label></div>`).join('');
}
$('#kendGrid').addEventListener('change', (e) => { kend = e.target.value; katDipilih = ''; ukDipilih = ''; pilihId = ''; renderKategori(); renderUkuran(); renderPaket(); aturSlot(); ringkas(); });
$('#katGrid').addEventListener('change', (e) => { katDipilih = e.target.value; ukDipilih = ''; pilihId = ''; renderUkuran(); renderPaket(); aturSlot(); ringkas(); });
$('#ukGrid').addEventListener('change', (e) => { ukDipilih = e.target.value; pilihId = ''; renderPaket(); aturSlot(); ringkas(); });
$('#paketGrid').addEventListener('change', () => { aturSlot(); muatSlot(); });
$('#home').addEventListener('change', (e) => { $('#boxAlamat').hidden = !e.target.checked; });

/* ---------- jadwal: slot mengikuti durasi layanan ---------- */
function aturSlot() {
  const p = paketDipilih();
  $('#lbJam').textContent = p && p.tipe === 'hari' ? 'Jam antar kendaraan' : 'Jam datang';
  $('#infoDurasi').textContent = !p ? 'Pilih paket terlebih dahulu untuk melihat estimasi pengerjaan.'
    : p.tipe === 'hari' ? `Estimasi pengerjaan ${p.durasi}, tergantung kondisi kendaraan. Kendaraan ditinggal di bengkel, pilih jam antar.`
      : `Estimasi pengerjaan ${p.durasi}. Datang sesuai jam reservasi.`;
}
async function muatSlot() {
  const tgl = $('#tanggal').value, p = paketDipilih(), el = $('#slots');
  if (!p) { el.innerHTML = '<span class="sub">Pilih paket dulu di langkah sebelumnya.</span>'; return; }
  if (!tgl) { el.innerHTML = '<span class="sub">Pilih tanggal dulu.</span>'; return; }
  const res = await fetch(`/api/slot?tanggal=${tgl}&paket=${encodeURIComponent(p.id)}`);
  if (!res.ok) { el.innerHTML = '<span class="sub">Gagal memuat jadwal.</span>'; return; }
  const slot = await res.json();
  el.innerHTML = slot.every((s) => s.sisa <= 0)
    ? '<span class="sub">Tidak ada slot kosong pada tanggal ini. Silakan pilih tanggal lain.</span>'
    : slot.map((s, i) => `<span><input type="radio" name="jam" id="j${i}" value="${s.jam}" ${s.sisa <= 0 ? 'disabled' : ''}><label for="j${i}">${s.jam}</label></span>`).join('');
  ringkas();
}
$('#tanggal').min = new Date().toISOString().slice(0, 10);
$('#tanggal').addEventListener('change', muatSlot);

/* ---------- wizard ---------- */
function tampilLangkah() {
  document.querySelectorAll('.langkah').forEach((el) => el.classList.toggle('aktif', +el.dataset.l === langkah));
  [...$('#stepper').children].forEach((el, i) => { el.className = i + 1 === langkah ? 'aktif' : i + 1 < langkah ? 'selesai' : ''; });
  $('#btnKembali').style.visibility = langkah === 1 ? 'hidden' : 'visible';
  $('#btnLanjut').hidden = langkah === 3;
  $('#btnKirim').hidden = langkah !== 3;
}
const galat = (t) => ($('#galat').innerHTML = `<div class="pesan err">${esc(t)}</div>`);
function valid() {
  $('#galat').innerHTML = '';
  const el = document.querySelector(`.langkah[data-l="${langkah}"]`);
  for (const f of el.querySelectorAll('input[required]')) {
    if (!f.value.trim()) { f.focus(); galat(`Isi kolom "${f.labels[0].textContent}".`); return false; }
  }
  if (langkah === 1 && !/^[0-9+\-\s]{9,16}$/.test($('#telepon').value)) { galat('Nomor WhatsApp tidak valid.'); return false; }
  if (langkah === 2) {
    if (!katDipilih) { galat('Pilih layanan.'); return false; }
    if (!ukDipilih) { galat('Pilih ukuran.'); return false; }
    if (!paketDipilih()) { galat('Pilih salah satu paket.'); return false; }
  }
  return true;
}
$('#btnLanjut').onclick = () => { if (langkah < 3 && valid()) { langkah++; tampilLangkah(); aturSlot(); muatSlot(); window.scrollTo({ top: $('#reservasi').offsetTop - 70, behavior: 'smooth' }); } };
$('#btnKembali').onclick = () => { if (langkah > 1) { langkah--; tampilLangkah(); } };

/* ---------- ringkasan live ---------- */
function ringkas() {
  const f = Object.fromEntries(new FormData($('#formReservasi')));
  const p = paketDipilih();
  const baris = [['Nama', f.nama], ['Kendaraan', f.mobil], ['Layanan', p ? p.nama : ''], ['Estimasi', p ? p.durasi : ''], ['Tanggal', f.tanggal], ['Jam', f.jam]];
  $('#ringkas').innerHTML = baris.map(([k, v]) => `<dt>${k}</dt><dd>${v ? esc(v) : '-'}</dd>`).join('');
  $('#total').textContent = p ? rp(p.hargaAkhir) : '-';
}
$('#formReservasi').addEventListener('input', ringkas);
$('#formReservasi').addEventListener('change', ringkas);

/* ---------- kirim reservasi ---------- */
$('#formReservasi').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('#galat').innerHTML = '';
  const f = Object.fromEntries(new FormData(e.target));
  if (!f.tanggal || !f.jam) return galat('Pilih tanggal dan jam.');
  if (f.homeService && !(f.alamat || '').trim()) return galat('Isi alamat home service.');
  const res = await fetch('/api/reservasi', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) });
  const d = await res.json();
  if (!res.ok) { muatSlot(); return galat(d.error); }

  localStorage.setItem('kodeTerakhir', d.kode); $('#kodeCek').value = d.kode;
  const teks = `Halo Saviour Auto Detailing, saya ${d.nama}.\nSaya sudah reservasi online:\nKode: ${d.kode}\nKendaraan: ${d.mobil} (${d.plat})\nLayanan: ${d.layanan}\nJadwal: ${d.tanggal} pukul ${d.jam}\nEstimasi pengerjaan: ${d.durasi}\nEstimasi biaya: ${rp(d.harga)}${d.homeService ? '\nHome service: ' + d.alamat : ''}\nMohon konfirmasinya. Terima kasih.`;
  $('#hasil').hidden = false;
  $('#hasil').innerHTML = `<p class="eyebrow">Reservasi diterima</p><div class="kode">${esc(d.kode)}</div>
    <p>${esc(d.layanan)}<br>${esc(d.tanggal)} pukul ${esc(d.jam)} · estimasi ${esc(d.durasi)}</p>
    <p>Langkah terakhir: kirim detail ini ke admin lewat WhatsApp agar reservasi segera dikonfirmasi.</p>
    <div class="aksi"><a class="btn wa" target="_blank" rel="noopener" href="${waLink(WA, teks)}">Chat admin sekarang</a>
    <button class="btn ghost" id="salin">Salin kode</button><a class="btn ghost" href="#status">Cek status</a></div>`;
  $('#salin').onclick = () => { navigator.clipboard.writeText(d.kode); toast('Kode disalin'); };
  $('#hasil').scrollIntoView({ behavior: 'smooth' });
  e.target.reset(); kend = 'mobil'; katDipilih = ''; ukDipilih = ''; pilihId = ''; $('#boxAlamat').hidden = true;
  renderKategori(); renderUkuran(); renderPaket(); langkah = 1; tampilLangkah(); aturSlot(); ringkas();
  $('#slots').innerHTML = '<span class="sub">Pilih tanggal dulu.</span>';
});

/* ---------- cek status ---------- */
const URUTAN = ['Menunggu', 'Dikonfirmasi', 'Dikerjakan', 'Selesai'];
$('#btnCek').addEventListener('click', async () => {
  const kode = $('#kodeCek').value.trim();
  if (!kode) return;
  const res = await fetch('/api/reservasi/' + encodeURIComponent(kode));
  const d = await res.json();
  if (!res.ok) return ($('#hasilCek').innerHTML = `<div class="pesan err">${esc(d.error)}</div>`);
  const idx = URUTAN.indexOf(d.status);
  const garis = d.status === 'Dibatalkan'
    ? '<div class="pesan err">Reservasi ini dibatalkan. Hubungi admin untuk jadwal ulang.</div>'
    : `<div class="timeline">${URUTAN.map((s, i) => `<div class="${i <= idx ? 'ok' : ''}">${s}</div>`).join('')}</div>`;
  const tanya = `Halo Saviour, saya ingin menanyakan reservasi ${d.kode} atas nama ${d.nama}.`;
  $('#hasilCek').innerHTML = `<div class="pesan ok"><strong>${esc(d.kode)}</strong> - <span class="badge st-${esc(d.status)}">${esc(d.status)}</span>
    ${garis}${esc(d.nama)} | ${esc(d.mobil)} (${esc(d.plat)})<br>${esc(d.layanan)} | ${esc(d.tanggal)} pukul ${esc(d.jam)}${d.durasi ? ' | estimasi ' + esc(d.durasi) : ''} | ${rp(d.harga)}<br><br>
    <a class="btn wa kecil" target="_blank" rel="noopener" href="${waLink(WA, tanya)}">Tanya admin via WhatsApp</a></div>`;
});

/* ---------- lightbox galeri ---------- */
document.querySelectorAll('.galeri img').forEach((i) => i.addEventListener('click', () => { $('#lbImg').src = i.src; $('#lbImg').alt = i.alt; $('#lb').showModal(); }));
$('#lb').addEventListener('click', () => $('#lb').close());
$('#lbTutup').addEventListener('click', () => $('#lb').close());

/* ---------- tombol "Pesan" di price list mengisi form ---------- */
$('#panelHarga').addEventListener('click', (e) => {
  const id = e.target.dataset.pesan;
  if (!id) return;
  const p = semua.find((x) => x.id === id), k = kategori.find((x) => x.id === p.kategori);
  kend = k.kendaraan; katDipilih = p.kategori; ukDipilih = p.ukuran; pilihId = p.id;
  $('#kd-' + kend).checked = true;
  renderKategori(); renderUkuran(); renderPaket(); langkah = 1; tampilLangkah(); aturSlot(); ringkas();
  toast('Paket dipilih. Lengkapi data Anda.');
  $('#reservasi').scrollIntoView({ behavior: 'smooth' });
});

/* ---------- animasi muncul saat di-scroll & sorot navbar aktif ---------- */
const io = 'IntersectionObserver' in window ? new IntersectionObserver((es) => es.forEach((x) => { if (x.isIntersecting) { x.target.classList.add('tampil'); io.unobserve(x.target); } }), { threshold: 0.05 }) : null;
document.querySelectorAll('.reveal').forEach((el) => (io ? io.observe(el) : el.classList.add('tampil')));

const navLinks = [...document.querySelectorAll('header.nav nav a[href^="#"]')];
if ('IntersectionObserver' in window && navLinks.length) {
  const navIo = new IntersectionObserver((es) => {
    const masuk = es.find((x) => x.isIntersecting);
    if (masuk) navLinks.forEach((a) => a.classList.toggle('aktif', a.getAttribute('href') === '#' + masuk.target.id));
  }, { rootMargin: '-35% 0px -55% 0px' });
  document.querySelectorAll('main section[id]').forEach((s) => navIo.observe(s));
}

awal();
