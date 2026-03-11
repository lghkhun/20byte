# DOC 14 — Database Schema v1 (Prisma)
File: DOC_14_DATABASE_SCHEMA_V1.md

Product: 20byte  
Database: MySQL 8+ (utf8mb4)  
ORM: Prisma  
Purpose: This document defines the **frozen v1 Prisma schema** for the MVP.

Codex must treat this schema as the database contract for Phase 1.

Rules:
- All MVP tables must include `orgId` where applicable (multi-tenant).
- All schema changes require migration + documentation updates (DOC 03 + DOC 11).
- Money must be stored as integer cents (or smallest IDR unit) as `Int`.
- Phone numbers stored in E.164 format in `phoneE164`.
- WhatsApp access tokens must be stored encrypted in DB (field `accessTokenEnc`).

---

## 1) Prisma Schema (v1)

Copy this into: `prisma/schema.prisma`

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}

enum Role {
  OWNER
  ADMIN
  CS
  ADVERTISER
}

enum ConversationStatus {
  OPEN
  CLOSED
}

enum MessageDirection {
  INBOUND
  OUTBOUND
}

enum MessageType {
  TEXT
  IMAGE
  VIDEO
  AUDIO
  DOCUMENT
  TEMPLATE
  SYSTEM
}

enum MessageSendStatus {
  PENDING
  SENT
  FAILED
}

enum InvoiceStatus {
  DRAFT
  SENT
  PARTIALLY_PAID
  PAID
  VOID
}

enum InvoiceKind {
  FULL
  DP_AND_FINAL
}

enum PaymentMilestoneType {
  FULL
  DP
  FINAL
}

enum ProofType {
  TRANSFER
}

enum WaTemplateCategory {
  MARKETING
  UTILITY
  AUTHENTICATION
  SERVICE
}

model Org {
  id                String   @id @default(cuid())
  name              String
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  // Future wallet placeholder (Phase 2+), keep for forward compatibility
  walletBalanceCents Int     @default(0)

  members           OrgMember[]
  customers         Customer[]
  customerTags      CustomerTag[]
  customerNotes     CustomerNote[]
  conversations     Conversation[]
  messages          Message[]
  invoices          Invoice[]
  invoiceItems      InvoiceItem[]
  paymentMilestones PaymentMilestone[]
  paymentProofs     PaymentProof[]
  invoiceSequences  InvoiceSequence[]
  tags              Tag[]
  serviceCatalogItems ServiceCatalogItem[]
  waAccounts        WaAccount[]
  shortlinks        Shortlink[]
  shortlinkClicks   ShortlinkClick[]
  auditLogs         AuditLog[]
  plan              OrgPlan?
  bankAccounts      OrgBankAccount[]

  @@index([createdAt])
}

model OrgPlan {
  id             String   @id @default(cuid())
  orgId          String   @unique
  planKey        String   // starter | growth | pro
  seatLimit      Int
  storageQuotaMb Int
  retentionDays  Int
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  org            Org      @relation(fields: [orgId], references: [id])
}

model OrgMember {
  id        String   @id @default(cuid())
  orgId     String
  userId    String
  role      Role
  createdAt DateTime @default(now())

  org       Org      @relation(fields: [orgId], references: [id])
  user      User     @relation(fields: [userId], references: [id])

  @@unique([orgId, userId])
  @@index([orgId, role])
}

model User {
  id           String   @id @default(cuid())
  email        String   @unique
  passwordHash String
  name         String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  memberships  OrgMember[]
}

model OrgBankAccount {
  id            String   @id @default(cuid())
  orgId         String
  bankName      String
  accountNumber String
  accountHolder String
  createdAt     DateTime @default(now())

  org           Org      @relation(fields: [orgId], references: [id])

  @@index([orgId])
}

model WaAccount {
  id             String   @id @default(cuid())
  orgId          String
  metaBusinessId String
  wabaId         String
  phoneNumberId  String
  displayPhone   String
  createdAt      DateTime @default(now())
  connectedAt    DateTime @default(now())

  // Store encrypted token only
  accessTokenEnc String

  org            Org      @relation(fields: [orgId], references: [id])

  @@index([orgId])
  @@unique([orgId])
  @@unique([orgId, phoneNumberId])
  @@unique([phoneNumberId])
}

model Customer {
  id              String   @id @default(cuid())
  orgId           String
  phoneE164       String
  displayName     String?
  waProfilePicUrl String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  // Attribution (persisted on customer)
  source          String?  // organic | meta_ads | etc
  campaign        String?
  adset           String?
  ad              String?
  platform        String?
  medium          String?
  firstContactAt  DateTime?

  org             Org      @relation(fields: [orgId], references: [id])
  conversations   Conversation[]
  invoices        Invoice[]
  notes           CustomerNote[]
  tagLinks        CustomerTag[]

  @@unique([orgId, phoneE164])
  @@index([orgId])
  @@index([orgId, createdAt])
}

