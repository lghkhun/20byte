# DOC 02 — System Architecture
File: DOC_02_SYSTEM_ARCHITECTURE.md

Product: 20byte  
Architecture Type: Monolith + Worker  
Purpose: Define the technical system architecture so Codex can implement the system consistently and safely.

This document explains:

- System architecture
- Infrastructure components
- Data flow
- Service responsibilities
- Technical constraints

Codex must follow this architecture strictly.

---

# 1. Architecture Philosophy

20byte architecture prioritizes:

- simplicity
- reliability
- maintainability
- Codex-friendly development

This means the system must remain understandable and maintainable by an AI coding agent.

## Allowed

- Monolith architecture
- Clear folder structure
- Simple queues
- Explicit services
- Predictable code patterns

## Forbidden

- Microservices
- Complex orchestration
- Event mesh systems
- Premature optimization

The system must remain easy for Codex to reason about.

---

# 2. High Level Architecture

The architecture consists of a Next.js monolith plus supporting infrastructure.

System layout:

User Browser  
→ Next.js Application (Web + API)  
→ MySQL Database  
→ Redis Queue  
→ Worker Process  
→ Cloudflare R2 Storage  
→ Ably Realtime  
→ WhatsApp Cloud API

The Next.js application handles most business logic, while the worker handles asynchronous tasks.

---

# 3. Core System Components

## 3.1 Next.js Application

The Next.js application is the main application server.

Responsibilities:

- Web UI
- API routes
- Authentication
- Authorization
- Business logic
- Server rendering
- Invoice PDF generation
- Conversation management
- Customer CRM logic

Stack:

- Next.js (App Router)
- TypeScript
- Prisma ORM
- shadcn/ui components

Next.js handles both frontend and backend APIs.

---

## 3.2 Worker Process

The worker handles background tasks.

These tasks must not block user interactions.

Worker responsibilities:

- Process WhatsApp webhooks
- Download WhatsApp media
- Upload media to R2
- Handle retry logic
- Retention cleanup jobs
- Invoice PDF generation (optional)

Worker runs as a separate Node process.

Example runtime command:

node worker/index.ts

Worker communicates with the main app using Redis queues.

---

## 3.3 MySQL Database

MySQL is the primary database.

It stores:

- users
- organizations
- customers
- conversations
- messages
- invoices
- payment proofs
- tags
- attribution data
- audit logs

Database ORM:

Prisma

Design rules:

- All tables include createdAt
- Important tables include updatedAt
- Foreign keys must always be enforced
- All multi-tenant tables must include orgId

---

## 3.4 Redis

Redis supports temporary and asynchronous tasks.

Redis responsibilities:

1. Job queues  
2. Idempotency locks  
3. Rate limiting  
4. Short-lived caching  

Examples of queues:

- webhook-processing queue
- media-download queue
- cleanup queue

Redis ensures that webhook processing remains fast and non-blocking.

---

## 3.5 Cloudflare R2 Storage

Cloudflare R2 stores binary files.

Stored content:

- chat attachments
- images
- PDFs
- videos
- voice notes
- invoice PDFs
- payment proofs

Reasons for choosing R2:

- S3-compatible API
- low cost
- zero egress cost
- simple integration

---

## 3.6 Ably Realtime System

Ably provides real-time updates for the UI.

Examples of realtime events:

- new message
- assignment change
- conversation status change
- invoice update
- storage usage update

Realtime avoids constant polling and keeps the inbox responsive.

---

## 3.7 WhatsApp Cloud API

WhatsApp is the main communication channel.

Features used in MVP:

- Send messages
- Receive messages via webhook
- Send templates
- Retrieve media

Connection method:

Embedded Signup + Coexistence

Important rule:

Each organization supports one WhatsApp number in MVP.

---

# 4. Message Data Flow

## Incoming WhatsApp Message

Customer sends message  
→ WhatsApp Cloud API  
→ Webhook endpoint `/api/webhooks/whatsapp`  
→ Request validation  
→ Job added to Redis queue  
→ Worker processes job  
→ Message stored in database  
→ Media downloaded if present  
→ Media uploaded to R2  
→ Realtime event published via Ably  
→ Browser updates inbox

---

## Outgoing Message Flow

User sends message from chat UI  
→ API route `/api/inbox/send`  
→ Call WhatsApp API  
→ Store message in database  
→ Publish realtime event via Ably  
→ Chat UI updates

---

# 5. Invoice Flow

User clicks Create Invoice in chat  
→ Invoice drawer opens  
→ User adds items  
→ API creates invoice  
→ System generates invoice number  
→ Public invoice token created  
→ Invoice stored in database  
→ PDF generated  
→ PDF stored in R2

Public invoice link can then be shared with the customer.

---

# 6. Payment Proof Flow

Customer sends transfer proof in chat  
→ Webhook receives image  
→ Worker downloads media  
→ Worker uploads to R2  
→ Chat displays media  
→ CS clicks Attach to Invoice  
→ Proof record created  
→ Invoice page shows proof

---

# 7. Multi-Tenant Design

20byte is a multi-tenant SaaS system.

Each organization is isolated.

Hierarchy:

Org  
→ Users  
→ Customers  
→ Conversations  
→ Messages  
→ Invoices  
→ Tags

Critical rule:

Every database query must filter by orgId.

No cross-org data access is allowed.

---

# 8. Realtime Channel Structure

Ably channel design:

org:{orgId}  
org:{orgId}:user:{userId}

Events published:

message.new  
conversation.updated  
invoice.updated  
assignment.changed  
storage.updated

Example event payload:

orgId  
conversationId  
entityId  
timestamp

---

# 9. Storage Policy

Allowed file types:

- image
- pdf
- video
- audio

File size limits:

Image / PDF  
10MB

Video  
50MB

Retention rules:

- chat attachments follow chat retention
- invoice proofs follow invoice retention

---

# 10. Local Development

During development everything runs locally.

Owner runs:

npm run dev

Codex must never run the dev server.

If verification is needed Codex must ask the owner to run the server and provide logs.

---

# 11. Production Deployment (Future)

Production environment will run on:

Ubuntu VPS with Docker.

Containers:

- web (Next.js app)
- worker
- mysql
- redis

External services:

- Cloudflare R2
- Ably
- WhatsApp Cloud API

---

# 12. Security Model

Security layers:

1. Authentication  
2. Role-based authorization  
3. Webhook verification  
4. Data isolation by orgId  
5. Token encryption  

Critical permission rule:

Advertiser role must never access chat messages.

---

# 13. Error Handling Strategy

Three layers of error handling:

1. API validation errors  
2. Worker retry logic  
3. Structured logging  

Webhook handlers must always:

- acknowledge quickly
- process heavy tasks asynchronously

Webhook processing must never block.

---

# 14. Observability

Basic logs must exist for:

- webhook processing
- worker jobs
- media download
- invoice generation
- authentication failures

Advanced monitoring is not required in MVP.

---

# 15. Future Scalability

Current architecture supports roughly:

100–500 organizations comfortably.

Future scaling options:

- horizontal worker scaling
- database read replicas
- queue partitioning

These are not required in MVP.

---

# 16. Architecture Constraints

Codex must not introduce:

- microservices
- GraphQL
- Kafka
- event sourcing
- complex queue frameworks

Architecture must remain simple.

---

# 17. Final Architecture Summary

20byte architecture consists of:

Next.js monolith  
+ background worker  
+ MySQL database  
+ Redis queue  
+ Cloudflare R2 storage  
+ Ably realtime messaging  
+ WhatsApp Cloud API

This architecture ensures:

- stable MVP development
- easy maintenance
- compatibility with AI-driven coding workflows