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

Edit `.env`.

Minimum configuration:

```
DATABASE_URL=mysql://root:password@localhost:3306/20byte

REDIS_URL=redis://localhost:6379

NEXTAUTH_SECRET=changeme
NEXTAUTH_URL=http://localhost:3000

APP_URL=http://localhost:3000
```

Additional variables will be added later.

---

# 6. Docker Development Environment

The development environment uses Docker containers for:

MySQL  
Redis  

This ensures consistent development environments.

Create file:

```
docker-compose.yml
```

Example configuration:

```
version: "3.9"

services:

  mysql:
    image: mysql:8
    container_name: 20byte_mysql
    restart: always
    environment:
      MYSQL_ROOT_PASSWORD: password
      MYSQL_DATABASE: 20byte
    ports:
      - "3306:3306"
    volumes:
      - mysql_data:/var/lib/mysql

  redis:
    image: redis:7
    container_name: 20byte_redis
    restart: always
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  mysql_data:
  redis_data:
```

---

# 7. Start Development Infrastructure

Start MySQL and Redis.

```
docker compose up -d
```

This command runs containers in the background.

Verify containers:

```
docker ps
```

You should see:

```
20byte_mysql
20byte_redis
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
node worker/index.ts
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

# 12. Reset Development Environment

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

# 13. Folder Structure Overview

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

# 14. First Development Task

After setup, Codex should begin with:

DOC_11_TASKLIST.md

Start with:

PHASE 0 — Project Initialization

Tasks:

Initialize Next.js project  
Setup Tailwind  
Setup shadcn/ui  
Setup project structure  

---

# 15. Troubleshooting

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

# 16. Development Philosophy

Development follows a **documentation-driven approach**.

Codex must read:

DOC_00 → DOC_13

before writing code.

The development process is controlled by:

DOC_11_TASKLIST.md

---

# 17. Summary

Local development environment uses:

Node.js  
Docker Desktop  
MySQL container  
Redis container  

The developer runs:

```
docker compose up -d
npm run dev
```

Codex performs all coding tasks.

The human operator only:

- runs the dev server
- provides API credentials
- verifies UI behavior