model Tag {
  id        String   @id @default(cuid())
  orgId     String
  name      String
  color     String   // e.g. "emerald", "purple", "amber"
  createdAt DateTime @default(now())

  org       Org      @relation(fields: [orgId], references: [id])
  customerLinks CustomerTag[]

  @@unique([orgId, name])
  @@index([orgId])
}

model CustomerTag {
  id         String   @id @default(cuid())
  orgId      String
  customerId String
  tagId      String
  createdAt  DateTime @default(now())

  org        Org      @relation(fields: [orgId], references: [id])
  customer   Customer @relation(fields: [customerId], references: [id])
  tag        Tag      @relation(fields: [tagId], references: [id])

  @@unique([customerId, tagId])
  @@index([orgId])
  @@index([customerId])
}

model CustomerNote {
  id           String   @id @default(cuid())
  orgId        String
  customerId   String
  authorUserId String
  content      String
  createdAt    DateTime @default(now())

  org          Org      @relation(fields: [orgId], references: [id])
  customer     Customer @relation(fields: [customerId], references: [id])

  @@index([customerId, createdAt])
  @@index([orgId, createdAt])
}

model Conversation {
  id                 String   @id @default(cuid())
  orgId              String
  customerId         String
  status             ConversationStatus @default(OPEN)

  assignedToMemberId String? // OrgMember.id
  lastMessageAt      DateTime?
  unreadCount        Int      @default(0)

  // Attribution (copied for conversation-level analytics)
  sourceCampaign     String?
  sourcePlatform     String?
  sourceMedium       String?
  shortlinkId        String?

  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  org                Org      @relation(fields: [orgId], references: [id])
  customer           Customer @relation(fields: [customerId], references: [id])
  messages           Message[]
  invoices           Invoice[]

  @@index([orgId, status, lastMessageAt])
  @@index([orgId, assignedToMemberId, lastMessageAt])
  @@index([customerId])
}

model Message {
  id             String   @id @default(cuid())
  orgId          String
  conversationId String
  waMessageId    String?  @unique

  direction      MessageDirection
  type           MessageType
  text           String?

  // Media metadata
  mediaId        String?  // WhatsApp media ID (for retrieval)
  mediaUrl       String?  // R2 public or signed URL
  mimeType       String?
  fileName       String?
  fileSize       Int?
  durationSec    Int?

  // Template metadata
  templateName     String?
  templateCategory WaTemplateCategory?
  templateLanguageCode String?
  templateComponentsJson String?

  // System metadata
  isAutomated    Boolean  @default(false)
  sendStatus     MessageSendStatus?
  sendError      String?
  sendAttemptCount Int    @default(0)
  lastSendAttemptAt DateTime?
  retryable      Boolean  @default(false)

  createdAt      DateTime @default(now())

  org            Org          @relation(fields: [orgId], references: [id])
  conversation   Conversation @relation(fields: [conversationId], references: [id])

  @@index([conversationId, createdAt])
  @@index([orgId, createdAt])
}

model ServiceCatalogItem {
  id             String   @id @default(cuid())
  orgId          String
  name           String
  category       String?
  unit           String?
  priceCents     Int?
  currency       String   @default("IDR")

  // Allowed attachments: image/pdf/link (no video)
  attachmentUrl  String?
  attachmentType String?  // "image" | "pdf" | "link"

  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  org            Org      @relation(fields: [orgId], references: [id])

  @@index([orgId, createdAt])
}

model Invoice {
  id              String   @id @default(cuid())
  orgId           String
  customerId      String
  conversationId  String?

  invoiceNo       String
  kind            InvoiceKind
  status          InvoiceStatus @default(DRAFT)

  currency        String   @default("IDR")
  subtotalCents   Int      @default(0)
  totalCents      Int      @default(0)

  // Optional due date (per invoice overall)
  dueDate         DateTime?

  // Public access token
  publicToken     String   @unique

  // Snapshot of bank accounts for invoice rendering (stable even if org settings change later)
  bankAccountsJson String

  // PDF stored on R2
  pdfUrl          String?

  createdByUserId String
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  org             Org      @relation(fields: [orgId], references: [id])
  customer        Customer @relation(fields: [customerId], references: [id])
  conversation    Conversation? @relation(fields: [conversationId], references: [id])

  items           InvoiceItem[]
  milestones      PaymentMilestone[]
  proofs          PaymentProof[]

  @@index([orgId, customerId, createdAt])
  @@index([conversationId])
  @@unique([orgId, invoiceNo])
}

