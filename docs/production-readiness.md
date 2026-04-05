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
