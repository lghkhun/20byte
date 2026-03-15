# Akun Demo 20byte

Dokumen ini merangkum akun dummy untuk login lokal, role masing-masing akun, dan ekspektasi tampilan awal setelah masuk ke aplikasi.

## Kredensial Login

Semua akun seed memakai password yang sama:

`DemoPass123!`

Daftar akun:

- `owner@seed.20byte.local`
- `admin@seed.20byte.local`
- `cs@seed.20byte.local`
- `advertiser@seed.20byte.local`

Akun-akun ini dibuat oleh seeder bawaan proyek:

```bash
npm run db:seed
```

## Role dan Akses

### 1. Owner

- Email: `owner@seed.20byte.local`
- Akses: penuh ke inbox, invoice, bukti bayar, settings, dan pengelolaan organisasi
- Cocok untuk uji end-to-end seluruh fitur

### 2. Admin

- Email: `admin@seed.20byte.local`
- Akses: penuh ke inbox, kelola invoice, attach proof, akses settings terbatas
- Cocok untuk uji operasional harian dan workflow penjualan

### 3. CS

- Email: `cs@seed.20byte.local`
- Akses: inbox/chat, buat invoice, attach proof
- Tidak punya akses onboarding/settings
- Cocok untuk uji workflow percakapan dan follow-up pelanggan

### 4. Advertiser

- Email: `advertiser@seed.20byte.local`
- Akses: dashboard analytics saja
- Tidak punya akses ke inbox/chat, invoice, atau settings organisasi
- Cocok untuk verifikasi pembatasan role

## Landing Page Setelah Login

- User dengan akses inbox (`OWNER`, `ADMIN`, `CS`) diarahkan ke workspace utama inbox melalui `/dashboard`
- Halaman `/inbox` saat ini melakukan redirect ke `/dashboard`
- User `ADVERTISER` tidak boleh memakai modul inbox

## Cara Membaca Tampilan Inbox

Tampilan yang Anda lampirkan menunjukkan dua state utama inbox:

### State 1: Belum memilih percakapan

- Panel kiri menampilkan daftar conversation
- Panel tengah menampilkan empty state "Centralized Inbox"
- User diminta memilih percakapan sebelum mulai merespons

### State 2: Percakapan sudah dipilih

- Panel tengah berubah menjadi area chat aktif
- Header chat menampilkan nama/nomor pelanggan dan status assignment
- Panel kanan menampilkan konteks CRM seperti:
  - AI Autopilot
  - Auto Resolve
  - Pipeline dan tahapan
  - Catatan internal
  - Auto follow-up
  - Media / dokumen / tautan
  - Rating kepuasan

## Catatan Data Demo

- Seeder proyek menyediakan data inbox, CRM, invoice, shortlink, dan audit log untuk akun demo
- Isi conversation pada screenshot bisa berbeda dari seed default jika database lokal sudah pernah dipakai untuk testing manual
- Jika ingin kembali ke data demo bawaan, jalankan seed ulang pada database lokal yang bersih



 lanjut bersihkan warning aksesibilitas dialog itu dan rapikan lagi flow create invoice di browser supaya feedback sukses/error di drawer juga konsisten.