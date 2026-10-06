# skills-copilot-codespaces-vscode

Template scraper berbasis Playwright untuk website yang membutuhkan login.

## Setup

1. Install dependency:

```bash
npm install
```

2. Salin contoh env:

```bash
cp .env.example .env
```

3. Isi `.env` sesuai URL, kredensial, dan selector website Anda.

## Menjalankan scraper

```bash
npm run scrape
```

Hasil scrape akan disimpan ke folder `output/` dalam format JSON/CSV sesuai `OUTPUT_FORMAT`.

## Environment variables utama

- `LOGIN_URL`: halaman login.
- `TARGET_URL`: halaman data target setelah login.
- `SITE_USERNAME`, `SITE_PASSWORD`: kredensial login (jangan hardcode di kode).
- `USERNAME_SELECTOR`, `PASSWORD_SELECTOR`, `LOGIN_SUBMIT_SELECTOR`: selector form login.
- `LOGIN_SUCCESS_SELECTOR` / `LOGIN_SUCCESS_URL_CONTAINS`: validasi login berhasil.
- `DATA_ITEM_SELECTOR`: selector item data yang akan diekstrak.
- `PAGINATION_NEXT_SELECTOR`: tombol next untuk pagination.
- `MAX_PAGES`: batas halaman yang diambil.
- `INFINITE_SCROLL`: `true`/`false` untuk mode infinite scroll.
- `OUTPUT_FORMAT`: `json`, `csv`, atau `both`.

## Otomasi terjadwal

Workflow GitHub Actions tersedia di `.github/workflows/scrape.yml` dengan jadwal harian.
Simpan nilai URL, kredensial, dan selector ke GitHub Secrets sebelum menjalankan workflow.
