const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'admin123'; // ganti di produksi
const DATA = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA, 'reservasi.json');
const KAT_FILE = path.join(DATA, 'katalog.json');
const STATUS = ['Menunggu', 'Dikonfirmasi', 'Dikerjakan', 'Selesai', 'Dibatalkan'];
const TIDAK_AKTIF = ['Dibatalkan', 'Selesai'];
fs.mkdirSync(DATA, { recursive: true });

/* ================= katalog awal (dipakai sekali, lalu disimpan di data/katalog.json) ================= */
function seed() {
  const kategori = [
    { id: 'carwash', kendaraan: 'mobil', nama: 'Car Wash', ringkas: 'Cuci mobil, termasuk exterior cleaning', inklusi: 'Sudah termasuk exterior cleaning.' },
    { id: 'antijamur', kendaraan: 'mobil', nama: 'Wash Anti Jamur', ringkas: 'Removing water spot', inklusi: 'Wash anti jamur, removing water spot.' },
    { id: 'interior', kendaraan: 'mobil', nama: 'Salon Interior', ringkas: 'Salon interior dan deep interior cleaning', inklusi: 'Salon Interior berlaku untuk semua ukuran mobil. Rincian Deep Interior Cleaning tercantum pada paketnya.' },
    { id: 'salon', kendaraan: 'mobil', nama: 'Salon Exterior', ringkas: 'Perawatan eksterior, termasuk mobil Luxury', inklusi: 'Tersedia juga paket Polish & Wax saja dan paket detailing lainnya. Silakan tanyakan ke admin.' },
    { id: 'detailing', kendaraan: 'mobil', nama: 'Detailing & Nano Coating', ringkas: '3 layer nano coating ceramic H9', inklusi: 'Detailing dengan 3 layer nano coating ceramic H9.' },
    { id: 'full', kendaraan: 'mobil', nama: 'Full Auto Detailing', ringkas: 'Exterior, interior, engine + 5 layers nano ceramic coating', inklusi: 'Full auto detailing (exterior, interior & engine) polish, 5 layers Nano Ceramic Coating, glass coating & interior coating.' },
    { id: 'ppf', kendaraan: 'mobil', nama: 'PPF Mobil', ringkas: 'Paint Protection Film, garansi 5 tahun', inklusi: 'Sudah termasuk coating kaca, coating lampu, coating velg, interior cleaning, engine cleaning, 3-4 step polish. Garansi 5 tahun, self healing, hydrophobic.' },
    { id: 'motor', kendaraan: 'motor', nama: 'Motor (Bikes)', ringkas: 'Detailing & polish, nano ceramic coating H9, PPF', inklusi: 'Layanan untuk motor ukuran Medium Bike dan Big Bike.' },
  ].map((k) => ({ ...k, aktif: true }));
  const paket = [];
  const JAM = { tipe: 'jam', durMin: 60, durMax: 90 }, H1 = { tipe: 'hari', durMin: 1, durMax: 1 }, H3 = { tipe: 'hari', durMin: 1, durMax: 3 };
  const seri = (k, ukuran, harga, dur, label = '', rincian = []) => ukuran.forEach((u, i) => paket.push({
    id: [k, u, label].join('-').toLowerCase().replace(/[^a-z0-9]+/g, '-'), kategori: k, ukuran: u, label, rincian, harga: harga[i], ...dur, aktif: true }));
  const UK3 = ['Small', 'Medium', 'Large'], UK4 = [...UK3, 'Luxury'], UKM = ['Medium Bike', 'Big Bike'];
  seri('carwash', UK3, [150000, 200000, 250000], JAM);
  seri('antijamur', UK4, [200000, 300000, 350000, 400000], JAM);
  seri('interior', ['All Size'], [1500000], H1, 'Salon Interior');
  seri('interior', ['All Size'], [3500000], H1, 'Deep Interior Cleaning', ['Dashboard Cleaning', 'Door Trim Cleaning', 'Dry Vacuum Interior', 'Wet Vacuum Interior', 'Floor Cleaning', 'Chassis Cleaning', 'Fogging Interior', 'Bersihkan Area Cabin', 'Masuk Minuman', 'Masuk Makanan', 'Masuk Binatang Kecoa', 'Masuk Semut', 'Masuk Binatang Tikus', 'Lepas Jok dan Lepas Karpet']);
  seri('salon', UK4, [1150000, 1450000, 1650000, 1850000], H1);
  seri('detailing', UK3, [3500000, 4500000, 5000000], H3);
  seri('full', UK4, [6700000, 8850000, 10700000, 12700000], H3);
  seri('ppf', UK3, [22000000, 24000000, 28000000], H3, 'Brand Sun Vision USA');
  seri('ppf', UK3, [24000000, 28000000, 32000000], H3, 'Brand Llumar');
  const DASAR = ['Wash Detail', 'Exterior & Engine Detailing', 'Waterspot Remover', 'Chrome Metal Detailing', 'Multi Steps Paint Correction', 'Spray Wax'];
  seri('motor', UKM, [850000, 1150000], H1, 'Detailing & Polish', DASAR);
  seri('motor', UKM, [1000000, 1300000], H1, 'Double Layer', [...DASAR, '2 Layer Nano Ceramic Coating H9']);
  seri('motor', UKM, [1500000, 1800000], H1, 'Premium Layer', [...DASAR, '3 Layer Nano Ceramic Coating H9']);
  seri('motor', UKM, [4000000, 4300000], H3, 'PPF', ['Paint Protection Film']);
  return {
    kategori, paket,
    promo: [{ id: 'promo-kemerdekaan', nama: 'Promo Kemerdekaan', persen: 17, kategori: 'ppf', mulai: '', selesai: '', aktif: false }],
    pengaturan: {
      jamBuka: '09:00', jamTerakhir: '19:00', interval: 30, bayCuci: 2, kapasitasInap: 3,
      wa: process.env.WA_ADMIN || '6281219901971',
      alamat: 'Jl. Hang Tuah I No.4, Gunung, Kebayoran Baru, Jakarta Selatan',
      mapsUrl: 'https://maps.app.goo.gl/GyxU2F6tTVNAoHm89', lat: -6.2335524, lng: 106.7971049,
    },
  };
}
let KAT;
try { KAT = JSON.parse(fs.readFileSync(KAT_FILE, 'utf8')); } catch { KAT = seed(); fs.writeFileSync(KAT_FILE, JSON.stringify(KAT, null, 2)); }

