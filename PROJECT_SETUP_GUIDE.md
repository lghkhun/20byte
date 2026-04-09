# PROJECT SETUP GUIDE — 20byte
File: PROJECT_SETUP_GUIDE.md

Purpose:

This document explains how to setup the 20byte development environment.

The platform uses **Docker Desktop** to run infrastructure services locally.

This allows development without installing:

- MySQL
- Redis

directly on the host machine.

Instead they run inside containers.

Docker Compose makes it possible to start the entire development stack with one command. 

---

# 1. Requirements

Before starting development install the following tools.

Required software:

Node.js 20+  
Docker Desktop  
Git  

Install Node.js:

https://nodejs.org

Install Docker Desktop:

https://www.docker.com/products/docker-desktop/

Docker Desktop includes:

- Docker Engine
- Docker Compose

---

# 2. Verify Installation

Verify Node.js:

```
node -v
```

Verify npm:

```
npm -v
```

Verify Docker:

```
docker -v
```

Verify Docker Compose:

```
docker compose version
```

Docker Desktop must be **running** before continuing.

---

# 3. Clone Repository

Clone the project repository.

```
git clone https://github.com/your-org/20byte.git
```

Enter project folder.

```
cd 20byte
```

---

# 4. Install Dependencies

Install Node dependencies.

```
npm install
```

---

# 5. Setup Environment Variables

Create `.env` file.

```
cp .env.example .env
```

For Docker app profile defaults (recommended when WhatsApp credentials are not ready yet):

```
cp .env.docker.example .env
```

Edit `.env`.

Minimum configuration:

```
MYSQL_PORT=3307
REDIS_PORT=6379

DATABASE_URL=mysql://root:password@localhost:3307/20byte

REDIS_URL=redis://localhost:6379

NEXTAUTH_SECRET=changeme
NEXTAUTH_URL=http://localhost:3000

APP_URL=http://localhost:3000
SHORTLINK_BASE_URL=https://wa.20byte.com

# Optional: keep platform runnable without a live paired device
WHATSAPP_MOCK_MODE=true

# Pakasir Billing (MVP Subscription)
PAKASIR_PROJECT_SLUG=your-pakasir-project-slug
PAKASIR_API_KEY=your-pakasir-api-key
PAKASIR_BASE_URL=https://app.pakasir.com
PAKASIR_DEFAULT_METHOD=qris
PAKASIR_WEBHOOK_PATH=/api/billing/webhooks/pakasir
PAKASIR_WEBHOOK_TOKEN=replace-with-random-webhook-token

# Superadmin bootstrap (comma separated)
SUPERADMIN_EMAILS=owner@yourdomain.com,admin@yourdomain.com
```

With `WHATSAPP_MOCK_MODE=true`, inbox/onboarding message flows use dummy WhatsApp message IDs without requiring a live Baileys session.
When you are ready to test with a real WhatsApp device, set:
- `WHATSAPP_MOCK_MODE=false`
- pair the account from `/dashboard/settings/whatsapp`

---

# 6. Docker Development Environment

The development environment uses Docker containers for:

MySQL  
Redis  

This ensures consistent development environments.

Base `docker-compose.yml` di repository dipakai untuk mode container normal tanpa bind mount source code host.

Example configuration:

```
services:

  mysql:
    image: mysql:8
    container_name: 20byte_mysql
    restart: always
    environment:
      MYSQL_ROOT_PASSWORD: password
      MYSQL_DATABASE: 20byte
    ports:
      - "${MYSQL_PORT:-3307}:3306"
    volumes:
      - mysql_data:/var/lib/mysql

  redis:
    image: redis:7
    container_name: 20byte_redis
    restart: always
    ports:
      - "${REDIS_PORT:-6379}:6379"
    volumes:
      - redis_data:/data

volumes:
  mysql_data:
  redis_data:
```

---

# 7. Start Containers Safely

Start stack default.

```
docker compose up -d
```

