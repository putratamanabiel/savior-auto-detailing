const $ = (s) => document.querySelector(s);
const esc = (t) => String(t == null ? '' : t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const rp = (n) => 'Rp ' + Number(n || 0).toLocaleString('id-ID');
const STATUS = ['Menunggu', 'Dikonfirmasi', 'Dikerjakan', 'Selesai', 'Dibatalkan'];
const ANGKA = ['harga', 'durMin', 'durMax', 'persen', 'bayCuci', 'kapasitasInap', 'interval', 'lat', 'lng'];
let token = sessionStorage.getItem('token'), semua = [], jumlahLama = null, kat = null, dirty = false, tab = 'reservasi';
const terbuka = new Set();
const rid = (p) => p + '-' + Math.random().toString(36).slice(2, 8);

const api = (url, opt = {}) => fetch(url, { ...opt, headers: { 'Content-Type': 'application/json', 'x-token': token || '' } });
function toast(html) { const t = document.createElement('div'); t.className = 'toast'; t.innerHTML = html; $('#toasts').appendChild(t); setTimeout(() => t.remove(), 7000); }
function tampil(login) { $('#viewLogin').hidden = login; $('#viewData').hidden = !login; $('#keluar').hidden = !login; }
function keluar() { sessionStorage.removeItem('token'); token = null; tampil(false); }
function tandai(v) { dirty = v; $('#savebar').hidden = !v; }
window.addEventListener('beforeunload', (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

/* ---------- WhatsApp ke pelanggan ---------- */
function nomorWA(t) { let n = String(t).replace(/\D/g, ''); if (n.startsWith('0')) n = '62' + n.slice(1); else if (n.startsWith('8')) n = '62' + n; return n; }
function pesan(r) {
  const awal = `Halo ${r.nama}, `, info = `Reservasi ${r.kode} (${r.layanan}, ${r.tanggal} pukul ${r.jam})`;
  const alamat = kat ? kat.pengaturan.alamat : '';
  return {
    Menunggu: `${awal}${info} sudah kami terima. Kami cek jadwalnya dulu ya, kabar selanjutnya segera kami sampaikan.`,
    Dikonfirmasi: `${awal}${info} sudah DIKONFIRMASI. Estimasi pengerjaan ${r.durasi || '-'}. Silakan datang ke ${alamat} sesuai jadwal. Terima kasih.`,
    Dikerjakan: `${awal}kendaraan ${r.mobil} (${r.plat}) sedang kami kerjakan. Reservasi ${r.kode}. Kami kabari jika sudah selesai.`,
    Selesai: `${awal}pengerjaan kendaraan ${r.mobil} (${r.plat}) sudah SELESAI dan siap diambil. Terima kasih sudah mempercayakan ke Saviour Auto Detailing.`,
    Dibatalkan: `${awal}${info} kami batalkan. Jika ingin menjadwalkan ulang, silakan balas pesan ini.`,
  }[r.status];
}
const linkWA = (r) => `https://wa.me/${nomorWA(r.telepon)}?text=${encodeURIComponent(pesan(r))}`;

/* ---------- muat data ---------- */
async function muat() {
  const [a, b] = await Promise.all([api('/api/admin/reservasi'), api('/api/admin/katalog')]);
  if (!a.ok || !b.ok) return keluar();
  semua = await a.json();
  if (!dirty) kat = await b.json();
  tampil(true);
  if (jumlahLama !== null && semua.length > jumlahLama) toast(`${semua.length - jumlahLama} reservasi baru masuk`);
  jumlahLama = semua.length;
  renderSemua();
}
function renderSemua() { renderReservasi(); renderJadwal(); if (kat && !dirty) { renderLayanan(); renderPromo(); renderPengaturan(); } }

/* ---------- tab reservasi ---------- */
function renderReservasi() {
  const hitung = (s) => semua.filter((r) => r.status === s).length;
  const omzet = semua.filter((r) => r.status === 'Selesai').reduce((a, r) => a + r.harga, 0);
  $('#stat').innerHTML = [[semua.length, 'Total reservasi'], [hitung('Menunggu'), 'Menunggu konfirmasi'], [hitung('Dikerjakan'), 'Sedang dikerjakan'], [rp(omzet), 'Pendapatan (selesai)']]
    .map(([a, b]) => `<div class="stat"><b>${a}</b><span>${b}</span></div>`).join('');
  const q = $('#cari').value.toLowerCase(), f = $('#filter').value;
  const data = semua.filter((r) => (!f || r.status === f) && (!q || [r.nama, r.kode, r.plat, r.mobil].join(' ').toLowerCase().includes(q)));
  $('#isi').innerHTML = data.map((r) => `<tr>
    <td data-label="Kode"><strong>${esc(r.kode)}</strong></td>
    <td data-label="Jadwal">${esc(r.tanggal)}<br>${esc(r.jam)}${r.durasi ? `<br><small>Estimasi ${esc(r.durasi)}</small>` : ''}</td>
    <td data-label="Pelanggan">${esc(r.nama)}<br>${esc(r.telepon)}</td>
    <td data-label="Kendaraan">${esc(r.mobil)}<br>${esc(r.plat)}</td>
    <td data-label="Layanan">${esc(r.layanan)}<br>${rp(r.harga)}${r.promo ? ` <small>(${esc(r.promo)})</small>` : ''}${r.homeService ? `<br><small>Home service: ${esc(r.alamat)}</small>` : ''}</td>
    <td data-label="Status"><select data-kode="${esc(r.kode)}" aria-label="Status ${esc(r.kode)}">${STATUS.map((s) => `<option ${s === r.status ? 'selected' : ''}>${s}</option>`).join('')}</select></td>
    <td data-label="Aksi"><div class="aksi-sel"><a class="btn wa kecil" target="_blank" rel="noopener" href="${linkWA(r)}">Chat WA</a><button class="btn ghost kecil" data-hapus="${esc(r.kode)}">Hapus</button></div></td></tr>`).join('')
    || '<tr><td colspan="7">Tidak ada data.</td></tr>';
}
$('#filter').innerHTML += STATUS.map((s) => `<option>${s}</option>`).join('');
$('#cari').oninput = renderReservasi; $('#filter').onchange = renderReservasi;
$('#isi').addEventListener('change', async (e) => {
  const kode = e.target.dataset.kode;
  if (!kode) return;
  const res = await api('/api/admin/reservasi/' + kode, { method: 'PATCH', body: JSON.stringify({ status: e.target.value }) });
  if (!res.ok) return;
  const r = await res.json(); semua[semua.findIndex((x) => x.kode === kode)] = r; renderReservasi();
  toast(`Status ${esc(r.kode)}: ${esc(r.status)}. <a target="_blank" rel="noopener" href="${linkWA(r)}">Kabari pelanggan via WA</a>`);
});
$('#isi').addEventListener('click', async (e) => {
  const k = e.target.dataset.hapus;
  if (k && confirm('Hapus reservasi ' + k + '?')) { await api('/api/admin/reservasi/' + k, { method: 'DELETE' }); muat(); }
});
$('#csv').onclick = () => {
  const kolom = ['kode', 'tanggal', 'jam', 'nama', 'telepon', 'mobil', 'plat', 'layanan', 'durasi', 'harga', 'status'];
  const baris = [kolom.join(',')].concat(semua.map((r) => kolom.map((k) => `"${String(r[k] == null ? '' : r[k]).replace(/"/g, '""')}"`).join(',')));
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([baris.join('\n')], { type: 'text/csv' }));
  a.download = 'reservasi-saviour.csv'; a.click();
};

/* ---------- tab jadwal: agenda reservasi mendatang ---------- */
function renderJadwal() {
  const hari = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' });
  const aktif = semua.filter((r) => r.tanggal >= hari && !['Dibatalkan', 'Selesai'].includes(r.status));
  const per = {};
  aktif.forEach((r) => { (per[r.tanggal] = per[r.tanggal] || []).push(r); });
  const tgl = Object.keys(per).sort();
  $('#t-jadwal').innerHTML = tgl.length ? tgl.map((t) => `<div class="agenda"><h3>${t === hari ? 'Hari ini · ' : ''}${esc(t)}</h3>${per[t].sort((a, b) => a.jam.localeCompare(b.jam)).map((r) =>
    `<div class="agenda-item"><b>${esc(r.jam)}</b><span>${esc(r.layanan)}<small>${esc(r.mobil)} (${esc(r.plat)}) · ${esc(r.nama)}${r.durasi ? ' · ' + esc(r.durasi) : ''}</small></span><span class="badge st-${esc(r.status)}">${esc(r.status)}</span></div>`).join('')}</div>`).join('')
    : '<p class="kosong">Belum ada reservasi mendatang.</p>';
}

/* ---------- tab layanan & harga ---------- */
const opt = (v, t, sel) => `<option value="${esc(v)}" ${sel ? 'selected' : ''}>${esc(t)}</option>`;
const inp = (s, i, f, v, extra = '') => `data-s="${s}" data-i="${i}" data-f="${f}" value="${esc(v)}" ${extra}`;
function paketHtml(p, pi) {
  const hari = p.tipe === 'hari', u = hari ? 'hari' : 'menit';
  return `<div class="paket-ed"><div class="grid-ed">
    <div><label>Ukuran</label><input ${inp('paket', pi, 'ukuran', p.ukuran)}></div>
    <div><label>Nama paket (boleh kosong)</label><input ${inp('paket', pi, 'label', p.label)}></div>
    <div><label>Harga (Rp)</label><input type="number" min="0" step="1000" inputmode="numeric" ${inp('paket', pi, 'harga', p.harga)}></div>
    <div><label>Jenis pengerjaan</label><select data-s="paket" data-i="${pi}" data-f="tipe">${opt('jam', 'Per jam (cuci, datang lalu pulang)', !hari)}${opt('hari', 'Per hari (kendaraan menginap)', hari)}</select></div>
    <div><label>Durasi minimal (${u})</label><input type="number" min="1" inputmode="numeric" ${inp('paket', pi, 'durMin', p.durMin)}></div>
    <div><label>Durasi maksimal (${u})</label><input type="number" min="1" inputmode="numeric" ${inp('paket', pi, 'durMax', p.durMax)}></div>
    <div class="full"><label>Rincian pekerjaan (satu per baris)</label><textarea rows="3" data-s="paket" data-i="${pi}" data-f="rincian">${esc((p.rincian || []).join('\n'))}</textarea></div>
  </div><div class="aksi-ed"><label class="cek-box"><input type="checkbox" data-s="paket" data-i="${pi}" data-f="aktif" ${p.aktif ? 'checked' : ''}> Aktif</label>
  <button class="btn ghost kecil bahaya" data-del-paket="${pi}">Hapus paket</button></div></div>`;
}
function renderLayanan() {
  $('#t-layanan').innerHTML = `<div class="bar-atas"><p class="sub">Ubah harga, durasi, dan rincian, atau tambah layanan baru. Setelah selesai tekan <b>Simpan perubahan</b>.</p><button class="btn ghost" id="addKat">+ Tambah kategori</button></div>` +
    kat.kategori.map((k, ki) => {
      const ps = kat.paket.map((p, pi) => ({ p, pi })).filter((x) => x.p.kategori === k.id);
      return `<details class="ed" data-id="${esc(k.id)}" ${terbuka.has(k.id) ? 'open' : ''}><summary><b>${esc(k.nama)}</b><small>${k.kendaraan === 'motor' ? 'Motor' : 'Mobil'} · ${ps.length} paket${k.aktif ? '' : ' · disembunyikan'}</small></summary>
      <div class="grid-ed">
        <div><label>Nama kategori</label><input ${inp('kategori', ki, 'nama', k.nama)}></div>
        <div><label>Kendaraan</label><select data-s="kategori" data-i="${ki}" data-f="kendaraan">${opt('mobil', 'Mobil', k.kendaraan === 'mobil')}${opt('motor', 'Motor', k.kendaraan === 'motor')}</select></div>
        <div class="full"><label>Ringkasan (tampil di kartu pilihan layanan)</label><input ${inp('kategori', ki, 'ringkas', k.ringkas)}></div>
        <div class="full"><label>Keterangan di bawah tabel harga</label><textarea rows="2" data-s="kategori" data-i="${ki}" data-f="inklusi">${esc(k.inklusi)}</textarea></div>
        <label class="cek-box full"><input type="checkbox" data-s="kategori" data-i="${ki}" data-f="aktif" ${k.aktif ? 'checked' : ''}> Tampilkan di web</label>
      </div>
      ${ps.map(({ p, pi }) => paketHtml(p, pi)).join('')}
      <div class="aksi-ed"><button class="btn ghost kecil" data-add-paket="${ki}">+ Tambah paket</button><button class="btn ghost kecil bahaya" data-del-kat="${ki}">Hapus kategori</button></div></details>`;
    }).join('');
}

/* ---------- tab promo ---------- */
function renderPromo() {
  $('#t-promo').innerHTML = `<div class="bar-atas"><p class="sub">Promo otomatis memotong harga di web dan di reservasi baru selama tanggalnya berlaku. Jika beberapa promo cocok, diskon terbesar yang dipakai. Kosongkan tanggal untuk promo tanpa batas waktu.</p><button class="btn ghost" id="addPromo">+ Tambah promo</button></div>` +
    (kat.promo.length ? kat.promo.map((x, i) => `<div class="paket-ed"><div class="grid-ed">
      <div><label>Nama promo</label><input ${inp('promo', i, 'nama', x.nama)}></div>
      <div><label>Diskon (%)</label><input type="number" min="1" max="90" inputmode="numeric" ${inp('promo', i, 'persen', x.persen)}></div>
      <div><label>Berlaku untuk</label><select data-s="promo" data-i="${i}" data-f="kategori">${opt('semua', 'Semua layanan', x.kategori === 'semua')}${kat.kategori.map((k) => opt(k.id, k.nama, x.kategori === k.id)).join('')}</select></div>
      <div></div>
      <div><label>Mulai</label><input type="date" ${inp('promo', i, 'mulai', x.mulai)}></div>
      <div><label>Sampai</label><input type="date" ${inp('promo', i, 'selesai', x.selesai)}></div>
    </div><div class="aksi-ed"><label class="cek-box"><input type="checkbox" data-s="promo" data-i="${i}" data-f="aktif" ${x.aktif ? 'checked' : ''}> Aktif</label><button class="btn ghost kecil bahaya" data-del-promo="${i}">Hapus promo</button></div></div>`).join('') : '<p class="kosong">Belum ada promo.</p>');
}

/* ---------- tab pengaturan ---------- */
function renderPengaturan() {
  const g = kat.pengaturan, f = (k, l, t = 'text', ex = '') => `<div><label>${l}</label><input type="${t}" ${ex} data-s="pengaturan" data-f="${k}" value="${esc(g[k])}"></div>`;
  $('#t-pengaturan').innerHTML = `<p class="sub">Jam operasional dan kapasitas menentukan slot yang tampil ke pelanggan.</p><div class="paket-ed"><div class="grid-ed">
    ${f('jamBuka', 'Jam buka (datang pertama)', 'time')}${f('jamTerakhir', 'Jam terakhir datang', 'time')}
    <div><label>Jarak antar slot</label><select data-s="pengaturan" data-f="interval">${[15, 30, 60].map((n) => opt(n, n + ' menit', g.interval === n)).join('')}</select></div>
    ${f('bayCuci', 'Jumlah mobil cuci dalam satu waktu', 'number', 'min="1" inputmode="numeric"')}
    ${f('kapasitasInap', 'Maks. kendaraan menginap per hari', 'number', 'min="1" inputmode="numeric"')}
    ${f('wa', 'Nomor WhatsApp admin (format 62...)', 'text', 'inputmode="numeric"')}
    <div class="full"><label>Alamat</label><input data-s="pengaturan" data-f="alamat" value="${esc(g.alamat)}"></div>
    <div class="full"><label>Link Google Maps</label><input data-s="pengaturan" data-f="mapsUrl" value="${esc(g.mapsUrl)}"></div>
    ${f('lat', 'Latitude peta', 'number', 'step="any"')}${f('lng', 'Longitude peta', 'number', 'step="any"')}
  </div></div>`;
}

/* ---------- penyuntingan (delegasi event) ---------- */
function ubah(t) {
  const { s, i, f } = t.dataset;
  const v = t.type === 'checkbox' ? t.checked : t.value;
  const tujuan = s === 'pengaturan' ? kat.pengaturan : kat[s][+i];
  tujuan[f] = f === 'rincian' ? v.split('\n') : ANGKA.includes(f) ? (v === '' ? '' : Number(v)) : v;
  tandai(true);
}
['#t-layanan', '#t-promo', '#t-pengaturan'].forEach((id) => {
  const el = $(id);
  el.addEventListener('input', (e) => { if (e.target.dataset.s) ubah(e.target); });
  el.addEventListener('change', (e) => {
    const t = e.target;
    if (!t.dataset.s) return;
    ubah(t);
    if (t.dataset.f === 'tipe') { const p = kat.paket[+t.dataset.i]; p.durMin = t.value === 'hari' ? 1 : 60; p.durMax = t.value === 'hari' ? 1 : 90; renderLayanan(); }
    if (t.dataset.f === 'kendaraan' || (t.dataset.s === 'kategori' && t.dataset.f === 'aktif')) renderLayanan();
  });
});
document.addEventListener('toggle', (e) => { if (e.target.matches && e.target.matches('details.ed')) { e.target.open ? terbuka.add(e.target.dataset.id) : terbuka.delete(e.target.dataset.id); } }, true);

document.addEventListener('click', (e) => {
  const d = e.target.dataset;
  if (e.target.id === 'addKat') { const k = { id: rid('k'), kendaraan: 'mobil', nama: 'Kategori baru', ringkas: '', inklusi: '', aktif: true }; kat.kategori.push(k); terbuka.add(k.id); tandai(true); renderLayanan(); }
  else if (d.addPaket !== undefined) { const k = kat.kategori[+d.addPaket]; kat.paket.push({ id: rid('p'), kategori: k.id, ukuran: 'Small', label: '', rincian: [], harga: 100000, tipe: 'jam', durMin: 60, durMax: 90, aktif: true }); terbuka.add(k.id); tandai(true); renderLayanan(); }
  else if (d.delPaket !== undefined) { if (confirm('Hapus paket ini?')) { kat.paket.splice(+d.delPaket, 1); tandai(true); renderLayanan(); } }
  else if (d.delKat !== undefined) { const k = kat.kategori[+d.delKat]; if (confirm(`Hapus kategori "${k.nama}" beserta semua paketnya?`)) { kat.kategori.splice(+d.delKat, 1); kat.paket = kat.paket.filter((p) => p.kategori !== k.id); tandai(true); renderLayanan(); renderPromo(); } }
  else if (e.target.id === 'addPromo') { kat.promo.push({ id: rid('promo'), nama: 'Promo baru', persen: 10, kategori: 'semua', mulai: '', selesai: '', aktif: false }); tandai(true); renderPromo(); }
  else if (d.delPromo !== undefined) { if (confirm('Hapus promo ini?')) { kat.promo.splice(+d.delPromo, 1); tandai(true); renderPromo(); } }
});

$('#btnSimpan').onclick = async () => {
  const res = await api('/api/admin/katalog', { method: 'PUT', body: JSON.stringify(kat) });
  const d = await res.json();
  if (!res.ok) return toast('Gagal menyimpan: ' + esc(d.error));
  kat = d; tandai(false); renderSemua(); toast('Perubahan tersimpan dan langsung tampil di web.');
};

/* ---------- tab, login ---------- */
$('#tabsAdmin').addEventListener('click', (e) => {
  const t = e.target.dataset.t;
  if (!t) return;
  tab = t;
  document.querySelectorAll('#tabsAdmin button').forEach((b) => b.setAttribute('aria-selected', b.dataset.t === t));
  ['reservasi', 'jadwal', 'layanan', 'promo', 'pengaturan'].forEach((x) => ($('#t-' + x).hidden = x !== t));
});
$('#btnLogin').onclick = async () => {
  const res = await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: $('#u').value, password: $('#p').value }) });
  const d = await res.json();
  if (!res.ok) return ($('#errLogin').innerHTML = `<div class="pesan err">${esc(d.error)}</div>`);
  token = d.token; sessionStorage.setItem('token', token); muat();
};
$('#p').addEventListener('keydown', (e) => e.key === 'Enter' && $('#btnLogin').click());
$('#keluar').onclick = (e) => { e.preventDefault(); keluar(); };

token ? muat() : tampil(false);
setInterval(() => token && muat(), 30000);