/* ================= pembantu ================= */
const baca = () => { try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch { return []; } };
const simpan = (d) => fs.writeFileSync(DB_FILE, JSON.stringify(d, null, 2));
const hm = (s) => +s.slice(0, 2) * 60 + +s.slice(3, 5);
const fm = (m) => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
const tambahHari = (tgl, n) => { const d = new Date(tgl + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
function sekarang() { // waktu Jakarta (WIB), agar benar walau server di zona waktu lain
  const s = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Jakarta' });
  return { tgl: s.slice(0, 10), menit: +s.slice(11, 13) * 60 + +s.slice(14, 16) };
}
const fmtJam = (m) => (m < 60 ? `${m} menit` : `${String(+(m / 60).toFixed(1)).replace('.', ',')} jam`);
const labelDurasi = (p) => (p.tipe === 'hari'
  ? (p.durMin === p.durMax ? `${p.durMin} hari` : `${p.durMin}–${p.durMax} hari`)
  : (p.durMin === p.durMax ? fmtJam(p.durMin) : `${fmtJam(p.durMin).replace(' jam', '')}–${fmtJam(p.durMax)}`));

function promoUntuk(p, tgl) {
  const ok = KAT.promo.filter((x) => x.aktif && (x.kategori === 'semua' || x.kategori === p.kategori) && (!x.mulai || x.mulai <= tgl) && (!x.selesai || x.selesai >= tgl));
  return ok.sort((a, b) => b.persen - a.persen)[0] || null;
}
function paketPublik(p, k, tgl) {
  const pr = promoUntuk(p, tgl);
  return {
    id: p.id, kategori: p.kategori, ukuran: p.ukuran, label: p.label, rincian: p.rincian, harga: p.harga,
    hargaAkhir: pr ? Math.round(p.harga * (1 - pr.persen / 100)) : p.harga, promoNama: pr ? `${pr.nama} ${pr.persen}%` : '',
    tipe: p.tipe, durMin: p.durMin, durMax: p.durMax, durasi: labelDurasi(p),
    nama: p.label ? `${k.nama} - ${p.label} (${p.ukuran})` : `${k.nama} (${p.ukuran})`,
  };
}
function daftarJam() {
  const c = KAT.pengaturan, r = [];
  for (let m = hm(c.jamBuka); m <= hm(c.jamTerakhir); m += c.interval) r.push(fm(m));
  return r;
}
/* ketersediaan: layanan "jam" memakai bay cuci (tumpang tindih durasi), layanan "hari" memakai kapasitas inap per hari */
function slotUntuk(tanggal, p) {
  const c = KAT.pengaturan, now = sekarang();
  const data = baca().filter((r) => !TIDAK_AKTIF.includes(r.status) && r.tanggal);
  const lewat = (j) => tanggal === now.tgl && hm(j) < now.menit + 30;
  if (p.tipe === 'jam') {
    const sama = data.filter((r) => r.tipe === 'jam' && r.tanggal === tanggal);
    return daftarJam().map((j) => {
      const s = hm(j), e = s + p.durMax;
      const pakai = sama.filter((r) => s < r.mulai + r.durMenit && r.mulai < e).length;
      return { jam: j, sisa: lewat(j) ? 0 : c.bayCuci - pakai };
    });
  }
  let terpakaiMaks = 0;
  for (let d = 0; d < p.durMax; d++) {
    const hari = tambahHari(tanggal, d);
    const n = data.filter((r) => r.tipe === 'hari' && r.tanggal <= hari && tambahHari(r.tanggal, r.hari - 1) >= hari).length;
    terpakaiMaks = Math.max(terpakaiMaks, n);
  }
  return daftarJam().map((j) => ({ jam: j, sisa: lewat(j) ? 0 : c.kapasitasInap - terpakaiMaks }));
}

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

/* ================= API publik ================= */
app.get('/api/config', (req, res) => {
  const { wa, alamat, mapsUrl, lat, lng, jamBuka, jamTerakhir } = KAT.pengaturan;
  res.json({ wa, alamat, mapsUrl, lat, lng, jamBuka, jamTerakhir });
});

app.get('/api/pricelist', (req, res) => {
  const tgl = sekarang().tgl;
  res.json({
    kategori: KAT.kategori.filter((k) => k.aktif).map((k) => ({
      id: k.id, kendaraan: k.kendaraan, nama: k.nama, ringkas: k.ringkas, inklusi: k.inklusi,
      paket: KAT.paket.filter((p) => p.kategori === k.id && p.aktif).map((p) => paketPublik(p, k, tgl)),
    })).filter((k) => k.paket.length),
  });
});

app.get('/api/slot', (req, res) => {
  const p = KAT.paket.find((x) => x.id === req.query.paket && x.aktif);
  if (!p || !/^\d{4}-\d{2}-\d{2}$/.test(req.query.tanggal || '')) return res.status(400).json({ error: 'Data tidak valid.' });
  res.json(slotUntuk(req.query.tanggal, p));
});

const percobaan = new Map();
app.post('/api/reservasi', (req, res) => {
  const ip = req.ip || 'x', t = Date.now();
  const riwayat = (percobaan.get(ip) || []).filter((x) => t - x < 600000);
  if (riwayat.length >= 6) return res.status(429).json({ error: 'Terlalu banyak permintaan. Coba lagi beberapa menit lagi.' });
  riwayat.push(t); percobaan.set(ip, riwayat);

  const b = req.body || {};
  for (const f of ['nama', 'telepon', 'mobil', 'plat', 'paket', 'tanggal', 'jam']) {
    if (!b[f] || !String(b[f]).trim()) return res.status(400).json({ error: `Kolom "${f}" wajib diisi.` });
  }
  if (!/^[0-9+\-\s]{9,16}$/.test(b.telepon)) return res.status(400).json({ error: 'Nomor telepon tidak valid.' });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b.tanggal)) return res.status(400).json({ error: 'Tanggal tidak valid.' });
  const p = KAT.paket.find((x) => x.id === b.paket && x.aktif);
  const k = p && KAT.kategori.find((x) => x.id === p.kategori && x.aktif);
  if (!p || !k) return res.status(400).json({ error: 'Paket tidak ditemukan.' });
  if (b.homeService && !String(b.alamat || '').trim()) return res.status(400).json({ error: 'Alamat home service wajib diisi.' });
  const now = sekarang();
  if (b.tanggal < now.tgl) return res.status(400).json({ error: 'Tanggal tidak boleh di masa lalu.' });
  const slot = slotUntuk(b.tanggal, p).find((s) => s.jam === b.jam);
  if (!slot) return res.status(400).json({ error: 'Jam tidak tersedia.' });
  if (slot.sisa <= 0) return res.status(409).json({ error: 'Slot penuh atau sudah lewat, pilih jam atau tanggal lain.' });

  const h = paketPublik(p, k, now.tgl);
  const reservasi = {
    kode: 'SAV-' + crypto.randomBytes(3).toString('hex').toUpperCase(),
    nama: String(b.nama).trim().slice(0, 80), telepon: String(b.telepon).trim(), email: String(b.email || '').trim().slice(0, 80),
    mobil: String(b.mobil).trim().slice(0, 80), plat: String(b.plat).trim().toUpperCase().slice(0, 15),
    kategori: p.kategori, layanan: h.nama, ukuran: p.ukuran, merk: p.label || '-', harga: h.hargaAkhir, promo: h.promoNama,
    tipe: p.tipe, durasi: h.durasi, mulai: hm(b.jam), durMenit: p.tipe === 'jam' ? p.durMax : 0, hari: p.tipe === 'hari' ? p.durMax : 0,
    homeService: !!b.homeService, alamat: String(b.alamat || '').trim().slice(0, 200),
    tanggal: b.tanggal, jam: b.jam, catatan: String(b.catatan || '').trim().slice(0, 300), status: 'Menunggu', dibuat: new Date().toISOString(),
  };
  const data = baca(); data.push(reservasi); simpan(data);
  res.status(201).json(reservasi);
});

