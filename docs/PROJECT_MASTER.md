# 20byte Master Document (Single Source of Truth)

Dokumen ini menggantikan seluruh dokumen lama di folder `docs/`.
Tujuannya: menyatukan konteks produk, arsitektur, operasional, status implementasi, audit terakhir, dan rencana pengembangan lanjutan dalam satu referensi.

## 1) Ringkasan Produk

20byte adalah chat-first CRM untuk bisnis jasa dengan fokus:

- Inbox WhatsApp operasional
- CRM kontekstual di sisi chat
- Invoice + bukti pembayaran
- Attribution CTWA (shortlink campaign)

Prinsip desain produk:

- Operasional harian terjadi dari workspace utama, bukan banyak dashboard terpisah.
- Alur bisnis jasa diprioritaskan (penawaran jasa, invoice bertahap, transfer manual, bukti bayar).

## 2) Keputusan MVP Aktif (Final)

### 2.1 Tenancy dan organisasi

- 1 akun OWNER hanya boleh memiliki **1 business**.
- Endpoint create business publik sudah dipensiunkan (`POST /api/orgs` return 410).
- Satu business dapat menambahkan maksimal **4 anggota non-owner**.

### 2.2 Role dan akses

Role aktif:

- `OWNER`
- `ADMIN`
- `CS`
- `ADVERTISER`

Aturan utama:

- Akses settings organisasi: `OWNER`, `ADMIN`
- Akses inbox operasional: `OWNER`, `ADMIN`, `CS`
- Lihat member list: `OWNER`, `ADMIN`
- Assign role:
  - OWNER: `ADMIN`, `CS`, `ADVERTISER`
  - ADMIN: `CS`, `ADVERTISER`

## 3) Perubahan Besar yang Sudah Diterapkan

### 3.1 Settings disederhanakan jadi satu halaman bertab

Semua pengaturan sekarang dipusatkan di:

- `/settings`

Tab aktif:

- `business`
- `team`
- `whatsapp`
- `shortlinks`
- `profile`

Route lama tetap kompatibel via redirect ke query tab:

- `/dashboard/settings/business` -> `/settings?tab=business`
- `/dashboard/settings/profile` -> `/settings?tab=profile`
- `/dashboard/settings/whatsapp` -> `/settings?tab=whatsapp`
- `/dashboard/settings/shortlinks` -> `/settings?tab=shortlinks`
- alias `/settings/*` lama juga diarahkan ke format tab.

### 3.2 Pengaturan rekening bank untuk invoice

- Rekening transfer dikelola di settings business.
- Rekening disimpan per organisasi.
- Saat draft invoice dibuat, daftar rekening disnapshot ke invoice agar histori invoice stabil walau settings berubah di masa depan.

## 4) Struktur Modul Aplikasi Saat Ini

### 4.1 Menu utama

- `Dashboard`
- `Inbox`
- `Customers`
- `Invoices`
- `CRM Pipeline`
- `Settings` (single entry)

### 4.2 Modul settings (tab)

- **Business**
  - Identitas bisnis (nama, legal, PIC, kontak, alamat)
  - Asset invoice (logo, tanda tangan)
  - Rekening bank transfer
- **Team**
  - Daftar anggota dan role
  - Tambah/update anggota by email
  - Limit maksimal 4 anggota non-owner
- **WhatsApp**
  - Status koneksi Baileys
  - QR/pairing flow
  - test message + report
- **Shortlinks**
  - Create shortlink CTWA
  - Disable shortlink
  - daftar attribution metadata
- **Profile**
  - Update nama
  - update password user

### 4.3 Modul non-settings

- **Inbox**: percakapan, assignment, status open/close, composer, quick actions.
- **CRM**: context panel, notes, tags, pipeline stage.
- **Invoices**: create/edit/send, item/milestone, mark paid, timeline, payment proof.
- **Public Invoice**: halaman publik via token.
- **Catalog**: katalog layanan untuk bantu input invoice item.
- **Storage usage**: endpoint pemakaian storage.

## 5) Arsitektur Teknis Ringkas

- Framework: Next.js App Router + API routes
- Language: TypeScript
- ORM/DB: Prisma + MySQL
- Queue/Cache: Redis
- Realtime: Ably
- WhatsApp transport: Baileys
- File storage: Cloudflare R2
- PDF invoice: PDFKit

Pola backend:

- API route tipis (auth + validasi dasar + response envelope)
- service layer untuk business logic
- Prisma transaction untuk operasi kritikal (invoice/member upsert, dll)

## 6) Data Model Inti (Prisma)

Entitas utama:

- `Org`, `OrgMember`, `User`
- `OrgBankAccount`
- `Customer`, `Conversation`, `Message`
- `CrmPipeline`, `CrmPipelineStage`
- `Invoice`, `InvoiceItem`, `PaymentMilestone`, `PaymentProof`
- `ServiceCatalogItem`
- `Shortlink`, `ShortlinkClick`
- `AuditLog`

Catatan:

- Skema sudah menyiapkan pondasi billing/plan (`OrgPlan`) untuk fase berikutnya.

## 7) Kontrak Operasional Environment

Variabel utama (lihat `.env.example`):

