# Saviour Auto Detailing - Sistem Reservasi Servis (v6)

1. Pasang Node.js LTS (nodejs.org), lalu buka terminal di folder ini.
2. `npm install`
3. `npm start`
4. Pelanggan: http://localhost:3000  |  Admin: http://localhost:3000/admin.html (admin / admin123)

Ganti pengaturan awal: `ADMIN_USER=x ADMIN_PASS=y WA_ADMIN=6281219901971 npm start`

Layanan, harga, durasi, promo, jam operasional, dan nomor WA diubah dari dashboard admin
(tab Layanan & Harga, Promo, Pengaturan). Datanya tersimpan di data/katalog.json.
Hapus file itu untuk mengembalikan katalog awal. Foto flyer ada di public/img.