app.get('/api/reservasi/:kode', (req, res) => {
  const r = baca().find((x) => x.kode === req.params.kode.toUpperCase());
  if (!r) return res.status(404).json({ error: 'Kode reservasi tidak ditemukan.' });
  res.json(r);
});

/* ================= API admin ================= */
const sesi = new Set();
const auth = (req, res, next) => (sesi.has(req.headers['x-token']) ? next() : res.status(401).json({ error: 'Silakan login.' }));

app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body || {};
  if (username !== ADMIN_USER || password !== ADMIN_PASS) return res.status(401).json({ error: 'Username atau password salah.' });
  const token = crypto.randomBytes(24).toString('hex'); sesi.add(token); res.json({ token });
});
app.get('/api/admin/reservasi', auth, (req, res) => res.json(baca().sort((a, b) => (a.tanggal + a.jam).localeCompare(b.tanggal + b.jam))));
app.patch('/api/admin/reservasi/:kode', auth, (req, res) => {
  const { status } = req.body || {};
  if (!STATUS.includes(status)) return res.status(400).json({ error: 'Status tidak valid.' });
  const data = baca(), r = data.find((x) => x.kode === req.params.kode);
  if (!r) return res.status(404).json({ error: 'Data tidak ditemukan.' });
  r.status = status; simpan(data); res.json(r);
});
app.delete('/api/admin/reservasi/:kode', auth, (req, res) => {
  const data = baca(), sisa = data.filter((x) => x.kode !== req.params.kode);
  if (sisa.length === data.length) return res.status(404).json({ error: 'Data tidak ditemukan.' });
  simpan(sisa); res.json({ ok: true });
});

