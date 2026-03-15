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
WHATSAPP_MOCK_MODE=

ABLY_API_KEY=

R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=
R2_PUBLIC_URL=

APP_URL=
SHORTLINK_BASE_URL=

MYSQL_IMAGE=
REDIS_IMAGE=
```

For Docker app profile, copy baseline from:

`.env.docker.example`

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

cleanup queue

---

# 6. WhatsApp Configuration

Current WhatsApp transport uses Baileys.

Runtime requirements:

- no Meta App credentials are required
- auth state is stored under `.runtime/baileys-auth/<orgId>`
- downloaded media is stored under `.runtime/baileys-media/<orgId>`
- local/dev may run with `WHATSAPP_MOCK_MODE=true` to bypass live device pairing

For real-device testing:

- set `WHATSAPP_MOCK_MODE=false`
- open `/dashboard/settings/whatsapp`
- connect the device using QR or pairing code

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

`SHORTLINK_BASE_URL` is optional and overrides shortlink host generation.

Example:

```
SHORTLINK_BASE_URL=https://wa.20byte.com
```

If empty, shortlink generation falls back to `${APP_URL}/r/{code}`.

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
npm run worker:start
```

Alternative (requires TS runtime support and path alias resolution):

```
tsx worker/main.ts
```

Current runtime entrypoint:

- `worker/main.ts` bootstraps lifecycle and signal handling.
- `worker/index.ts` starts/stops all worker processors.

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

For network-restricted environments, image source is configurable via env:

- `MYSQL_IMAGE` (default `mysql:8`)
- `REDIS_IMAGE` (default `redis:7`)

This allows using internal/private registry mirrors when Docker Hub is unreachable.

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

Minimum runbook recommendation (Docker MySQL container):

```
mkdir -p /opt/20byte/backups
BACKUP_DIR=/opt/20byte/backups ./scripts/backup/mysql-daily-backup.sh
```

Retention suggestion:

- keep daily backups for at least 7 days
- replicate to external object storage periodically
- Cron example is provided at: `scripts/backup/cron.example`

---

# 16. Logging

Logs must include:

API errors  
worker failures  
webhook processing  
authentication failures

Logs help diagnose production issues.

Current implementation:

- API auth middleware logs structured auth failures (`missing session` / `invalid session`) in `lib/auth/middleware.ts` via `lib/logging/auth.ts`.
- Login service logs structured auth failures (`user not found` / `invalid password`) in `server/services/authService.ts`.

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