model InvoiceItem {
  id          String   @id @default(cuid())
  orgId       String
  invoiceId   String
  name        String
  description String?
  qty         Int      @default(1)
  unit        String?
  priceCents  Int
  amountCents Int
  createdAt   DateTime @default(now())

  org         Org      @relation(fields: [orgId], references: [id])
  invoice     Invoice  @relation(fields: [invoiceId], references: [id])

  @@index([orgId, invoiceId])
}

model PaymentMilestone {
  id          String   @id @default(cuid())
  orgId       String
  invoiceId   String
  type        PaymentMilestoneType
  amountCents Int
  dueDate     DateTime?
  status      String   // "PENDING" | "PAID"
  paidAt      DateTime?
  createdAt   DateTime @default(now())

  org         Org      @relation(fields: [orgId], references: [id])
  invoice     Invoice  @relation(fields: [invoiceId], references: [id])

  @@unique([invoiceId, type])
  @@index([orgId, invoiceId])
}

model PaymentProof {
  id            String   @id @default(cuid())
  orgId         String
  invoiceId     String
  milestoneType PaymentMilestoneType? // optional: proof can attach to specific milestone
  type          ProofType @default(TRANSFER)

  // Link to original chat message (recommended)
  messageId     String?
  mediaUrl      String
  mimeType      String?
  fileSize      Int?

  createdByUserId String
  createdAt     DateTime @default(now())

  org           Org     @relation(fields: [orgId], references: [id])
  invoice       Invoice @relation(fields: [invoiceId], references: [id])
  message       Message? @relation(fields: [messageId], references: [id])

  @@index([invoiceId, createdAt])
  @@index([orgId, createdAt])
  @@index([messageId])
}

model InvoiceSequence {
  id         String   @id @default(cuid())
  orgId      String
  year       Int
  lastSeq    Int      @default(0)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  org        Org      @relation(fields: [orgId], references: [id])

  @@unique([orgId, year])
  @@index([orgId, year])
}

model Shortlink {
  id             String   @id @default(cuid())
  orgId          String
  code           String   @unique

  destinationUrl String   // e.g. https://wa.me/...
  source         String   @default("meta_ads")
  campaign       String?
  adset          String?
  adName         String?
  platform       String?
  medium         String?
  isEnabled      Boolean  @default(true)
  disabledAt     DateTime?

  createdAt      DateTime @default(now())

  org            Org      @relation(fields: [orgId], references: [id])
  clicks         ShortlinkClick[]

  @@index([orgId, createdAt])
}

model ShortlinkClick {
  id          String   @id @default(cuid())
  orgId       String
  shortlinkId String

  createdAt   DateTime @default(now())
  clickedAt   DateTime @default(now())
  ipHash      String?  // optional hashed ip
  userAgent   String?  // optional

  org         Org      @relation(fields: [orgId], references: [id])
  shortlink   Shortlink @relation(fields: [shortlinkId], references: [id])

  @@index([shortlinkId, clickedAt])
  @@index([orgId, clickedAt])
}

model AuditLog {
  id          String   @id @default(cuid())
  orgId       String
  actorUserId String?
  action      String
  entityType  String
  entityId    String
  metaJson    String
  createdAt   DateTime @default(now())

  org         Org      @relation(fields: [orgId], references: [id])

  @@index([orgId, createdAt])
}
```

---

## 2) Notes for Codex (Implementation Guidance)

### 2.1 Money Units
All `*_Cents` fields store integer smallest currency unit.
For IDR, this can be treated as rupiah unit (no decimals) but keep naming consistent as `Cents` for forward-compatibility.

### 2.2 Invoice Bank Snapshot
`bankAccountsJson` must store a snapshot of the org’s bank accounts at invoice creation time.
This prevents invoices from changing if the org modifies bank settings later.

### 2.3 Message Media Storage
- `mediaId` stores WhatsApp media ID
- worker uses `mediaId` to download
- `mediaUrl` points to R2 object URL (public or signed)

### 2.4 Proof Attachment Model
A proof can optionally link to a milestone (DP or FINAL).  
If milestone is not specified, it is attached to the invoice generally.

### 2.5 Attribution Fields
- Shortlink stores source/campaign/adset/ad, with compatibility bridge fields `platform`/`medium`.
- Customer attribution also stores `adset` and `ad`; `platform`/`medium` remain as backward-compatible aliases.
- Customer stores attribution permanently
- Conversation copies attribution for analytics

### 2.6 Org Settings Storage
Bank accounts are stored in `OrgBankAccount`.
Invoice stores snapshot in `bankAccountsJson`.

---

## 3) Migration Rules

- This schema requires initial migration name:
  `init_schema_v1`
- Codex must generate migrations via Prisma.
- Do not edit the database manually.

---

## 4) Completion Criteria

This schema document is complete when:
- `schema.prisma` matches v1
- initial migration generated and committed
- Prisma client can generate successfully
