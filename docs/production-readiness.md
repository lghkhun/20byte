# Production Readiness Checklist

Gunakan checklist ini sebelum deploy produksi.

## 1) Quality Gate Wajib

Jalankan:

```bash
npm run quality:check:production
```

Gate ini memastikan:
- lint bersih
- typecheck lolos
- build produksi lolos
- unit + integration test DB berjalan (`RUN_DB_INTEGRATION_TESTS=1`)
- cross-org write guard coverage lolos
- dependency security audit produksi bersih (`npm audit --omit=dev`)

## 2) Latency Gate (< 1 detik p95)

Pastikan server aktif, lalu jalankan:

```bash
npm run dev
AUDIT_ITERATIONS=12 AUDIT_WARMUP=3 npm run audit:fetch-latency
```

Kriteria lulus:
- seluruh endpoint audited memiliki `p95 <= 1000ms`
- report tersimpan di `output/perf/fetch-latency.latest.json`

## 3) Smoke UI Inti

Set credential smoke di env lalu jalankan:

```bash
npm run smoke:ui:full:report
```

Kriteria lulus:
- tidak ada failure di report smoke terbaru
- alur inti `inbox`, `customers`, `invoices`, `shortlinks`, `crm` terbuka normal

## 4) Security Runtime Minimum

Verifikasi:
- cookie sesi `httpOnly`, `sameSite=lax`, `secure` aktif di production
- global security headers aktif (CSP, frame deny, nosniff, referrer policy)
- mutating API ditolak jika cross-origin
- auth endpoints memiliki rate limit

## 5) Release Decision

Siap produksi jika semua poin 1-4 lulus tanpa regresi kritikal.

## 6) Docker Compose VPS Gate

Untuk deployment VPS berbasis Docker, verifikasi:

```bash
cp .env.docker.example .env
docker compose config
docker compose build
```

Kriteria lulus:
- `docker compose config` valid tanpa missing variable error
- image `web` dan `worker` bisa di-build penuh
- service `migrate` tersedia untuk menjalankan `prisma migrate deploy`
- volume runtime WhatsApp persisten (`runtime_data`) tersedia
- helper deploy shell tersedia dan lolos `sh -n scripts/deploy.sh`
- reverse proxy example tersedia untuk minimal satu opsi operator (`nginx` atau `caddy`)
- health endpoint aplikasi tersedia di `/api/health`
- auto deploy workflow GitHub ke VPS tersedia dan terdokumentasi