- `DATABASE_URL`
- `REDIS_URL`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `APP_URL`
- `ABLY_API_KEY`
- `SHORTLINK_BASE_URL`
- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET`
- `R2_PUBLIC_URL`
- `WHATSAPP_MOCK_MODE`

Aturan:

- Jangan commit kredensial real ke git.
- Gunakan `.env.example` sebagai baseline onboarding.

## 8) Quality Gate Wajib

Sebelum merge:

1. `npm run lint`
2. `npm run typecheck`
3. `npm test`
4. `npm run audit:cross-org-write-coverage`

Bundle check:

- `npm run quality:check`

## 9) Audit Terakhir (Ringkasan Menyeluruh)

Update terbaru (Maret 2026):

- Realtime token route Ably sudah diperbaiki agar kompatibel penuh dengan kontrak SDK (`tokenRequest` raw object), warning `Auth.requestToken` dan `Connection closed` di lokal sudah hilang.
- Sidebar utama sudah dirapikan: posisi `CRM Pipeline` dan `Settings` ditukar sesuai kebutuhan operasional.
- Halaman `/invoices` ditingkatkan:
  - aksi tabel menjadi real action (`Send Invoice`, `Open CRM Panel`),
  - status badge konsisten untuk light theme,
  - integrasi CRM stage otomatis saat invoice dikirim / dibayar (persist ke DB conversation).
- Filter pipeline ditingkatkan (assignee, date range), export CSV funnel+board, dan preset filter tersimpan.
- Deep-link Kanban -> Inbox sudah aktif (`/inbox?conversationId=...`).

### 9.1 Temuan yang sudah ditangani

- Settings terlalu tersebar -> sudah disatukan ke single page tab.
- Rekening bank belum terpusat di business settings -> sudah dipindah dan dirapikan.
- Informasi status aksi settings kurang konsisten -> sudah ditambah feedback sukses/error di area bank account.
- Navigasi settings terlalu ramai -> disederhanakan jadi satu entry menu.
- Batas anggota bisnis belum ditegakkan di server -> sudah enforce max 4 non-owner.

### 9.2 Risiko yang masih perlu ditutup

- Cakupan test integrasi untuk alur settings->invoice snapshot rekening masih perlu diperkuat (sebagian coverage sudah ditambah di unit-level guard + CRM sync logic).
- Standardisasi pola feedback (toast/inline/dialog) lintas fitur masih belum sepenuhnya seragam.
- Beberapa flow dialog lintas modul masih berpotensi warning aksesibilitas saat regressions UI.
- Multi-org readiness belum jadi target MVP, namun sebagian endpoint masih menerima `orgId`; perlu rencana hardening saat scale-up.

### 9.3 Dampak ke rencana sebelumnya

Rencana inti tetap sejalan:

- tetap fokus chat-first untuk bisnis jasa,
- tetap satu workspace operasional,
- tetap integrasi WhatsApp + CRM + Invoice + Attribution.

Perubahan hanya di **simplifikasi UX settings** dan **penegasan batas MVP tenancy/team**, bukan perubahan visi produk.

## 10) Roadmap Lanjutan dan Penyempurnaan

### Phase A (Stabilisasi MVP)

- Tambah integration tests untuk:
  - create member (limit 4)
  - create invoice dengan snapshot rekening
  - create/send/mark-paid invoice flow
- Satukan pattern feedback UI (success/error/loading) ke util atau design token yang konsisten. (progres: `OperationFeedback` reusable sudah dipakai di modul prioritas)
- Audit aksesibilitas dialog dan keyboard navigation untuk modal/drawer utama.
- Rapikan validasi form (email, nomor rekening, normalisasi nomor telepon) agar pesan error konsisten.

### Phase B (Operasional dan Observability)

- Tambah metrics operasional:
  - error rate endpoint utama
  - median response time
  - queue lag worker
- Tambah audit-log granuler untuk operasi settings penting (member role change, bank account change, whatsapp reconnect).
- Tambah health dashboard internal untuk DB/Redis/R2/Baileys connector.

### Phase C (Scale Readiness)

- Rencana multi-business/multi-org (feature flag, migration path, UX workspace switcher).
- Seat management terintegrasi `OrgPlan`.
- Storage lifecycle policies dan retention automation lebih ketat.
- Background jobs yang lebih resilient (retry policy + idempotency keys konsisten lintas modul).

### Phase D (Commercial Readiness)

- Subscription/billing activation (plan enforcement by feature gate).
- Limit usage berbasis plan (seats, storage, message throughput).
- Self-serve billing settings dan invoice pajak untuk subscription internal.

## 11) Daftar Endpoint Kritis (Ringkas)

- Auth: `/api/auth/*`
- Orgs: `/api/orgs`, `/api/orgs/business`, `/api/orgs/members`, `/api/orgs/bank-accounts`
- WhatsApp: `/api/whatsapp/baileys`, `/api/whatsapp/report`, `/api/whatsapp/test-message`
- Inbox/Message: `/api/conversations/*`, `/api/messages/*`, `/api/inbox/*`
- Invoice: `/api/invoices`, `/api/invoices/[invoiceId]/*`
- CRM Pipeline: `/api/crm/pipelines`
- Catalog: `/api/catalog`, `/api/catalog/[itemId]`
- Shortlinks: `/api/shortlinks`
- Media/Storage: `/api/media/[orgId]/[fileName]`, `/api/storage/usage`

## 12) Aturan Dokumentasi ke Depan

- Semua pembaruan arsitektur, flow bisnis, dan keputusan MVP/roadmap wajib diperbarui hanya di dokumen ini.
- Dilarang membuat dokumen baru yang menduplikasi isi tanpa kebutuhan khusus.
- Jika ada perubahan besar fitur, wajib update:
  - bagian keputusan MVP,
  - bagian audit,
  - bagian roadmap.
