# DOC 03 — Database Architecture & Prisma Strategy
File: DOC_03_DATABASE_ARCHITECTURE.md

Product: 20byte  
Database: MySQL  
ORM: Prisma  
Purpose: Define the database architecture, schema design rules, and migration strategy so Codex can maintain a stable and scalable data layer.

This document is critical. Codex must follow these rules strictly to prevent schema corruption and ensure long-term maintainability.

---

# 1. Database Philosophy

The database must prioritize:

- Data integrity
- Multi-tenant isolation
- Predictable schema evolution
- Codex-friendly structure

Rules:

1. Every core entity belongs to an **Org**.
2. Every record that belongs to a tenant must include `orgId`.
3. Every table must include `createdAt`.
4. Important tables must include `updatedAt`.
5. Prisma migrations must always be used for schema changes.

Never modify tables manually in MySQL.

---

# 2. Database Engine

Database engine:

MySQL 8+

Charset:

utf8mb4

Collation:

utf8mb4_unicode_ci

This ensures:

- emoji support
- WhatsApp message compatibility
- consistent string comparisons

---

# 3. ID Strategy

All primary IDs use:

```
cuid()
```

Reasons:

- collision-resistant
- sortable
- safe for distributed systems
- supported by Prisma

Example:

```
id String @id @default(cuid())
```

Never use auto-increment integers.

---

# 4. Multi-Tenant Model

20byte is a **multi-tenant SaaS**.

The isolation model is:

```
Org
 ├ Users
 ├ Customers
 ├ Conversations
 ├ Messages
 ├ Invoices
 └ Tags
```

Critical rule:

All queries must filter by:

```
orgId
```

No cross-organization data access is allowed.

---

# 5. Core Entities

The core data entities are:

- User
- Org
- OrgMember
- Customer
- Conversation
- Message
- Tag
- CustomerTag
- CustomerNote
- Invoice
- InvoiceItem
- PaymentMilestone
- PaymentProof
- Shortlink
- AuditLog
- WaAccount

These entities form the backbone of the system.

---

# 6. Table Naming Convention

Rules:

- PascalCase model names
- Singular table names
- Clear domain names

Examples:

Good:

```
Customer
Conversation
Invoice
Message
```

Bad:

```
customers
conv
invoice_data
msg
```

---

# 7. Timestamp Rules

Every table must include:

```
createdAt DateTime @default(now())
```

Most tables must also include:

```
updatedAt DateTime @updatedAt
```

Exceptions:

Log-style tables may omit updatedAt.

---

# 8. Currency Strategy

All currency values must be stored as **integer cents**.

Example:

```
priceCents Int
totalCents Int
```

Never store money as:

- float
- decimal without strict precision

Display formatting happens in the application layer.

Example:

```
123456 cents = Rp 1.234,56
```

---

# 9. Phone Number Format

All phone numbers must use:

```
E.164 format
```

Example:

```
+628123456789
```

This ensures compatibility with WhatsApp APIs.

Database column:

```
phoneE164 String
```

---

# 10. Index Strategy

Indexes must be added for frequently queried columns.

Examples:

Conversation list query:

```
@@index([orgId, status, lastMessageAt])
```

Customer lookup:

```
@@unique([orgId, phoneE164])
```

Message pagination:

```
@@index([conversationId, createdAt])
```

Indexes must prioritize:

- orgId
- foreign keys
- time ordering

---

# 11. Invoice Number Strategy

Invoice numbers must be generated sequentially per organization.

Format:

```
INV-YYYY-XXXX
```

Example:

```
INV-2026-0001
```

The sequence resets per year.

The logic must guarantee no duplicates.

---

# 12. Public Invoice Token

Each invoice must include a secure public token.

Example:

```
publicToken String @unique
```

Used for:

```
/i/{publicToken}
```

This allows customers to open invoices without authentication.

Token must be:

- random
- unguessable

---

# 13. Message Storage Rules

Messages must store:

- direction (INBOUND / OUTBOUND)
- type (TEXT / IMAGE / VIDEO / AUDIO / DOCUMENT / TEMPLATE / SYSTEM)

Optional fields:

```
text
mediaUrl
mimeType
fileSize
durationSec
```

Template messages must store:

```
templateName
templateCategory
```

---

# 14. Attachment Storage Rules

Files are stored in Cloudflare R2.

Database stores metadata only.

Example fields:

```
mediaUrl
mimeType
fileSize
```

File size limits:

Image/PDF:

```
10MB
```

Video:

```
50MB
```

---

# 15. Payment Proof Rules

Proof records must reference:

- invoiceId
- messageId (optional)

This allows proof to be linked to the original chat message.

Maximum proofs per invoice:

```
5
```

Enforced at application level.

---

# 16. Role & Permission Model

Roles:

```
OWNER
ADMIN
CS
ADVERTISER
```

Rules:

Owner:
- full control

Admin:
- operational control

CS:
- chat handling

Advertiser:
- analytics only

Advertiser cannot access:

- messages
- attachments
- proofs

---

# 17. Audit Logging

Critical actions must generate audit logs.

Examples:

- invoice created
- invoice sent
- invoice paid
- proof attached
- conversation assignment
- WhatsApp connected

AuditLog structure:

```
action
entityType
entityId
metaJson
actorUserId
```

---

# 18. Migration Strategy

All schema changes must go through Prisma migrations.

Never modify database manually.

Standard workflow:

1. Modify schema.prisma
2. Run migration
3. Commit migration files

Example:

```
npx prisma migrate dev --name add_invoice_table
```

Codex must explain migrations before applying them.

---

# 19. Data Integrity Rules

Codex must enforce:

- foreign keys
- unique constraints
- cascade rules where appropriate

Example:

Conversation must reference:

```
customerId
orgId
```

Messages must reference:

```
conversationId
orgId
```

Invoices must reference:

```
customerId
orgId
```

---

# 20. Deletion Strategy

Soft delete should be preferred for core entities.

However, MVP may implement:

- hard delete for test data
- soft delete for customers/invoices (future)

Never delete:

- messages
- audit logs

---

# 21. Database Growth Strategy

Expected MVP scale:

- 10–100 organizations
- thousands of messages per org
- hundreds of invoices per org

MySQL handles this easily.

Future optimizations may include:

- message partitioning
- archival storage

Not required for MVP.

---

# 22. Backup Strategy (Future)

Production database must implement:

- daily backups
- point-in-time recovery

Not required during local development.

---

# 23. Prisma Client Rules

All database access must go through Prisma Client.

Never write raw SQL unless absolutely necessary.

Example import:

```
import { prisma } from "@/lib/db"
```

---

# 24. Schema Ownership

The schema must be treated as a critical contract.

Changes require:

1. Prisma schema update
2. Migration file
3. Documentation update
4. Code updates

Codex must not break compatibility silently.

---

# 25. Final Database Summary

The database architecture is designed to ensure:

- strong multi-tenant isolation
- predictable migrations
- consistent IDs
- safe financial calculations
- reliable WhatsApp message storage

The schema must remain simple and understandable so Codex can safely maintain it over long development cycles.