/* katalog: layanan, harga, durasi, promo, pengaturan (dibaca dan disimpan utuh dari dashboard admin) */
const str = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
const angka = (v, min, max, def) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def; };
const tglOk = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(v || '') ? v : '');
function bersihkan(b) {
  const kategori = (b.kategori || []).map((k) => ({ id: str(k.id, 40), kendaraan: k.kendaraan === 'motor' ? 'motor' : 'mobil', nama: str(k.nama, 80), ringkas: str(k.ringkas, 160), inklusi: str(k.inklusi, 600), aktif: k.aktif !== false })).filter((k) => k.id && k.nama);
  if (new Set(kategori.map((k) => k.id)).size !== kategori.length) throw new Error('ID kategori ganda.');
  const ids = new Set(kategori.map((k) => k.id));
  const paket = (b.paket || []).map((p) => {
    const hari = p.tipe === 'hari';
    const mn = angka(p.durMin, hari ? 1 : 15, hari ? 30 : 720, hari ? 1 : 60), mx = angka(p.durMax, hari ? 1 : 15, hari ? 30 : 720, mn);
    return { id: str(p.id, 80), kategori: str(p.kategori, 40), ukuran: str(p.ukuran, 30), label: str(p.label, 80),
      rincian: (Array.isArray(p.rincian) ? p.rincian : []).map((x) => str(x, 90)).filter(Boolean).slice(0, 30),
      harga: angka(p.harga, 0, 1e10, 0), tipe: hari ? 'hari' : 'jam', durMin: mn, durMax: Math.max(mn, mx), aktif: p.aktif !== false };
  }).filter((p) => p.id && ids.has(p.kategori) && p.ukuran && p.harga > 0);
  if (new Set(paket.map((p) => p.id)).size !== paket.length) throw new Error('ID paket ganda.');
  const promo = (b.promo || []).map((x) => ({ id: str(x.id, 40), nama: str(x.nama, 80), persen: angka(x.persen, 1, 90, 10),
    kategori: x.kategori === 'semua' || ids.has(x.kategori) ? x.kategori : 'semua', mulai: tglOk(x.mulai), selesai: tglOk(x.selesai), aktif: !!x.aktif })).filter((x) => x.id && x.nama);
  const g = b.pengaturan || {};
  const jamOk = (v, d) => (/^([01]\d|2[0-3]):[0-5]\d$/.test(v || '') ? v : d);
  const peng = {
    jamBuka: jamOk(g.jamBuka, '09:00'), jamTerakhir: jamOk(g.jamTerakhir, '19:00'), interval: [15, 30, 60].includes(+g.interval) ? +g.interval : 30,
    bayCuci: angka(g.bayCuci, 1, 20, 2), kapasitasInap: angka(g.kapasitasInap, 1, 50, 3),
    wa: String(g.wa || '').replace(/\D/g, '').slice(0, 15) || KAT.pengaturan.wa, alamat: str(g.alamat, 200), mapsUrl: str(g.mapsUrl, 300),
    lat: Number(g.lat) || KAT.pengaturan.lat, lng: Number(g.lng) || KAT.pengaturan.lng,
  };
  if (hm(peng.jamBuka) > hm(peng.jamTerakhir)) throw new Error('Jam buka harus sebelum jam terakhir.');
  return { kategori, paket, promo, pengaturan: peng };
}
app.get('/api/admin/katalog', auth, (req, res) => res.json(KAT));
app.put('/api/admin/katalog', auth, (req, res) => {
  try { KAT = bersihkan(req.body || {}); fs.writeFileSync(KAT_FILE, JSON.stringify(KAT, null, 2)); res.json(KAT); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

app.listen(PORT, '0.0.0.0', () => console.log(`Saviour Reservasi berjalan di http://localhost:${PORT}`));
