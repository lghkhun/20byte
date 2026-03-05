# DOC 04 — Project Structure & Code Organization
File: DOC_04_PROJECT_STRUCTURE.md

Product: 20byte  
Stack: Next.js + Prisma + MySQL + Redis + Worker + Ably + Cloudflare R2

Purpose:

This document defines the **official project structure**.  
Codex must follow this structure strictly when creating files.

Goals:

- predictable repository structure
- maintainable codebase
- clear separation of concerns
- Codex-friendly organization
- easy debugging and navigation

This document prevents the project from becoming messy during long development.

---

# 1. Repository Philosophy

The repository must remain:

- clean
- predictable
- modular
- easy for Codex to extend

Rules:

1. Files must always follow the defined folder structure.
2. Business logic must not live inside UI components.
3. API routes must stay thin.
4. Services contain core logic.
5. UI components must remain reusable.

---

# 2. Repository Root Structure

The project root must contain the following folders:

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
```

Optional support folders:

```
/scripts
/tests
/docs
```

---

# 3. App Folder (Next.js App Router)

Location:

```
/app
```

This folder contains the **application routes and layouts**.

Structure example:

```
/app
  /register
  /login
  /onboarding
  /dashboard
  /inbox
  /customers
  /invoices
  /settings
  /i
```

Explanation:

register → registration page  
login → authentication page  
onboarding → WhatsApp connection wizard  
dashboard → analytics view  
inbox → chat workspace  
customers → CRM view  
invoices → invoice management  
settings → organization configuration  
i → public invoice page

---

# 4. API Routes

API routes live inside:

```
/app/api
```

Example structure:

```
/app/api
  /auth
  /inbox
  /customers
  /invoices
  /shortlinks
  /dashboard
  /webhooks
```

Examples:

```
/api/auth/login
/api/invoices/create
/api/inbox/send
/api/webhooks/whatsapp
```

Rules:

- API routes must remain thin
- Core logic must be delegated to services

---

# 5. Components Folder

Location:

```
/components
```

Contains all reusable UI components.

Structure:

```
/components
  /ui
  /layout
  /inbox
  /customers
  /invoices
```

### ui

Generic components (from shadcn):

```
button
input
dialog
dropdown
badge
card
```

### layout

Application layout elements:

```
sidebar
topbar
page-wrapper
```

### inbox

Inbox-specific components:

```
conversation-list
chat-window
message-bubble
message-input
assignment-menu
```

### customers

Customer panel UI:

```
customer-profile
customer-tags
customer-notes
```

### invoices

Invoice UI components:

```
invoice-drawer
invoice-table
invoice-item-editor
invoice-status-badge
```

---

# 6. Lib Folder

Location:

```
/lib
```

Contains reusable utilities and integration layers.

Structure:

```
/lib
  /db
  /auth
  /permissions
  /whatsapp
  /ably
  /r2
  /ctwa
  /pricing
  /pdf
  /audit
```

Explanation:

### db

Prisma client and database helpers.

Example:

```
lib/db/prisma.ts
```

### auth

Authentication utilities.

Example:

```
password hashing
session helpers
```

### permissions

Role checking.

Example:

```
canMarkInvoicePaid
canReadConversation
```

### whatsapp

WhatsApp Cloud API integration.

Example:

```
sendMessage
sendTemplate
downloadMedia
```

### ably

Realtime messaging wrapper.

Example:

```
publishEvent
subscribeChannel
```

### r2

Cloudflare R2 integration.

Example:

```
uploadFile
deleteFile
generateSignedUrl
```

### ctwa

Attribution tracking.

Example:

```
createShortlink
resolveShortlink
```

### pricing

WhatsApp pricing helpers.

Example:

```
calculateTemplateCost
```

### pdf

Invoice PDF generator.

Example:

```
generateInvoicePdf
```

### audit

Audit log helpers.

Example:

```
logAuditEvent
```

---

# 7. Server Folder

Location:

```
/server
```

Contains **core business logic services**.

Structure:

```
/server
  /services
  /queues
  /jobs
