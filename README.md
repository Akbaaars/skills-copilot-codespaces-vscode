# skills-copilot-codespaces-vscode

Script scraping lengkap berbasis Playwright untuk website yang membutuhkan login.

## Isi repo

- `scripts/scrape.js`: script utama scraping login + pagination/infinite scroll + export JSON/CSV.
- `.env.example`: template konfigurasi.
- `.github/workflows/scrape.yml`: workflow GitHub Actions untuk run manual/terjadwal.

## How to use (lokal)

### 1) Install dependency

```bash
npm install
```

### 2) Buat file konfigurasi `.env`

```bash
cp .env.example .env
```

Isi `.env` minimal:

```env
LOGIN_URL=https://domain-kamu.com/login
TARGET_URL=https://domain-kamu.com/halaman-data
SITE_USERNAME=isi-username
SITE_PASSWORD=isi-password
DATA_ITEM_SELECTOR=.selector-item-data
```

Script akan auto-load `.env` saat dijalankan.

### 3) Jalankan scraper

```bash
npm run scrape
```

Output disimpan di folder `output/` (JSON/CSV sesuai `OUTPUT_FORMAT`).

### 4) Validasi script

```bash
npm test
```

## Konfigurasi penting

- `LOGIN_URL`: URL halaman login.
- `TARGET_URL`: URL halaman target data (setelah login).
- `SITE_USERNAME`, `SITE_PASSWORD`: kredensial login (jangan hardcode di kode).
- `USERNAME_SELECTOR`, `PASSWORD_SELECTOR`, `LOGIN_SUBMIT_SELECTOR`: selector form login.
- `LOGIN_SUCCESS_SELECTOR`: elemen yang hanya muncul jika login sukses.
- `LOGIN_SUCCESS_URL_CONTAINS`: bagian URL untuk verifikasi login sukses.
- `DATA_ITEM_SELECTOR`: selector item data yang diekstrak.
- `ITEM_TEXT_SELECTOR`: selector child untuk mengambil teks item (opsional).
- `PAGINATION_NEXT_SELECTOR`: selector tombol next (opsional).
- `MAX_PAGES`: jumlah maksimal halaman.
- `INFINITE_SCROLL`: `true/false` untuk mode scroll otomatis.
- `MAX_SCROLLS`: jumlah scroll maksimal per halaman.
- `OUTPUT_FORMAT`: `json`, `csv`, atau `both`.
- `OUTPUT_BASENAME`: nama file output tanpa ekstensi, contoh `output/scrape-data`.
- `SHOW_BROWSER`: set `true` jika mau browser terlihat saat debugging.

## How to use (GitHub Actions)

Workflow: `.github/workflows/scrape.yml`

1. Masuk ke **Settings → Secrets and variables → Actions**.
2. Tambahkan secrets yang dipakai workflow:
   - `LOGIN_URL`
   - `TARGET_URL`
   - `SITE_USERNAME`
   - `SITE_PASSWORD`
   - `USERNAME_SELECTOR`
   - `PASSWORD_SELECTOR`
   - `LOGIN_SUBMIT_SELECTOR`
   - `LOGIN_SUCCESS_SELECTOR`
   - `LOGIN_SUCCESS_URL_CONTAINS`
   - `DATA_ITEM_SELECTOR`
   - `ITEM_TEXT_SELECTOR`
   - `PAGINATION_NEXT_SELECTOR`
3. Jalankan manual dari tab **Actions** (workflow dispatch), atau tunggu jadwal harian.
4. Download hasil scrape dari artifact `scrape-output`.

## Troubleshooting cepat

- Error `Missing required env vars`: cek variabel wajib di `.env`.
- Login gagal: cek selector login dan URL sukses (`LOGIN_SUCCESS_SELECTOR`/`LOGIN_SUCCESS_URL_CONTAINS`).
- Data kosong: cek `DATA_ITEM_SELECTOR` dan pastikan halaman target benar.
- Pagination berhenti: cek selector `PAGINATION_NEXT_SELECTOR` dan status tombol next.
