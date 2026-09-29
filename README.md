# Jepang dari Nol — JFT-Basic A2 (starter VPS)

Starter proyek ini membawa HTML belajar yang sudah ada ke dalam struktur deploy Ubuntu + Docker Compose, menambahkan PWA dasar, API akun (register/login/logout), sesi server-side, PostgreSQL, dan endpoint penyimpanan progres per kategori.

> **Status:** fondasi aplikasi/deployment, bukan platform final. UI login belum disambungkan ke halaman HTML, fitur tes lengkap/audio, sinkronisasi progres dari semua quiz, reset password, rate limiting, email verifikasi, dan pengujian keamanan masih perlu dikerjakan. Service worker menyimpan shell dasar; audio dan materi dinamis belum dijamin offline. Gunakan HTTPS sebelum pemakaian publik.

## Isi
- `public/index.html` — HTML belajar dari file sebelumnya; sudah ditambahkan manifest dan registrasi service worker.
- `server.js` — Express API dan session login.
- `db/init.sql` — tabel akun dan progres.
- `docker-compose.yml` + `Dockerfile` — aplikasi dan PostgreSQL.
- `public/manifest.webmanifest`, `public/sw.js` — PWA/offline shell minimal.

## Jalankan di VPS Ubuntu (Docker)
1. Install Docker Engine dan Docker Compose plugin dari dokumentasi resmi Docker.
2. Upload dan extract folder proyek ke VPS.
3. Masuk folder proyek, lalu buat `.env`:
   ```bash
   cp .env.example .env
   ```
4. Buat password DB dan session secret acak yang panjang. Isi `.env` (DATABASE_URL harus memakai password DB yang sama dengan `POSTGRES_PASSWORD`). Contoh:
   ```bash
   openssl rand -hex 32
   ```
   Tambahkan juga `POSTGRES_PASSWORD=PASSWORD_DB_YANG_SAMA` ke `.env`, dan ubah password di `DATABASE_URL` menjadi nilai yang sama. Jangan bagikan file `.env`.
5. Jalankan:
   ```bash
   docker compose up -d --build
   docker compose ps
   docker compose logs -f app
   ```
6. Aplikasi hanya bind ke `127.0.0.1:3000`. Pasang Nginx sebagai reverse proxy ke port 3000 dan aktifkan HTTPS sebelum diakses dari internet. Jangan buka port PostgreSQL ke publik.

## API ringkas
- `GET /api/health` — cek layanan.
- `POST /api/auth/register` JSON `{ "name":"Nama", "email":"a@b.com", "password":"min 10 karakter" }`
- `POST /api/auth/login` JSON `{ "email":"a@b.com", "password":"..." }`
- `POST /api/auth/logout`
- `GET /api/auth/me` — butuh sesi login.
- `GET /api/progress` — butuh sesi login.
- `PUT /api/progress/:category` JSON `{ "completed":true, "score":8, "total":10, "details":{} }` — butuh sesi login.

Browser harus menyimpan cookie sesi dan mengirimkannya untuk request API same-origin. Tambahkan rate limiting, proteksi CSRF sesuai pola aplikasi, kebijakan privasi, backup database, serta prosedur pemulihan akun sebelum membuka pendaftaran publik.