Note:
- Default MySQL host port is `3307` to avoid conflict with local MySQL service on `3306`.
- If `3306` is free and you prefer it, set `MYSQL_PORT=3306`.
- Perintah default ini tidak lagi memakai bind mount project directory, jadi aman untuk path Windows/WSL yang belum di-share ke Docker Desktop.

This command runs containers in the background.

Verify containers:

```
docker ps
```

You should see at least:

```
mysql
redis
```

Jika juga menjalankan app via container, service `web` dan `worker` akan ikut muncul pada output `docker compose ps`.

Untuk mode development dengan bind mount + hot reload, gunakan file compose tambahan:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

Supaya lebih mudah diingat, gunakan helper command berikut dari root project:

```bash
npm run docker:up
npm run docker:down
npm run docker:restart
npm run docker:rebuild
npm run docker:logs
npm run docker:ps
```

Arti singkat:
- `npm run docker:up` = start mode development Docker
- `npm run docker:down` = stop container development
- `npm run docker:restart` = stop lalu start lagi
- `npm run docker:rebuild` = rebuild image lalu start ulang
- `npm run docker:logs` = lihat log web secara live
- `npm run docker:ps` = lihat status container

Catatan:
- Mode ini memakai `.:/app`.
- `web` dan `worker` akan menjalankan `npx prisma generate` otomatis sebelum start.
- Jika project berada di path seperti `/mnt/diskD/...`, pastikan drive/path tersebut sudah di-share di Docker Desktop.
- Jika belum, Docker Desktop akan menampilkan error seperti `mounts denied: The path ... is not shared from the host`.
- Jika Anda tetap bekerja dari path `/mnt/...` dan belum ingin mengubah file sharing Docker Desktop, gunakan `docker compose up -d --build` untuk development berbasis rebuild image. App tetap bisa dibuka dari browser lokal, tetapi perubahan kode tidak akan hot reload.
- Jika Anda ingin hot reload via container, pindahkan repo ke filesystem Linux WSL seperti `/home/<user>/...` atau aktifkan file sharing untuk drive terkait di Docker Desktop.

If image pull fails with DNS/proxy error (example: `lookup registry-1.docker.io ... server misbehaving`):

1. Configure Docker Desktop DNS manually:
- Docker Desktop -> Settings -> Docker Engine, add:
```json
{
  "dns": ["1.1.1.1", "8.8.8.8"]
}
```
- Apply & Restart Docker Desktop.

2. Validate host DNS quickly:
```
getent hosts registry-1.docker.io
```

3. Retry pull:
```
docker pull redis:7
docker pull mysql:8
```

4. If Docker Hub is blocked/intermittent on your network, override image source in `.env`:
```
MYSQL_IMAGE=mysql:8
REDIS_IMAGE=redis:7
```
or point to your internal mirror:
```
MYSQL_IMAGE=<your-mirror>/mysql:8
REDIS_IMAGE=<your-mirror>/redis:7
```

Then run:
```
docker compose down
docker compose up -d
```

---

# 8. Database Setup

Run Prisma migrations.

```
npx prisma migrate dev
```

Generate Prisma client.

```
npx prisma generate
```

Seed dummy data for full flow testing (recommended before first UI check):

```
npm run db:seed
```

Seeder content coverage:
- org + onboarding prerequisites (plan, memberships, WhatsApp account, bank accounts)
- inbox data (customers, conversations, mixed message types)
- invoice lifecycle data (draft/sent/partial/paid/void + proofs + milestones)
- CTWA shortlink attribution + click logs
- audit logs and service catalog records

Dummy login accounts:
- `owner@seed.20byte.local` / `DemoPass123!`
- `admin@seed.20byte.local` / `DemoPass123!`
- `cs@seed.20byte.local` / `DemoPass123!`
- `advertiser@seed.20byte.local` / `DemoPass123!`

---

# 9. Start Development Server

Only the **human operator** should run this command.

```
npm run dev
```