```

### services

Domain logic.

Examples:

```
conversationService
invoiceService
customerService
messageService
shortlinkService
```

API routes must call services.

Example:

```
api/invoices/create
→ calls invoiceService.createInvoice()
```

---

### queues

Queue setup using Redis.

Example:

```
webhookQueue
mediaQueue
cleanupQueue
```

---

### jobs

Worker job handlers.

Example:

```
processWebhookJob
downloadMediaJob
cleanupRetentionJob
```

---

# 8. Worker Folder

Location:

```
/worker
```

Contains the background worker.

Structure:

```
/worker
  index.ts
  /processors
  /jobs
```

### index.ts

Worker bootstrap file.

Starts queue listeners.

---

### processors

Queue processors.

Example:

```
whatsappWebhookProcessor
mediaDownloadProcessor
cleanupProcessor
```

---

### jobs

Low-level job logic.

Example:

```
downloadMedia
storeMedia
processWebhookEvent
```

---

# 9. Prisma Folder

Location:

```
/prisma
```

Contains database schema and migrations.

Structure:

```
/prisma
  schema.prisma
  /migrations
```

Rules:

- schema.prisma is the source of truth
- migrations must be committed to git

---

# 10. Public Folder

Location:

```
/public
```

Stores static assets.

Examples:

```
logo
favicon
icons
```

Example:

```
/public/logo.svg
/public/favicon.ico
```

---

# 11. Styles Folder

Location:

```
/styles
```

Contains global styles.

Examples:

```
globals.css
tailwind.css
```

TailwindCSS will be used for styling.

---

# 12. Types Folder

Location:

```
/types
```

Contains TypeScript types shared across the application.

Examples:

```
conversation.ts
invoice.ts
customer.ts
whatsapp.ts
```

---

# 13. Scripts Folder (Optional)

Location:

```
/scripts
```

Contains development utilities.

Examples:

```
seedDatabase
resetDatabase
generateTestData
```

---

# 14. Tests Folder (Optional)

Location:

```
/tests
```

Contains automated tests.

Structure:

```
/tests
  /unit
  /integration
```

---

# 15. Code Ownership Rules

Rules Codex must follow:

1. UI logic → `/components`
2. API routes → `/app/api`
3. Business logic → `/server/services`
4. Integrations → `/lib`
5. Background tasks → `/worker`

Never mix these responsibilities.

---

# 16. File Naming Rules

Use:

```
camelCase for files
PascalCase for React components
```

Examples:

```
conversationService.ts
invoiceService.ts
ChatWindow.tsx
InvoiceDrawer.tsx
```

---

# 17. Maximum File Size Rule

Files should stay under:

```
300–400 lines
```

If larger, split into modules.

---

# 18. Import Rules

Prefer absolute imports.

Example:

```
import { prisma } from "@/lib/db/prisma"
```

Avoid deep relative paths.

---

# 19. Dependency Philosophy

Dependencies must remain minimal.

Allowed categories:

- UI (shadcn)
- database (Prisma)
- queue (Redis)
- realtime (Ably)

Avoid large frameworks.

---

# 20. Repository Stability Rules

Codex must never:

- create random folders
- duplicate logic across services
- place business logic inside components
- place database queries inside UI components

All queries must go through services.

---

# 21. Example Flow (Chat Message)

Example call stack:

User sends message  
→ Chat UI component  
→ API route `/api/inbox/send`  
→ messageService.sendMessage()  
→ WhatsApp API  
→ database store  
→ Ably publish event

---

# 22. Final Project Structure Summary

Final repository architecture:

Next.js App Router  
+ service layer  
+ Redis worker  
+ Prisma database  
+ R2 storage  
+ Ably realtime  
+ WhatsApp Cloud API

This structure ensures:

- clean codebase
- predictable development
- scalable architecture
- Codex-friendly maintenance
