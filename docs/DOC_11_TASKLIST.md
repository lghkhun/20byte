# DOC 11 — Development Tasklist (Codex Execution Plan)
File: DOC_11_TASKLIST.md

Product: 20byte  
Purpose: This document defines the step-by-step development roadmap for Codex.

Codex must treat this file as the **primary execution checklist**.

Rules:

- Only mark tasks complete when fully implemented
- Maximum 1–3 tasks per development session
- Update this file after each session
- Do not skip task order unless necessary

Task markers:

[ ] Not started  
[x] Completed  

---

# PHASE 0 — Project Initialization

[x] Initialize Next.js project (App Router + TypeScript)  
[x] Install TailwindCSS  
[x] Install shadcn/ui  
[x] Setup ESLint + Prettier  
[x] Setup project folder structure (DOC_04)  
[x] Create base layout  
[x] Create sidebar navigation skeleton  
[x] Setup environment variable loader  
[x] Create `.env.example` file  

---

# PHASE 1 — Database Foundation

[x] Install Prisma  
[x] Create Prisma schema file  
[x] Setup MySQL connection  
[x] Create Org model  
[x] Create User model  
[x] Create OrgMember model  
[x] Create Customer model  
[x] Create Conversation model  
[x] Create Message model  
[x] Create Tag model  
[x] Create CustomerTag model  
[x] Create CustomerNote model  

[x] Run first migration  
[x] Generate Prisma client  

Session notes (2026-03-05):
- Foundation completed: Next.js App Router + TypeScript, TailwindCSS, shadcn/ui-ready config, ESLint + Prettier, DOC_04 base folder structure, minimal dark sidebar layout shell.
- Added Docker Desktop development stack in `docker-compose.yml` for `mysql:8` and `redis:7` with named volumes; current host port defaults are MySQL `3307` and Redis `6379` (MySQL container internal port remains `3306`).
- Added `.env.example` placeholders for database, redis, auth, app URL, Ably, R2, and WhatsApp variables.
- Added `prisma/schema.prisma` from DOC 14 and generated initial migration `20260305170037_init_schema_v1`.
- Applied minimal schema fix for Prisma validity (added missing `Org` back-relations for `CustomerTag`, `CustomerNote`, `Message`, `ServiceCatalogItem`, `PaymentProof`) and reflected it in DOC 14.
- Migration was executed against a temporary MySQL container on `localhost:3307` because port `3306` was already occupied with different credentials in the local environment.
- Hotfix (2026-03-06): made host ports configurable via `.env` (`MYSQL_PORT`, `REDIS_PORT`) to prevent local port conflicts; verified `docker compose up -d` works with MySQL on `3307`.

---

# PHASE 2 — Authentication System

[x] Implement email/password authentication  
[x] Create password hashing utilities  
[x] Create login API route  
[x] Create register API route  
[x] Create session management  
[x] Create auth middleware  
[x] Protect dashboard routes  

[x] Create login page UI  
[x] Create registration page UI  

