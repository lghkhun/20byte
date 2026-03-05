# DOC 10 — Deployment & Environment Configuration
File: DOC_10_DEPLOYMENT_AND_ENVIRONMENT.md

Product: 20byte  
Purpose: Define environment configuration, infrastructure setup, and deployment strategy.

This document ensures Codex understands:

- environment variables
- local development environment
- production deployment
- external services configuration

This system is initially developed **locally**, then deployed to **Ubuntu VPS using Docker**.

---

# 1. Environment Philosophy

The system must support two environments:

Local Development  
Production

Development happens locally.

Deployment occurs later on a VPS.

Rules:

Codex must not run `npm run dev`.  
Only the owner runs the development server.

Codex may run safe commands like:

- lint
- typecheck
- prisma generate

---

# 2. Environment Variables

All secrets must be stored in `.env`.

Example file:

.env

Never commit `.env` to git.

Create `.env.example` instead.

---

# 3. Core Environment Variables

Required variables:

```
DATABASE_URL=
REDIS_URL=
NEXTAUTH_SECRET=
NEXTAUTH_URL=

WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_WEBHOOK_VERIFY_TOKEN=
WHATSAPP_APP_SECRET=
WHATSAPP_TOKEN_ENCRYPTION_KEY=
WHATSAPP_EMBEDDED_APP_ID=
WHATSAPP_EMBEDDED_CONFIG_ID=

ABLY_API_KEY=

R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=
R2_PUBLIC_URL=

APP_URL=
```

---

# 4. Database Configuration

Database:

MySQL 8+

Local connection example:

```
DATABASE_URL="mysql://root:password@localhost:3306/20byte"
```

Prisma uses this connection.

---

# 5. Redis Configuration

Redis supports:

- queue processing
- caching
- job scheduling

Example:

```
REDIS_URL=redis://localhost:6379
```

Queues used:

webhook queue  
media processing queue  
cleanup queue

---

# 6. WhatsApp Configuration

WhatsApp Cloud API requires:

```
WHATSAPP_ACCESS_TOKEN
WHATSAPP_PHONE_NUMBER_ID
WHATSAPP_WEBHOOK_VERIFY_TOKEN
WHATSAPP_APP_SECRET
WHATSAPP_TOKEN_ENCRYPTION_KEY
WHATSAPP_EMBEDDED_APP_ID
WHATSAPP_EMBEDDED_CONFIG_ID
```

These values are obtained from:

Meta Developer Console.

Access tokens must be encrypted in database storage.

`WHATSAPP_TOKEN_ENCRYPTION_KEY` is used for encryption-at-rest in `WaAccount.accessTokenEnc`.

`WHATSAPP_EMBEDDED_APP_ID` and `WHATSAPP_EMBEDDED_CONFIG_ID` are used by embedded-signup bootstrap API.

`WHATSAPP_APP_SECRET` is required to verify `X-Hub-Signature-256` for webhook requests.

---

# 7. Ably Realtime Configuration

Ably provides realtime events.

Environment variable:

```
ABLY_API_KEY
```

Example:

```
ABLY_API_KEY=xxxxx:xxxxx
```

Realtime events include:

- new message
- conversation updates
- invoice updates

---

# 8. Cloudflare R2 Configuration

R2 stores media files.

Required variables:

```
R2_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET
R2_PUBLIC_URL
```

Example:

```
R2_BUCKET=20byte-media
```

Stored files include:

- chat media
- payment proof
- invoice PDFs

---

# 9. Application URL

APP_URL defines the public platform address.

Example:

```
APP_URL=https://20byte.com
```

Used for:

- public invoice links
- shortlinks
- redirects

---

# 10. Local Development Setup

Local development stack:

Node.js  
MySQL  
Redis

Install dependencies:

```
npm install
```

Run Prisma setup:

```
npx prisma generate
```

Apply migrations:

```
npx prisma migrate dev
```

Owner runs:

```
npm run dev
```

Codex must never run dev server.

---

# 11. Worker Setup

Worker runs background jobs.

Command:

```
node worker/index.ts
```

Worker processes:

- WhatsApp webhook events
- media downloads
- retention cleanup

---

# 12. Production Deployment Strategy

Deployment target:

Ubuntu VPS.

Docker will be used to run services.

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

# 13. Docker Services

Expected containers:

web → Next.js server  
worker → background processor  
mysql → database  
redis → queue system

Docker simplifies environment consistency.

---

# 14. Deployment Steps

When MVP is ready:

1. Build application
2. Configure Docker
3. Deploy to VPS
4. Run containers
5. Configure environment variables
6. Verify webhook connectivity

---

# 15. Backup Strategy

Production database must include:

Daily backups.

Backups may be stored on:

VPS snapshot  
external storage

This prevents data loss.

---

# 16. Logging

Logs must include:

API errors  
worker failures  
webhook processing  
authentication failures

Logs help diagnose production issues.

---

# 17. Security Rules

Never expose secrets in logs.

Sensitive variables include:

access tokens  
database credentials  
API keys

These must only exist in environment variables.

---

# 18. Scaling Strategy

Initial scale target:

10–100 organizations.

Current architecture supports this easily.

Future scaling options:

worker replication  
database read replicas  
queue partitioning

Not required for MVP.

---

# 19. Environment Summary

The platform requires configuration for:

MySQL  
Redis  
WhatsApp Cloud API  
Ably Realtime  
Cloudflare R2

All configuration must live in `.env`.

Codex must always document any new environment variables added during development.
