# 20byte

**20byte** is a chat-first CRM platform designed for service businesses.

The platform combines:

- WhatsApp inbox
- CRM
- invoice management
- payment tracking
- ad attribution tracking

All inside a single workspace.

The goal of 20byte is to make customer communication, sales tracking, and invoicing **simple for service businesses**.

---

# Core Concept

Traditional CRM systems focus on product-based businesses.

20byte is designed specifically for **service-based businesses**, such as:

- catering
- wedding services
- schools
- agencies
- consultants
- contractors

Instead of forcing users to manage many dashboards, 20byte introduces a **chat-first workspace**.

The inbox becomes the central place to:

- talk to customers
- track leads
- create invoices
- record payments

---

# Key Features

## WhatsApp Inbox

Connect WhatsApp using:

Baileys multi-device session

The inbox supports:

- inbound messages
- outbound messages
- media messages
- template messages
- assignment system
- realtime updates

The interface behaves similar to **WhatsApp Web**, but enhanced with business tools.

---

## CRM System

Customer data is automatically synced from conversations.

Users can:

- tag customers
- add internal notes
- track conversation history
- view customer activity timeline

The CRM system is built directly into the inbox.

---

## Invoice System

Users can create invoices directly from chat.

The invoice system supports:

- single payment invoices
- down payment + final payment
- manual bank transfer workflows
- payment proof attachment
- invoice PDF generation
- public invoice pages

This workflow is optimized for Indonesian service businesses.

---

## Payment Proof Tracking

Customers can send transfer proof through WhatsApp.

CS staff can attach the proof directly to an invoice.

Invoices maintain an audit trail including:

- proof uploads
- payment status
- activity timeline

---

## CTWA Attribution Tracking

20byte tracks leads coming from Click-To-WhatsApp ads.

The system supports:

- shortlink tracking
- campaign attribution
- adset attribution
- conversation attribution

This allows businesses to see which ads generate real revenue.

---

# Technology Stack

Frontend:

- Next.js (App Router)
- TypeScript
- TailwindCSS
- shadcn/ui

Backend:

- Next.js API routes
- Node.js services
- Prisma ORM

Infrastructure:

- MySQL
- Redis
- Cloudflare R2
- Ably Realtime
- Baileys

---

# System Architecture

The architecture follows a **monolith + worker model**.

Components:

Next.js Application  
Worker Process  
MySQL Database  
Redis Queue  
Cloudflare R2 Storage  
Ably Realtime  
Baileys socket session

This architecture keeps the system simple while remaining scalable.

---

# Repository Structure

```
/app
/components
/lib
/server
/prisma
/worker
/public
/styles
/types
/docs
```

Important folders:

app → Next.js routes  
components → UI components  
server → business logic services  
lib → integrations and utilities  
worker → background jobs  
prisma → database schema

---

# Local Development

Install dependencies:

```
npm install
```

Start local infrastructure (MySQL + Redis):

```
docker compose up -d mysql redis
```

Default host ports:
- MySQL: `3307` (container tetap `3306`)
- Redis: `6379`

If you want MySQL on `3306`, set `MYSQL_PORT=3306` in `.env`.

Start application containers in Docker:

```
docker compose up -d --build
```

For local Docker development with hot-reload, `docker-compose.override.yml` is loaded automatically.  
For VPS production, use [deploy.sh](/mnt/diskD/DEV/20byte/scripts/deploy.sh) because it pins Compose to [docker-compose.yml](/mnt/diskD/DEV/20byte/docker-compose.yml) only.

Connection mode note:
- Host mode (`npm run dev`): use `.env` URLs (`DATABASE_URL=mysql://root:password@localhost:3307/20byte`, `REDIS_URL=redis://localhost:6379`).
- Container mode (`docker compose ...`): `web`/`worker` use internal Docker DNS (`mysql:3306`, `redis:6379`) from `docker-compose.yml`.

Stop infrastructure:

```
docker compose down
```

Reset infrastructure volumes:

```
docker compose down -v
```

Run quality and compliance checks:

```
npm run quality:check
```

This command runs:
- lint
- typecheck
- unit tests
- cross-org write-path coverage audit

Setup database migrations:

```
npx prisma migrate dev --name init_schema_v1
```

Generate Prisma client:

```
npx prisma generate
```

Seed dummy end-to-end data (org, members, inbox, invoices, proofs, shortlinks):

```
npm run db:seed
```

Seed scope includes:
- onboarding/org setup (`Org`, `OrgPlan`, `OrgMember`, bank accounts, `WaAccount`)
- inbox + CRM (`Customer`, `Conversation`, `Message` for text/image/video/audio/template/system, tags, notes)
- invoice lifecycle (`DRAFT`, `SENT`, `PARTIALLY_PAID`, `PAID`, `VOID` + milestones/items/proofs)
- CTWA attribution (`Shortlink`, enabled/disabled links, `ShortlinkClick`)
- audit trail + catalog (`AuditLog`, `ServiceCatalogItem`)

Seed login accounts:
- `owner@seed.20byte.local` / `DemoPass123!`
- `admin@seed.20byte.local` / `DemoPass123!`
- `cs@seed.20byte.local` / `DemoPass123!`
- `advertiser@seed.20byte.local` / `DemoPass123!`

Run development server:

```
npm run dev
```

Note:

Only the human operator runs the dev server.

Codex should not run the development server.

