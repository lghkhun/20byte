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

Embedded Signup + Cloud API

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
- WhatsApp Cloud API

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
WhatsApp Cloud API

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
docker compose up -d
```

Default host ports:
- MySQL: `3307` (container tetap `3306`)
- Redis: `6379`

If you want MySQL on `3306`, set `MYSQL_PORT=3306` in `.env`.

Stop infrastructure:

```
docker compose down
```

Reset infrastructure volumes:

```
docker compose down -v
```

Setup database migrations:

```
npx prisma migrate dev --name init_schema_v1
```

Generate Prisma client:

```
npx prisma generate
```

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
node worker/index.ts
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

WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_WEBHOOK_VERIFY_TOKEN=

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