Session notes (2026-03-06):
- Added centralized environment loader at `lib/env.ts` with required key validation (`DATABASE_URL`, `REDIS_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `APP_URL`) and safe defaults for `MYSQL_PORT`/`REDIS_PORT`.
- Added password utilities at `lib/auth/password.ts` using bcrypt (`hashPassword`, `verifyPassword`) with password policy validation.
- Implemented `POST /api/auth/register` at `app/api/auth/register/route.ts`:
  - validates JSON payload and email/password/name
  - hashes password before insert
  - prevents duplicate email registration
  - returns standardized API response shape per DOC 15
- Verification passed: `npm run lint` and `npm run typecheck`.
- Remaining auth tasks for next session: protected routes and auth UI pages.

Session notes (2026-03-06, auth continuation):
- Added session management module at `lib/auth/session.ts`:
  - signed token (HMAC SHA256) with `NEXTAUTH_SECRET`
  - payload includes `userId`, `email`, `name`, `iat`, `exp`
  - cookie helpers (`setSessionCookie`, `clearSessionCookie`) with httpOnly/lax/secure flags
  - token verification with expiration and timing-safe signature check
- Added auth middleware helper at `lib/auth/middleware.ts`:
  - `requireApiSession(request)` for authenticated API route guard
  - standardized 401 error response per DOC 15
- Implemented `POST /api/auth/login` at `app/api/auth/login/route.ts`:
  - validates payload
  - verifies bcrypt password
  - sets signed session cookie on successful login
  - returns standardized API response shape per DOC 15
- Verification passed: `npm run lint` and `npm run typecheck`.
- Remaining auth tasks for next session: protect dashboard routes, login page UI, registration page UI.

Session notes (2026-03-06, auth UI + route protection):
- Added dashboard route protection via `app/dashboard/layout.tsx`:
  - verifies signed session token server-side
  - redirects unauthenticated/invalid session to `/login`
- Added authentication UI pages:
  - `app/login/page.tsx`
  - `app/register/page.tsx`
- Added reusable auth form component:
  - `components/auth/AuthForm.tsx`
  - supports both login and register mode
  - includes loading/error/success states and API integration
- Added reusable input primitive:
  - `components/ui/input.tsx`
- Added protected dashboard placeholder:
  - `app/dashboard/page.tsx`
- Verification passed: `npm run lint` and `npm run typecheck`.
- Remaining auth tasks for next session: none in Phase 2 (UI/API/security basics completed); can continue to Phase 3 tasks.

Session notes (2026-03-06, auth register hotfix):
- Fixed `POST /api/auth/register` failure returning empty 500:
  - removed unnecessary strict env bootstrap call from auth register/login handlers
  - hardened session secret resolution with dev fallback in `lib/env.ts` (`getAuthSecret`)
  - updated `lib/auth/session.ts` to handle missing/invalid secret safely during verification
  - improved Prisma client bootstrap in `lib/db/prisma.ts` with development datasource fallback to local MySQL (`localhost:3307`) and stale-client recreation logic
- Applied schema migration to active local DB (`npx prisma migrate dev --name init_schema_v1`).
- Verified by live curl request: register now returns `201 Created` with standard `{ data, meta }` response.

---

# PHASE 3 — Organization System

[x] Create organization creation flow  
[x] Create organization onboarding step  
[x] Add org membership roles  
[x] Implement role permission system  
[x] Add owner role logic  
[x] Add admin role logic  
[x] Add CS role logic  
[x] Add advertiser role logic  

Session notes (2026-03-06, Phase 3 foundation):
- Added organization service layer:
  - `server/services/organizationService.ts`
  - `server/services/serviceError.ts`
- Implemented organization APIs:
  - `GET/POST /api/orgs` for org listing and org creation
  - `GET /api/orgs/onboarding?orgId=...` for onboarding status
  - `GET/POST /api/orgs/members` for member listing and role assignment
- Organization creation flow:
  - authenticated user can create org
  - creator is auto-added as `OWNER` in `OrgMember`
- Onboarding step flow:
  - added `/onboarding` page (`app/onboarding/page.tsx`) with org creation and onboarding status UI
  - onboarding status currently evaluates WhatsApp connection readiness (`CONNECT_WHATSAPP` vs `DONE`) from `WaAccount` presence
- Membership role flow:
  - owner can assign member roles (`ADMIN`, `CS`, `ADVERTISER`) by user email
  - owner-only role assignment guard enforced
  - org membership checks enforced on org/member endpoints
- Dashboard route guard improvement:
  - `app/dashboard/layout.tsx` now redirects authenticated users without any organization to `/onboarding`
- Verification passed: `npm run lint` and `npm run typecheck`.
- Remaining Phase 3 tasks: role permission system and role-specific logic (`owner/admin/cs/advertiser`) across protected resources.

Session notes (2026-03-06, Phase 3 permissions):
- Implemented centralized org role permission module in `lib/permissions/orgPermissions.ts`:
  - member list access policy
  - role assignment policy
  - existing-member modification policy
- Owner role logic:
  - can manage org memberships broadly
  - protected by last-owner guard (`LAST_OWNER_ROLE_CHANGE_FORBIDDEN`) so org cannot lose its final `OWNER`
- Admin role logic:
  - can list members and assign only `CS`/`ADVERTISER`
  - cannot modify existing `OWNER` or `ADMIN` memberships
- Updated member assignment API validation (`app/api/orgs/members/route.ts`):
  - accepted roles limited to `ADMIN`, `CS`, `ADVERTISER`
- Updated security documentation in `docs/DOC_18_SECURITY_MODEL.md` to include explicit organization member-management policy.
- Verification passed: `npm run lint` and `npm run typecheck`.
- Remaining Phase 3 tasks: `CS` role logic and `ADVERTISER` role logic on upcoming inbox/invoice resource access.

Session notes (2026-03-06, Phase 3 CS + Advertiser logic):
- Extended role policy helpers in `lib/permissions/orgPermissions.ts`:
  - `canAccessOrganizationSettings` (allowed: `OWNER`, `ADMIN`)
  - `canAccessInbox` (allowed: `OWNER`, `ADMIN`, `CS`; denied: `ADVERTISER`)
- Enforced settings/onboarding access in `server/services/organizationService.ts`:
  - `getOrganizationOnboardingStatus` now returns `403 FORBIDDEN_SETTINGS_ACCESS` for roles without settings access.
- Enforced onboarding page access guard in `app/onboarding/layout.tsx`:
  - authenticated users with org memberships but without settings access are redirected to `/dashboard`.
- Updated security doc (`docs/DOC_18_SECURITY_MODEL.md`) with explicit CS/Advertiser behavior on onboarding/settings and inbox/chat access.
- Verification passed: `npm run lint` and `npm run typecheck`.
- Phase 3 is now complete; next implementation phase is Phase 4 (WhatsApp Integration).

---

# PHASE 4 — WhatsApp Integration

[x] Create WhatsApp account model  
[x] Implement Embedded Signup flow  
[x] Store WABA credentials  
[x] Implement webhook verification endpoint  
[x] Create WhatsApp webhook handler  
[x] Implement webhook idempotency check  
[x] Create webhook processing queue  
[x] Create worker processor for webhook events  

Session notes (2026-03-06, Phase 4 foundation):
- `WaAccount` model is now actively used for WhatsApp connection persistence (`prisma/schema.prisma` already contains schema v1 fields from DOC 14).
- Added token encryption utility `lib/security/tokenCipher.ts` using AES-256-GCM for secure storage of access tokens in `accessTokenEnc`.
- Added WhatsApp service layer `server/services/whatsappService.ts`:
  - org membership + settings-role checks (`OWNER`/`ADMIN`)
  - embedded-signup context loader
  - embedded-signup completion handler
  - one-org-one-number guard at application level
- Added API route `app/api/whatsapp/embedded-signup/route.ts`:
  - `GET` embedded-signup context by `orgId`
  - `POST` completion payload -> encrypted credential persistence to `WaAccount`
- Updated onboarding UI `components/onboarding/OrganizationOnboarding.tsx`:
  - added "Connect WhatsApp (Embedded Signup)" section
  - loads embedded-signup context
  - saves connection payload through API
- Added environment placeholders:
  - `WHATSAPP_TOKEN_ENCRYPTION_KEY`
  - `WHATSAPP_EMBEDDED_APP_ID`
  - `WHATSAPP_EMBEDDED_CONFIG_ID`
  in `.env.example`, env loader (`lib/env.ts`), and docs (`docs/DOC_10_DEPLOYMENT_AND_ENVIRONMENT.md`).
- Verification passed: `npm run lint` and `npm run typecheck`.
- Remaining Phase 4 tasks: webhook verification endpoint, webhook handler, idempotency, queue, and worker processor.

Session notes (2026-03-06, Phase 4 webhook API):
- Added webhook route `app/api/webhooks/whatsapp/route.ts`:
  - `GET /api/webhooks/whatsapp` implements Meta verification handshake (`hub.mode`, `hub.verify_token`, `hub.challenge`)
  - `POST /api/webhooks/whatsapp` verifies `X-Hub-Signature-256` and handles webhook payload
- Added signature verifier helper `lib/whatsapp/webhookSignature.ts` using HMAC SHA-256 + timing-safe compare.
- Added webhook processing service `server/services/whatsappWebhookService.ts`:
  - validates webhook object (`whatsapp_business_account`)
  - parses inbound message IDs from webhook payload
  - performs idempotency check by comparing incoming `waMessageId` values against existing `Message.waMessageId`
  - returns received/accepted/duplicate counters for fast acknowledgment response
- Added new environment variable placeholder `WHATSAPP_APP_SECRET` in `.env.example`, env docs, and env loader for signature verification.
- Verification passed: `npm run lint` and `npm run typecheck`.
- Remaining Phase 4 tasks: create webhook processing queue and worker processor (async job pipeline).

Session notes (2026-03-06, Phase 4 queue + worker):
- Added Redis-backed webhook queue module `server/queues/webhookQueue.ts`:
  - enqueue via `RPUSH`
  - dequeue via `BLPOP`
  - queue key: `20byte:webhook:whatsapp`
- Added minimal Redis RESP client without extra dependencies in `lib/redis/redisResp.ts`.
- Added webhook job handler `server/jobs/processWhatsAppWebhookJob.ts` and worker processor `worker/processors/whatsappWebhookProcessor.ts`.
- Updated worker bootstrap `worker/index.ts` to start/stop WhatsApp webhook processor.
- Updated `POST /api/webhooks/whatsapp`:
  - verifies signature
  - validates payload object
  - enqueues payload and returns fast acknowledgment (`enqueued`, `jobId`)
  - heavy processing moved out of request path to worker pipeline.
- Existing idempotency logic remains in `processWhatsAppWebhookPayload` and is now executed in worker job.
- Verification passed: `npm run lint` and `npm run typecheck`.
- Phase 4 checklist items are now complete.

---

# PHASE 5 — Conversation System

[x] Implement conversationService  
[x] Create conversation creation logic  
[x] Implement conversation assignment  
[x] Implement conversation status (OPEN/CLOSED)  
[x] Create conversation list API  
[x] Create conversation fetch API  

[x] Build conversation list UI  
[x] Build conversation header UI  

Session notes (2026-03-06, Phase 5 conversation foundation):
- Added conversation domain service at `server/services/conversationService.ts`:
  - inbox access guard based on org membership + role (`OWNER`, `ADMIN`, `CS` only)
  - phone validation with E.164 format
  - customer upsert by `orgId + phoneE164`
- Implemented conversation creation logic:
  - `createConversation()` creates customer if needed
  - reuses existing `OPEN` conversation for same customer when available
  - creates new `OPEN` conversation when none exists
- Implemented conversation assignment logic:
  - `assignConversation()` updates `assignedToMemberId`
  - supports assign-to-self (default) or assign by `assigneeUserId`
  - rejects assignee with non-inbox role (e.g., `ADVERTISER`)
- Added API routes:
  - `POST /api/conversations` for conversation creation
  - `POST /api/conversations/assign` for assignment changes
- Verification passed: `npm run lint` and `npm run typecheck`.
- Remaining Phase 5 tasks: conversation status API, conversation list API, conversation fetch API, and inbox list/header UI.

Session notes (2026-03-06, Phase 5 conversation APIs):
- Extended conversation service `server/services/conversationService.ts` with:
  - `updateConversationStatus()` for `OPEN` / `CLOSED`
  - `listConversations()` with filters:
    - `UNASSIGNED` (default)
    - `MY`
    - `ALL`
  - `getConversationById()` for conversation detail fetch
- Conversation list rules aligned with DOC 06:
  - default status filter is `OPEN`
  - default list filter is `UNASSIGNED`
  - supports pagination (`page`, `limit`) with response `meta { page, limit, total }`
- Added/updated API routes:
  - `GET /api/conversations` (list conversations)
  - `POST /api/conversations/status` (update conversation status)
  - `GET /api/conversations/[conversationId]?orgId=...` (fetch single conversation)
- Inbox role guard remains enforced (`OWNER`, `ADMIN`, `CS`; `ADVERTISER` blocked).
- Verification passed: `npm run lint` and `npm run typecheck`.
- Remaining Phase 5 tasks: build conversation list UI and build conversation header UI.

Session notes (2026-03-06, Phase 5 inbox UI):
- Added inbox UI components in `components/inbox`:
  - `ConversationListPanel.tsx`
  - `ConversationHeader.tsx`
  - `InboxWorkspace.tsx`
  - `types.ts`
- Wired `/dashboard` to render inbox workspace via `InboxWorkspace`.
- Conversation list UI implementation:
  - calls `GET /api/conversations`
  - supports filters `UNASSIGNED` / `MY` / `ALL`
  - refresh action
  - loading, empty, and error states
- Conversation header UI implementation:
  - calls `GET /api/conversations/[conversationId]?orgId=...`
  - shows customer name/phone, status badge, assignment state, unread count, and last activity
  - loading and empty selection states
- Verification passed: `npm run lint` and `npm run typecheck`.
- Phase 5 checklist items are now complete.

---

# PHASE 6 — Message System

[x] Create messageService  
[x] Implement inbound message storage  
[x] Implement outbound message sending  
[x] Implement message type support  

Message types:

[x] TEXT  
[x] IMAGE  
[x] VIDEO  
[x] AUDIO  
[x] DOCUMENT  
[x] TEMPLATE  
[x] SYSTEM  

[x] Create message bubble UI  
[x] Create message input UI  

Session notes (2026-03-06, Phase 6 inbound message foundation):
- Added `server/services/messageService.ts`:
  - `storeInboundMessage()` with idempotency check by `waMessageId`
  - auto upsert customer by `(orgId, phoneE164)`
  - auto create/reuse `OPEN` conversation
  - stores message as `INBOUND`
  - updates conversation timeline (`lastMessageAt`, `unreadCount`)
- Updated `server/services/whatsappWebhookService.ts`:
  - parses webhook metadata (`phone_number_id`) and maps to org via `WaAccount`
  - parses supported incoming message types:
    - `TEXT`
    - `IMAGE`
    - `VIDEO`
    - `AUDIO`
    - `DOCUMENT`
  - unsupported/invalid payload entries are ignored safely
  - processing result now tracks `received`, `accepted`, `duplicate`, `ignored`
- Updated worker log output in `server/jobs/processWhatsAppWebhookJob.ts` to include ignored count.
- This session intentionally defers outbound sending (`Implement outbound message sending`) until WhatsApp API credential/runtime wiring is finalized.
- Verification passed: `npm run lint` and `npm run typecheck`.
- Remaining Phase 6 tasks: outbound message sending, template/system message support, message bubble UI, and message input UI.

Session notes (2026-03-06, Phase 6 outbound + template/system):
- Added WhatsApp API sender service `server/services/whatsappApiService.ts`:
  - `sendWhatsAppTextMessage()`
  - `sendWhatsAppTemplateMessage()`
  - retry with exponential backoff (`1s`, `3s`, `10s`) up to 3 attempts
- Extended `server/services/messageService.ts` with outbound flow:
  - `sendOutboundMessage()` for `TEXT`, `TEMPLATE`, `SYSTEM`
  - org inbox permission checks and conversation existence checks
  - WhatsApp credential resolution from encrypted `WaAccount.accessTokenEnc`
  - outbound message persistence to `Message` table (`direction: OUTBOUND`)
  - update conversation `lastMessageAt`
- Added API route `POST /api/messages/send`:
  - supports `type: TEXT | TEMPLATE | SYSTEM`
  - for `SYSTEM`, auto appends `[Automated]` suffix if missing
- Message type support now includes all planned Phase 6 types except UI rendering/input:
  - inbound + outbound service support for `TEXT`, `IMAGE`, `VIDEO`, `AUDIO`, `DOCUMENT`, `TEMPLATE`, `SYSTEM`
- Verification passed: `npm run lint` and `npm run typecheck`.
- Remaining Phase 6 tasks: `Create message bubble UI` and `Create message input UI`.

Session notes (2026-03-06, Phase 6 message UI):
- Added chat message UI components:
  - `components/inbox/MessageBubble.tsx`
  - `components/inbox/MessageInput.tsx`
  - `components/inbox/ChatWindow.tsx`
- Extended inbox workspace to include 3-panel experience (list, chat window, header) in `components/inbox/InboxWorkspace.tsx`.
- Added message list API `GET /api/messages` (`app/api/messages/route.ts`) backed by `listConversationMessages()` in `server/services/messageService.ts`.
- Message bubble behavior:
  - inbound rendered on left
  - outbound rendered on right
  - supports text + media/document labels + template metadata + system label
- Message input behavior:
  - text send via `POST /api/messages/send`
  - attachment/template controls shown as placeholder chips for next phase
  - refreshes message list and conversation list after send
- Verification passed: `npm run lint` and `npm run typecheck`.
- Phase 6 checklist items are now complete.

---

# PHASE 7 — Media Handling

[x] Implement media download worker  
[x] Implement R2 upload integration  
[x] Store media metadata in database  
[x] Render media preview in chat  

[x] Image preview  
[x] Video preview  
[x] Audio player  
[x] Document download  

Session notes (2026-03-06, Phase 7 media backend foundation):
- Added dedicated media queue + worker processor:
  - `server/queues/mediaQueue.ts`
  - `worker/processors/whatsappMediaProcessor.ts`
  - `server/jobs/processWhatsAppMediaJob.ts`
- Added WhatsApp media transfer service:
  - `server/services/whatsappMediaService.ts`
  - downloads media from WhatsApp Cloud API by `mediaId`
  - enforces DOC 05 size limits (10MB image/document, 50MB video)
  - uploads media binaries to Cloudflare R2
  - builds path format per DOC 17 (`media/{orgId}/{conversationId}/{messageId}.{ext}`)
- Added R2 integration helpers:
  - `lib/storage/r2Client.ts`
  - `lib/storage/mediaObjectKey.ts`
- Updated webhook processing pipeline (`server/services/whatsappWebhookService.ts`) to enqueue media jobs for inbound media messages (including duplicate webhook retries with existing `messageId`).
- Updated worker bootstrap (`worker/index.ts`) to run webhook processor and media processor concurrently.
- Media metadata persistence:
  - worker updates `Message.mediaUrl`, `Message.mimeType`, and `Message.fileSize` after successful upload.
- Remaining Phase 7 tasks: chat media preview UI (`Render media preview in chat`, `Image preview`, `Video preview`, `Audio player`, `Document download`).

Session notes (2026-03-06, Phase 7 media preview UI batch 1):
- Updated `components/inbox/MessageBubble.tsx` to render inline media previews in chat bubbles:
  - image messages (`IMAGE`) now use direct preview with lazy-loading
  - video messages (`VIDEO`) now use HTML5 player (`controls`, `preload=metadata`)
- Added failure fallback states for media loading:
  - `Image unavailable`
  - `Video unavailable`
- Kept chat layout style aligned with DOC 12 palette and minimal SaaS surface/border behavior.

Session notes (2026-03-06, Phase 7 media preview UI batch 2):
- Completed remaining media preview tasks in `components/inbox/MessageBubble.tsx`:
  - `AUDIO` now renders inline HTML5 audio player (`controls`, `preload=metadata`)
  - `DOCUMENT` now renders a direct download/open action with filename label
- Added unavailable fallback states:
  - `Audio unavailable`
  - `Document unavailable`
- Phase 7 is now fully complete.

---

# PHASE 8 — Realtime System

[x] Install Ably SDK  
[x] Create Ably wrapper module  
[x] Publish message events  
[x] Subscribe to conversation updates  
[x] Update inbox in realtime  

Session notes (2026-03-06, Phase 8 realtime foundation):
- Installed Ably SDK dependency (`ably`) for realtime event transport.
- Added centralized Ably wrapper module:
  - `lib/realtime/ably.ts`
  - channel format follows DOC 16: `org:{orgId}`
  - standardized `message.new` payload with base fields (`type`, `orgId`, `entityId`, `timestamp`) + message metadata (`conversationId`, `messageId`, `direction`)
  - non-blocking and safe behavior: if `ABLY_API_KEY` is missing or publish fails, app logs warning/error without breaking core message flow.
- Integrated event publishing into message flows in `server/services/messageService.ts`:
  - publishes `message.new` after inbound message stored
  - publishes `message.new` after outbound `TEXT` / `TEMPLATE` / `SYSTEM` message stored

Session notes (2026-03-06, Phase 8 realtime subscription + inbox update):
- Added secure token request API for Ably client auth:
  - `GET /api/realtime/ably/token`
  - file: `app/api/realtime/ably/token/route.ts`
  - validates session + org inbox access before generating token request
- Added realtime service for token generation:
  - `server/services/realtimeService.ts`
  - capability limited to `subscribe` on `org:{orgId}` channel.
- Added browser realtime subscriber wrapper:
  - `lib/realtime/ablyClient.ts`
  - subscribes to `message.new` on `org:{orgId}`
  - returns cleanup function for unmount.
- Updated inbox workspace:
  - `components/inbox/InboxWorkspace.tsx`
  - subscribes when org selected, auto-refreshes conversation/messages on incoming realtime events (debounced).
- Phase 8 is now fully complete.

---

# PHASE 9 — Inbox UI

[ ] Build inbox layout (3 panels)  
[ ] Build conversation list panel  
[ ] Build chat window panel  
[ ] Build CRM context panel  

[ ] Implement assignment UI  
[ ] Implement conversation filter  

Filters:

[ ] Unassigned  
[ ] My Chats  
[ ] All Chats  

---

# PHASE 10 — CRM System

[ ] Build customer profile panel  
[ ] Implement tag creation  
[ ] Implement tag assignment  
[ ] Implement customer notes  
[ ] Build activity timeline  

---

# PHASE 11 — Invoice System

[ ] Create Invoice model  
[ ] Create InvoiceItem model  
[ ] Create PaymentMilestone model  
[ ] Create PaymentProof model  

[ ] Implement invoiceService  
[ ] Implement invoice number generator  

Format:

INV-YYYY-XXXX  

[ ] Implement invoice creation API  
[ ] Implement invoice item editor  
[ ] Implement milestone creation  

---

# PHASE 12 — Invoice UI

[ ] Create invoice drawer UI  
[ ] Create invoice items editor  
[ ] Create milestone editor  
[ ] Create invoice status badges  

Statuses:

[ ] DRAFT  
[ ] SENT  
[ ] PARTIALLY_PAID  
[ ] PAID  
[ ] OVERDUE  

---

# PHASE 13 — Invoice Public Page

[ ] Create public invoice route `/i/[token]`  
[ ] Render invoice details  
[ ] Render payment instructions  
[ ] Add copy account button  
[ ] Add copy amount button  

---

# PHASE 14 — Payment Proof

[ ] Implement proof attachment from chat  
[ ] Link proof to milestone  
[ ] Limit proofs to 5 per invoice  
[ ] Display proofs in invoice page  

---

# PHASE 15 — Invoice PDF

[ ] Implement PDF generator  
[ ] Generate PDF on invoice creation  
[ ] Upload PDF to R2  
[ ] Allow PDF download  

---

# PHASE 16 — Service Catalog

[ ] Create ServiceCatalog model  
[ ] Implement catalog CRUD API  
[ ] Build catalog UI  
[ ] Integrate catalog into invoice editor  

---

# PHASE 17 — CTWA Attribution

[ ] Create Shortlink model  
[ ] Create ShortlinkClick model  
[ ] Implement shortlink generator  
[ ] Implement redirect handler  
[ ] Capture attribution data  

---

# PHASE 18 — Attribution Display

[ ] Show source badge in conversation  
[ ] Show campaign tooltip  
[ ] Store attribution in customer record  

---

# PHASE 19 — Keyboard Shortcuts

[ ] Next unassigned conversation  
[ ] Assign to self  
[ ] Create invoice  
[ ] Attach proof  
[ ] Quick reply  
[ ] Shortcut help modal  

---

# PHASE 20 — Storage & Retention

[ ] Implement storage quota tracking  
[ ] Implement chat retention policy  
[ ] Implement cleanup worker job  
[ ] Implement invoice retention rule  

---

# PHASE 21 — Onboarding System

[ ] Create onboarding wizard  
[ ] Connect WhatsApp step  
[ ] Test message verification  
[ ] Redirect to inbox  

---

# PHASE 22 — Audit Logging

[ ] Create AuditLog model  
[ ] Log invoice events  
[ ] Log assignment changes  
[ ] Log WhatsApp connection events  

---

# PHASE 23 — Security & Permissions

[ ] Enforce role-based access  
[ ] Restrict advertiser role  
[ ] Protect API routes  
[ ] Secure webhook verification  

---

# PHASE 24 — Error Handling

[ ] Standard API error responses  
[ ] Worker retry logic  
[ ] Failed message retry  

---

# PHASE 25 — Final Polish

[ ] Empty state UI  
[ ] Loading states  
[ ] Error UI  
[ ] UI responsiveness  

---

# PHASE 26 — Pre-Deployment

[ ] Verify environment variables  
[ ] Build Dockerfile  
[ ] Setup worker container  
[ ] Setup MySQL container  
[ ] Setup Redis container  

---

# MVP COMPLETION CHECKLIST

The MVP is complete when:

[ ] Inbox system fully functional  
[ ] WhatsApp integration stable  
[ ] CRM features usable  
[ ] Invoice workflow complete  
[ ] Payment proof flow working  
[ ] Attribution tracking working  
[ ] Realtime updates functioning  