---

# Worker Process

The worker processes background tasks such as:

- WhatsApp webhook events
- media downloads
- file uploads
- retention cleanup

Start the worker:

```
npm run worker:start
```

Alternative command:

```
tsx worker/main.ts
```

---

# Environment Variables

Create a `.env` file.

Example:

```
DATABASE_URL=
REDIS_URL=
NEXTAUTH_SECRET=
NEXTAUTH_URL=
WHATSAPP_MOCK_MODE=true

ABLY_API_KEY=

R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=
R2_PUBLIC_URL=

APP_URL=
```

Never commit `.env` to git.

Use `.env.example` instead.

Notes:

- Runtime WhatsApp connection now uses Baileys auth state under `.runtime/baileys-auth`.
- `WHATSAPP_MOCK_MODE` remains available if you want message flows without a live paired device.

---

# Development Workflow

This project is developed using **Codex-driven development**.

Codex follows structured documentation located in `/docs`.

Important documents include:

DOC_00_Codex_Rules.md  
DOC_01_Product_Freeze_PRD.md  
DOC_02_SYSTEM_ARCHITECTURE.md  
DOC_03_DATABASE_ARCHITECTURE.md  
DOC_04_PROJECT_STRUCTURE.md  
DOC_05_WHATSAPP_INTEGRATION.md  
DOC_06_INBOX_SYSTEM.md  
DOC_07_INVOICE_SYSTEM.md  
DOC_08_CTWA_ATTRIBUTION_SYSTEM.md  
DOC_09_CODEX_DEVELOPMENT_WORKFLOW.md  
DOC_10_DEPLOYMENT_AND_ENVIRONMENT.md  
DOC_11_TASKLIST.md  
DOC_12_UI_DESIGN_SYSTEM.md  
DOC_13_CODEX_MASTER_PROMPT.md  
DOC_14_DATABASE_SCHEMA_V1.md  
DOC_15_API_CONTRACT.md  
DOC_16_EVENT_SYSTEM.md  
DOC_17_STORAGE_STRATEGY.md  
DOC_18_SECURITY_MODEL.md  
DOC_19_BILLING_FUTURE.md  
DOC_20_SUBSCRIPTION_MODEL.md  

Codex reads these documents to understand the system architecture and development roadmap.

---

# Deployment

The platform will be deployed on:

Ubuntu VPS using Docker.

Containers:

web  
worker  
mysql  
redis  

External services:

Cloudflare R2  
Ably  
WhatsApp Cloud API

## Docker Compose on VPS

Jika VPS sudah terinstall Docker + Docker Compose plugin, alur deploy paling sederhana adalah:

```bash
cp .env.docker.example .env
./scripts/deploy.sh
```

Catatan penting:
- `docker-compose.yml` sekarang akan menjalankan service `migrate` dulu sebelum `web` dan `worker` start.
- state WhatsApp Baileys disimpan di volume Docker `runtime_data`, jadi pairing session tidak hilang saat container restart.
- MySQL dan Redis dibind ke `127.0.0.1` saja, jadi tetap bisa dipakai dari host lokal tanpa dibuka ke network publik VPS.
- aplikasi tetap diekspos lewat `${APP_PORT:-3000}` dan sebaiknya diletakkan di belakang reverse proxy seperti Nginx Proxy Manager, Caddy, atau Traefik.

Checklist minimum di VPS:
- isi `.env` dengan domain produksi yang benar untuk `APP_URL` dan `NEXTAUTH_URL`
- gunakan password kuat untuk `MYSQL_ROOT_PASSWORD`, `MYSQL_PASSWORD`, dan `NEXTAUTH_SECRET`
- set `WHATSAPP_MOCK_MODE=false` bila ingin koneksi device WhatsApp asli
- jalankan `docker compose logs -f migrate web worker` pada boot pertama untuk memastikan migrasi dan app start normal

Helper files:
- deploy script: [scripts/deploy.sh](/mnt/diskD/DEV/20byte/scripts/deploy.sh)
- nginx example: [20byte.conf.example](/mnt/diskD/DEV/20byte/deploy/nginx/20byte.conf.example)
- caddy example: [Caddyfile.example](/mnt/diskD/DEV/20byte/deploy/caddy/Caddyfile.example)
- auto deploy workflow: [deploy-vps.yml](/mnt/diskD/DEV/20byte/.github/workflows/deploy-vps.yml)

GitHub auto deploy setup:
- tambahkan GitHub Actions secrets: `VPS_HOST`, `VPS_PORT`, `VPS_USER`, `VPS_PATH`, `VPS_SSH_KEY`
- buat `.env` production di VPS satu kali di folder target `VPS_PATH`
- setiap push ke branch `main`, workflow akan sync source terbaru ke VPS lalu menjalankan `./scripts/deploy.sh`
- workflow tidak mengirim `.env`, `.runtime`, `node_modules`, atau `.next` dari GitHub runner ke VPS

---

# Development Status

Current phase:

MVP Development

The MVP includes:

- WhatsApp inbox
- CRM integration
- invoice system
- payment proof tracking
- CTWA attribution tracking

Future phases will include:

- broadcast messaging
- marketing automation
- booking system
- AI sales agent

---

# Vision

20byte aims to become the **operating system for service businesses**.

Instead of juggling multiple tools, businesses can manage:

communication  
customers  
payments  
marketing

all in one platform.
