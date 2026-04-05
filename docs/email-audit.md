# Audit Pengiriman Email (User & Customer)

Tanggal audit: 2026-04-05

## Sudah aktif setelah implementasi ini

1. `Forgot Password`
- Endpoint: `POST /api/auth/forgot-password`
- Service: `requestPasswordReset` di `server/services/authService.ts`
- Provider: Resend (`server/services/emailService.ts`)
- Status: aktif
- Catatan dev: bila `RESEND_API_KEY` belum diisi (non-production), reset link tetap dibuat dan dicetak ke server log sebagai fallback lokal.

2. `Invite anggota (CS/Advertiser)`
- Endpoint: `POST /api/orgs/members`
- Service: `inviteOrganizationMemberByEmail` di `server/services/organizationService.ts`
- Delivery: email otomatis + fallback setup link
- Status: aktif

3. `Resend setup link staff`
- Endpoint: `POST /api/orgs/staff/resend-setup-link`
- Service: `resendOrganizationStaffSetupLink` di `server/services/staffService.ts`
- Delivery: email otomatis + opsional WhatsApp jika nomor tersedia
- Status: aktif

4. `Reminder trial billing ke owner`
- Trigger: `GET /api/billing/subscription` -> `triggerOrgBillingReminderBroadcast`
- Service: `server/services/billingReminderService.ts`
- Delivery: email owner (best effort) + WhatsApp existing path
- Status: aktif

## Sudah ada flow komunikasi, tapi belum email-native

1. `Kirim invoice ke customer`
- Endpoint: `POST /api/invoices/[invoiceId]/send`
- Service: `sendInvoiceToCustomer` di `server/services/invoice/outbound.ts`
- Kondisi saat ini: kirim via chat WhatsApp (outbound message), belum ada kanal email customer

2. `Notifikasi invoice lain (mark paid/proof/timeline)`
- Endpoint: `api/invoices/*`
- Kondisi saat ini: realtime event + audit log, belum ada email notification

3. `Notifikasi billing event (checkout paid/expired)`
- Service utama: `server/services/billingService.ts`
- Kondisi saat ini: update status subscription + reminder, belum ada email receipt/confirmation saat payment success

## Gap data model yang menghambat email ke customer

1. `Customer` belum punya field email
- Model: `prisma/schema.prisma` -> `model Customer`
- Dampak: invoice/notification ke customer belum bisa dikirim via email langsung dari data CRM

## Prioritas lanjutan (rekomendasi)

1. Tambah `customer.email` + UI input di Customers
2. Tambah channel pengiriman invoice: `WHATSAPP | EMAIL | BOTH`
3. Tambah template email untuk:
- invoice sent
- invoice due reminder
- payment received
- subscription paid receipt
4. Tambah queue/retry email + delivery log (status sent/failed/bounced)
5. Tambah dashboard operasional notifikasi (WA vs Email delivery rate)

## Setup Resend minimum

Isi variabel berikut di `.env`:

1. `RESEND_API_KEY` -> API key dari dashboard Resend
2. `RESEND_FROM_EMAIL` -> sender terverifikasi, contoh: `20byte <noreply@mailer.20byte.com>`
3. `RESEND_REPLY_TO_EMAIL` -> alamat balasan, contoh: `support@20byte.com`

Checklist agar email benar-benar terkirim:

1. Domain sender (`mailer.20byte.com` atau domain yang dipakai) sudah verify di Resend.
2. `APP_URL` mengarah ke domain/aplikasi yang bisa diakses user (untuk link reset/setup).
3. Server sudah restart setelah `.env` diubah.