The app will run at:

```
http://localhost:3000
```

Codex must **never run the dev server**.

---

# 10. Worker Setup

The worker processes background tasks.

Start worker:

```
npm run worker:start
```

Worker responsibilities:

- WhatsApp webhook processing
- media download
- storage upload
- retention cleanup

---

# 11. Useful Docker Commands

Start containers:

```
docker compose up -d
```

Stop containers:

```
docker compose down
```

View logs:

```
docker compose logs
```

Restart services:

```
docker compose restart
```

---

# 12. Quality Gate Commands

Before shipping changes, run:

```
npm run quality:check
```

This executes:
- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run audit:cross-org-write-coverage`

---

# 13. Reset Development Environment

If something breaks:

Stop containers:

```
docker compose down
```

Remove volumes:

```
docker compose down -v
```

Restart environment:

```
docker compose up -d
```

Then run:

```
npx prisma migrate dev
```

---

# 14. Folder Structure Overview

Key directories:

```
app/        → Next.js routes
components/ → UI components
server/     → business logic
lib/        → integrations
worker/     → background jobs
prisma/     → database schema
docs/       → architecture documents
```

---

# 15. App Container Check (Pre-Deployment)

To run app containers (web + worker) together with MySQL + Redis:

```
docker compose --profile app up -d --build
```

Connection mode note:
- If you run app on host (`npm run dev`), keep `.env` as:
  - `DATABASE_URL=mysql://root:password@localhost:3307/20byte`
  - `REDIS_URL=redis://localhost:6379`
- If you run app via compose profile (`web` + `worker` containers), service connectivity uses internal Docker DNS:
  - MySQL: `mysql:3306`
  - Redis: `redis:6379`

Expected containers:

```
20byte_web
20byte_worker
20byte_mysql
20byte_redis
```

To stop:

```
docker compose down
```

---

# 16. Troubleshooting

If MySQL fails to start:

```
docker logs 20byte_mysql
```

If Redis fails to start:

```
docker logs 20byte_redis
```

If port conflicts occur:

Stop existing containers using those ports.

---

# 17. Backup Runbook (Recommended)

For VPS deployment with Docker MySQL container, create daily SQL dumps:

```
BACKUP_DIR=/opt/20byte/backups ./scripts/backup/mysql-daily-backup.sh
```

Suggested retention:

- keep at least 7 daily backups
- copy backups periodically to external storage
- use `scripts/backup/cron.example` for cron schedule template

---

# 18. Development Philosophy

Development follows a **documentation-driven approach**.

Codex must read:

DOC_00 → DOC_20

before writing code.

The development process is controlled by:

DOC_11_TASKLIST.md

---

# 19. MVP Verification (Owner UAT)

After local setup is complete, run this verification flow:

1. Authentication
- Register a new user
- Login and access dashboard

2. Onboarding
- Create organization
- Connect WhatsApp account
- Send onboarding test message
- Confirm redirect to inbox

3. Inbox + CRM
- Receive/send message
- Assign conversation
- Add tag and customer note
- Test keyboard shortcuts

4. Invoice + Proof
- Create draft invoice
- Edit items/milestones
- Open public invoice URL
- Attach payment proof from chat
- Download invoice PDF

5. Attribution
- Create shortlink
- Open redirect URL
- Verify attribution badge in conversation

6. Worker + Retention
- Confirm worker processing webhook/media
- Check cleanup logs for storage retention jobs

---

# 20. Summary

Local development environment uses:

Node.js  
Docker Desktop  
MySQL container  
Redis container  

The developer runs:

```
docker compose up -d
npm run dev
npm run worker:start
```

Codex performs all coding tasks.

The human operator only:

- runs the dev server
- provides API credentials
- verifies UI behavior

---

# 21. Inbox Indicator Reference

For CS/operator meaning of dots, badges, and labels in chat list/header/profile:

`docs/INBOX_INDICATOR_GUIDE.md`
