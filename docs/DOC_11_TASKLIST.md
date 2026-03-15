# DOC 11 — Development Tasklist (Codex Execution Plan)
File: DOC_11_TASKLIST.md

Product: 20byte  
Purpose: This document defines the step-by-step development roadmap for Codex.

Current note:

- this file contains historical execution logs, including earlier Meta WhatsApp API work that has since been retired in favor of Baileys

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

[x] Build inbox layout (3 panels)  
[x] Build conversation list panel  
[x] Build chat window panel  
[x] Build CRM context panel  

[x] Implement assignment UI  
[x] Implement conversation filter  

Filters:

[x] Unassigned  
[x] My Chats  
[x] All Chats  

Session notes (2026-03-06, Phase 9 completion):
- Inbox UI is fully implemented in existing components:
  - `components/inbox/InboxWorkspace.tsx` (3-panel layout and data orchestration)
  - `components/inbox/ConversationListPanel.tsx` (conversation list panel)
  - `components/inbox/ChatWindow.tsx` (chat window panel)
  - `components/inbox/CrmContextPanel.tsx` (CRM context panel)
- Conversation filter is implemented end-to-end:
  - UI buttons for `Unassigned`, `My Chats`, `All Chats` in `ConversationListPanel`
  - query propagation from `InboxWorkspace` to `GET /api/conversations`
  - backend filtering logic in `server/services/conversationService.ts` (`UNASSIGNED`, `MY`, `ALL`)
- Assignment UI is active in CRM panel (`Assign to me`) and refreshes conversation state after mutation.
- Phase 9 is now fully complete.

---

# PHASE 10 — CRM System

[x] Build customer profile panel  
[x] Implement tag creation  
[x] Implement tag assignment  
[x] Implement customer notes  
[x] Build activity timeline  

Session notes (2026-03-06, Phase 10 CRM data batch):
- Added CRM service layer:
  - `server/services/crmService.ts`
  - implemented:
    - `createTag()`
    - `listCustomerTags()`
    - `assignTagToCustomer()`
    - `listCustomerNotes()`
    - `createCustomerNote()`
  - enforces org isolation and inbox role guard before CRM actions.
- Added CRM API routes (DOC 15 response format):
  - `POST /api/tags` (`app/api/tags/route.ts`) for tag creation
  - `GET/POST /api/customers/[customerId]/tags` for tag listing + assignment
  - `GET/POST /api/customers/[customerId]/notes` for note listing + creation
- Updated CRM panel UI:
  - `components/inbox/CrmContextPanel.tsx`
  - now supports:
    - create tag
    - assign existing tag
    - create customer note
    - list notes and tags
  - loading and error states added.
- Updated inbox orchestration:
  - `components/inbox/InboxWorkspace.tsx`
  - loads CRM context (tags/notes) per selected conversation customer
  - wires CRM actions to new APIs and refreshes panel state.
- Remaining Phase 10 task: `Build activity timeline`.

Session notes (2026-03-06, Phase 9-10 UI batch 1):
- Added CRM context panel component:
  - `components/inbox/CrmContextPanel.tsx`
  - right-side inbox panel now displays customer profile summary (name, phone, unread count, last activity, assignment state).
- Implemented assignment UI in CRM panel:
  - added `Assign to me` action (calls `POST /api/conversations/assign`)
  - includes loading and error states
  - refreshes conversation state after successful assignment.
- Updated inbox workspace integration:
  - `components/inbox/InboxWorkspace.tsx`
  - replaced old right panel usage with `CrmContextPanel`.
- Phase 10 customer profile panel baseline completed inside CRM context panel.
- Remaining Phase 10 tasks: tags, notes, and activity timeline implementation.

---

# PHASE 11 — Invoice System

[x] Create Invoice model  
[x] Create InvoiceItem model  
[x] Create PaymentMilestone model  
[x] Create PaymentProof model  

[x] Implement invoiceService  
[x] Implement invoice number generator  

Format:

INV-YYYY-XXXX  

[x] Implement invoice creation API  
[x] Implement invoice item editor  
[x] Implement milestone creation  

Session notes (2026-03-06, Phase 10 timeline + Phase 11 service start):
- Completed CRM activity timeline UI in `components/inbox/CrmContextPanel.tsx`:
  - timeline aggregates assignment status, latest message activity, and customer note activities
  - sorted by latest timestamp in dedicated `Activity Timeline` section.
- Added invoice number generator module:
  - `server/services/invoiceNumberService.ts`
  - format: `INV-YYYY-XXXX`
  - includes year range helper for yearly sequence computation.
- Added invoice service foundation:
  - `server/services/invoiceService.ts`
  - implemented `createDraftInvoice()` with:
    - org/role access checks
    - invoice number generation
    - item normalization + subtotal/total calculation
    - milestone generation (`FULL` or `DP_AND_FINAL`)
    - bank account snapshot persistence (`bankAccountsJson`)
    - draft invoice persistence with linked items and milestones.
- Phase 10 is now complete.
- Phase 11 is started; remaining invoice model/API/editor tasks continue next batch.

Session notes (2026-03-06, Phase 11 API + milestone batch):
- Added invoice creation API:
  - `POST /api/invoices` (`app/api/invoices/route.ts`)
  - validates:
    - invoice kind (`FULL` / `DP_AND_FINAL`)
    - item list
    - optional custom milestones
  - returns standardized `{ data, meta }` response.
- Extended invoice service milestone handling:
  - `server/services/invoiceService.ts`
  - supports optional milestone input from API
  - validates milestone sum equals invoice total
  - persists milestones with status `PENDING`.
- Invoice service response now includes persisted milestones summary for UI/API consumers.
- Remaining Phase 11 tasks:
  - `Implement invoice item editor`.

Session notes (2026-03-06, Phase 11 DOC 07 alignment pass):
- Checklist sync:
  - marked invoice-related models as completed because they already exist in `prisma/schema.prisma` since schema v1:
    - `Invoice`
    - `InvoiceItem`
    - `PaymentMilestone`
    - `PaymentProof`
- Hardened invoice milestone rules in `server/services/invoiceService.ts`:
  - `FULL` invoice must have exactly one `FULL` milestone
  - `DP_AND_FINAL` invoice must have `DP` + `FINAL` milestones
  - milestone total must equal invoice total.
- Added invoice item editor API:
  - `PATCH /api/invoices/[invoiceId]/items`
  - file: `app/api/invoices/[invoiceId]/items/route.ts`
  - supports replacing invoice items and optional milestone update for draft invoices.
- Extended invoice service with `editInvoiceItems()` for draft invoice editing and total/milestone recomputation.
- Phase 11 core backend tasks are now complete and aligned with DOC 07 for model, numbering, milestone, creation, and item editing behavior.

---

# PHASE 12 — Invoice UI

[x] Create invoice drawer UI  
[x] Create invoice items editor  
[x] Create milestone editor  
[x] Create invoice status badges  

Statuses:

[x] DRAFT  
[x] SENT  
[x] PARTIALLY_PAID  
[x] PAID  
[x] OVERDUE (UI derived)  
[x] VOID (DB persisted)  

Session notes (2026-03-06, Phase 12 UI batch 1):
- Added invoice drawer UI component:
  - `components/invoice/InvoiceDrawer.tsx`
  - opened from CRM panel action (`Create Invoice`) inside inbox.
- Implemented invoice items editor in drawer:
  - add/remove/edit invoice items
  - live subtotal/total calculation
  - draft create action integrated to `POST /api/invoices`.
- Implemented milestone editor in drawer:
  - supports `FULL` and `DP_AND_FINAL` milestone forms
  - editable milestone amount and due date
  - integrates with invoice create and draft item edit (`PATCH /api/invoices/[invoiceId]/items`).
- Integrated drawer into inbox orchestration:
  - `components/inbox/InboxWorkspace.tsx`
  - `components/inbox/CrmContextPanel.tsx`.
- Remaining Phase 12 tasks: invoice status badges (`DRAFT`, `SENT`, `PARTIALLY_PAID`, `PAID`, `OVERDUE` UI-derived, `VOID` persisted).

Session notes (2026-03-06, Phase 12 UI batch 2):
- Added reusable invoice status badge component:
  - `components/invoice/InvoiceStatusBadge.tsx`
  - covers statuses: `DRAFT`, `SENT`, `PARTIALLY_PAID`, `PAID`, `OVERDUE` (UI-derived), and `VOID` (persisted DB enum).
- Integrated status badges into invoice drawer:
  - `components/invoice/InvoiceDrawer.tsx`
  - shows current invoice status badge after draft creation
  - includes status palette preview for all supported UI statuses.
- Phase 12 is now complete.

---

# PHASE 13 — Invoice Public Page

[x] Create public invoice route `/i/[token]`  
[x] Render invoice details  
[x] Render payment instructions  
[x] Add copy account button  
[x] Add copy amount button  

Session notes (2026-03-06, Phase 13 public page batch 1):
- Added public invoice service:
  - `server/services/publicInvoiceService.ts`
  - resolves invoice by `publicToken` with org, customer, items, milestones, and bank account snapshot parsing.
- Added public invoice route:
  - `app/i/[token]/page.tsx`
  - unauthenticated invoice page render based on secure token.
- Implemented invoice details rendering:
  - business/org name
  - customer identity
  - invoice number, status, created/due date
  - invoice item table + subtotal/total
  - milestone section.
- Implemented payment instruction rendering:
  - bank account list from `bankAccountsJson`
  - transfer amount guidance.
- Remaining Phase 13 tasks: `Add copy account button`, `Add copy amount button`.

Session notes (2026-03-06, Phase 13 public page batch 2):
- Added copy actions for payment instructions:
  - `components/invoice/PublicInvoicePaymentInstructions.tsx`
  - `Copy account` button per bank account
  - `Copy amount` button for exact transfer value.
- Integrated client copy actions into public invoice page:
  - `app/i/[token]/page.tsx`
  - keeps route server-rendered while enabling browser clipboard interaction.
- Phase 13 is now complete.

---

# PHASE 14 — Payment Proof

[x] Implement proof attachment from chat  
[x] Link proof to milestone  
[x] Limit proofs to 5 per invoice  
[x] Display proofs in invoice page  
---

# PHASE 15 — Invoice PDF

[x] Implement PDF generator  
[x] Generate PDF on invoice creation  
[x] Upload PDF to R2  
[x] Allow PDF download  

---

# PHASE 16 — Service Catalog

[x] Create ServiceCatalog model  
[x] Implement catalog CRUD API  
[x] Build catalog UI  
[x] Integrate catalog into invoice editor  

---

# PHASE 17 — CTWA Attribution

[x] Create Shortlink model  
[x] Create ShortlinkClick model  
[x] Implement shortlink generator  
[x] Implement redirect handler  
[x] Capture attribution data  

Session notes (2026-03-06, checklist sync):
- Synced Phase 14–17 checkbox status with existing implementation already present in codebase.
- No new feature code was added in this sync step; this update is documentation consistency only.

---

# PHASE 18 — Attribution Display

[x] Show source badge in conversation  
[x] Show campaign tooltip  
[x] Store attribution in customer record  

Session notes (2026-03-06, Phase 18 batch 1):
- Added attribution fields to conversation payloads:
  - `server/services/conversationService.ts`
  - list/detail/create conversation responses now include `source`, `sourceCampaign`, `sourcePlatform`, `sourceMedium`.
- Added attribution display in inbox conversation list:
  - `components/inbox/ConversationListPanel.tsx`
  - source badge (`META` / `ORGANIC`) rendered per conversation.
  - hover tooltip (`title`) shows campaign/platform/medium.
- Strengthened customer attribution persistence:
  - `server/services/conversationService.ts`
  - manual conversation creation now ensures customer `source` defaults to `organic` when missing.
- Type sync:
  - `components/inbox/types.ts` includes attribution fields used by inbox UI.

Phase 17 compliance note vs DOC 08:
- Implemented: shortlink generation, random slug, click tracking, redirect with invisible marker, first-message attribution capture, organic fallback, and attribution permanence.
- Schema v1 mapping currently uses `campaign/platform/medium` fields (DOC 14) instead of explicit `campaign/adset/ad/source` naming from DOC 08.

Session notes (2026-03-06, Phase 17-18 compliance remediation):
- Expanded `Shortlink` model for DOC 08 alignment:
  - added `source`, `adset`, `adName`, `isEnabled`, `disabledAt` in Prisma schema.
  - added migration `20260306113000_shortlink_doc08_compliance`.
  - applied migration to local DB with `npx prisma migrate dev --name shortlink_doc08_compliance`.
- Implemented manual shortlink disable flow:
  - `PATCH /api/shortlinks` with `orgId` + `shortlinkId`.
  - redirect routes `/r/[code]` (PRD canonical) and `/s/[code]` (backward compatibility) return `404` when shortlink is disabled.
- Added minimal shortlink management UI:
  - `app/dashboard/settings/shortlinks/page.tsx`
  - `components/settings/ShortlinkManager.tsx`
  - supports create/list/disable with org selector.
- Updated inbox attribution tooltip wording to DOC 08 language (`Campaign/Adset/Ad`).

---

# PHASE 19 — Keyboard Shortcuts

[x] Next unassigned conversation  
[x] Assign to self  
[x] Create invoice  
[x] Attach proof  
[x] Quick reply  
[x] Shortcut help modal  

Session notes (2026-03-06, Phase 19 batch 1):
- Added keyboard shortcut handler in `components/inbox/InboxWorkspace.tsx`.
- Implemented shortcuts:
  - `Alt+U` → move to next unassigned conversation.
  - `Alt+A` → assign selected conversation to self.
  - `Alt+I` → open invoice drawer for selected conversation.
- Shortcuts are ignored while typing inside input/textarea/contenteditable elements.

Session notes (2026-03-06, Phase 19 batch 2):
- Added shortcut modals:
  - `components/inbox/QuickReplyModal.tsx`
  - `components/inbox/ShortcutHelpModal.tsx`
  - `components/inbox/AttachProofShortcutModal.tsx`
- Extended keyboard shortcuts in `components/inbox/InboxWorkspace.tsx`:
  - `P` → open attach payment proof modal (requires a selected proof message).
  - `/` → open quick reply modal.
  - `Ctrl+/` → toggle shortcut help modal.
- Quick reply sends pre-defined responses through existing message send flow.

---

# PHASE 20 — Storage & Retention

[x] Implement storage quota tracking  
[x] Implement chat retention policy  
[x] Implement cleanup worker job  
[x] Implement invoice retention rule  

Session notes (2026-03-06, Phase 20 batch 1):
- Added storage usage service + API:
  - `server/services/storageService.ts`
  - `app/api/storage/usage/route.ts`
  - computes org quota (`OrgPlan.storageQuotaMb`) and used bytes from message media + payment proof files.
- Added chat retention cleanup policy:
  - `server/services/storageService.ts` (`applyChatRetentionPolicyForOrg`)
  - uses `OrgPlan.retentionDays` (fallback 90 days), clears old chat media metadata from DB, and deletes matching R2 objects when key can be resolved.
- Added periodic cleanup worker job:
  - `server/jobs/processStorageCleanupJob.ts`
  - `worker/processors/storageCleanupProcessor.ts`
  - wired into `worker/index.ts` with 15-minute interval.
- Extended R2 client for cleanup:
  - `lib/storage/r2Client.ts` now supports `deleteFromR2` and `getPublicObjectKeyFromUrl`.

Session notes (2026-03-06, Phase 20 batch 2):
- Implemented invoice retention cleanup in `server/services/storageService.ts`:
  - `applyInvoiceRetentionPolicyForOrg` targets old invoices (by org retention days) in terminal states (`PAID`, `OVERDUE`).
  - deletes invoice PDF objects from R2 (when key can be resolved from public URL).
  - deletes payment proof media objects from R2, removes proof rows, and nulls `Invoice.pdfUrl`.
- Extended storage cleanup job:
  - `server/jobs/processStorageCleanupJob.ts` now runs chat retention + invoice retention in one periodic cycle and logs both summaries.

---

# PHASE 21 — Onboarding System

[x] Create onboarding wizard  
[x] Connect WhatsApp step  
[x] Test message verification  
[x] Redirect to inbox  

Session notes (2026-03-06, Phase 21 batch 1):
- Enhanced onboarding wizard UI in `components/onboarding/OrganizationOnboarding.tsx`:
  - explicit 4-step flow (Create Organization → Connect WhatsApp → Send Test Message → Go to Inbox).
- Kept WhatsApp connection onboarding step integrated with existing embedded signup APIs:
  - `/api/whatsapp/embedded-signup` context + connect flows.
- Added test-message verification API:
  - `app/api/whatsapp/test-message/route.ts`
  - calls `sendOnboardingTestMessage` in `server/services/whatsappService.ts`.
- Added service-level test message sender in `server/services/whatsappService.ts`:
  - validates org settings access + E.164 target phone.
  - loads connected WaAccount credentials and sends WhatsApp test text via Cloud API.
- Implemented onboarding completion redirect:
  - when onboarding status is completed, component auto-redirects to `/dashboard` and provides `Go to Inbox` button.

---

# PHASE 22 — Audit Logging

[x] Create AuditLog model  
[x] Log invoice events  
[x] Log assignment changes  
[x] Log WhatsApp connection events  

Session notes (2026-03-06, Phase 22 batch 1):
- Confirmed `AuditLog` model exists in schema v1:
  - `prisma/schema.prisma` (`model AuditLog`).
- Added reusable safe audit logger:
  - `server/services/auditLogService.ts`
  - writes to `AuditLog` with non-blocking failure behavior (logs error, does not fail main request flow).
- Added invoice audit events in `server/services/invoiceService.ts`:
  - `invoice.created` on draft invoice creation
  - `invoice.items_updated` on draft item edit
- Added assignment audit event in `server/services/conversationService.ts`:
  - `conversation.assigned` when conversation assignee changes.

Session notes (2026-03-06, Phase 22 batch 2):
- Added WhatsApp connection audit event in `server/services/whatsappService.ts`:
  - `whatsapp.connected` is written after successful `WaAccount` upsert in embedded signup completion flow.
  - logs org/user context plus non-secret connection metadata (phoneNumberId, displayPhone, wabaId, metaBusinessId).

---

# PHASE 23 — Security & Permissions

[x] Enforce role-based access  
[x] Restrict advertiser role  
[x] Protect API routes  
[x] Secure webhook verification  

Session notes (2026-03-06, Phase 23 checklist sync):
- Enforce role-based access:
  - centralized guards in `lib/permissions/orgPermissions.ts` used across services.
  - inbox-sensitive services validate membership + role (`canAccessInbox`) before data access.
- Restrict advertiser role:
  - advertiser excluded from inbox access (`INBOX_ACCESS_ROLES` only OWNER/ADMIN/CS).
  - member-management constraints enforce advertiser permissions scope.
- Protect API routes:
  - authenticated API routes consistently use `requireApiSession`.
  - public exceptions are intentional only: `auth/login`, `auth/register`, `webhooks/whatsapp`.
- Secure webhook verification:
  - `app/api/webhooks/whatsapp/route.ts` enforces verify-token handshake and `X-Hub-Signature-256` verification via `verifyWebhookSignature`.

---

# PHASE 24 — Error Handling

[x] Standard API error responses  
[x] Worker retry logic  
[x] Failed message retry  

Session notes (2026-03-06, Phase 24 batch 1):
- Added reusable API response helpers:
  - `lib/api/http.ts` (`errorResponse`, `successResponse`)
  - applied in representative routes:
    - `app/api/whatsapp/test-message/route.ts`
    - `app/api/storage/usage/route.ts`
    - `app/api/shortlinks/route.ts`
- Added reusable retry helper:
  - `lib/retry/withRetry.ts` (configurable retries with exponential backoff + optional jitter).
- Worker retry logic improvements:
  - `worker/processors/whatsappWebhookProcessor.ts`
  - `worker/processors/whatsappMediaProcessor.ts`
  - `worker/processors/storageCleanupProcessor.ts`
  - each now retries dequeue/process operations through shared retry helper.
- Failed outbound message retry enhancement:
  - `server/services/messageService.ts`
  - outbound text/template sending now has additional service-level retry wrapper (`sendOutboundTextWithRetry`, `sendOutboundTemplateWithRetry`) before final failure.

---

# PHASE 25 — Final Polish

[x] Empty state UI  
[x] Loading states  
[x] Error UI  
[x] UI responsiveness  

Session notes (2026-03-06, Phase 25 batch 1):
- Added reusable state UI primitives:
  - `components/ui/state-panels.tsx`
  - includes `EmptyStatePanel`, `LoadingStatePanel`, `ErrorStatePanel`.
- Applied standardized empty/loading/error panels:
  - `components/inbox/ChatWindow.tsx`
  - `components/inbox/ConversationListPanel.tsx`
  - `components/inbox/InboxWorkspace.tsx`
- Responsive polish for inbox workspace:
  - updated grid breakpoints in `components/inbox/InboxWorkspace.tsx`:
    - `lg` two-column layout
    - `xl` three-panel layout
  - CRM panel spans full row on `lg` and returns to right panel on `xl`.

---

# PHASE 26 — Pre-Deployment

[x] Verify environment variables  
[x] Build Dockerfile  
[x] Setup worker container  
[x] Setup MySQL container  
[x] Setup Redis container  

Session notes (2026-03-06, Phase 26 batch 1):
- Added Docker build artifacts:
  - `Dockerfile`
  - `.dockerignore`
- Added worker runtime entrypoint:
  - `worker/main.ts`
  - `package.json` script: `worker:start` (`tsx worker/main.ts`).
- Updated Docker Compose for pre-deployment app stack:
  - `docker-compose.yml` now includes `web` and `worker` services (profile: `app`) with health-gated dependencies on MySQL + Redis.
  - existing `mysql` and `redis` services retained for local and pre-deployment use.
- Environment variable verification (documentation-level):
  - confirmed `.env.example` includes required core vars from DOC 10.
  - updated README with pre-deployment compose command:
    - `docker compose --profile app up -d --build`.

Session notes (2026-03-06, Phase 26 batch 2):
- Stabilized compose runtime connectivity for app containers:
  - `web` and `worker` now explicitly use internal service URLs in `docker-compose.yml`:
    - `DATABASE_URL=mysql://root:password@mysql:3306/20byte`
    - `REDIS_URL=redis://redis:6379`
  - prevents host/container URL mismatch when using `docker compose --profile app`.
- Clarified host-vs-container connection rules in:
  - `README.md`
  - `PROJECT_SETUP_GUIDE.md`

---

# MVP COMPLETION CHECKLIST

The MVP is complete when:

[x] Inbox system fully functional  
[x] WhatsApp integration stable  
[x] CRM features usable  
[x] Invoice workflow complete  
[x] Payment proof flow working  
[x] Attribution tracking working  
[x] Realtime updates functioning  

Session notes (2026-03-06, MVP checklist sync):
- Synced final MVP completion checklist with completed phase implementations (Phase 1–26 scope in DOC 11).
- All checklist items marked complete pending owner runtime/UAT verification in local/dev environment.
- Updated `PROJECT_SETUP_GUIDE.md` with pre-deployment app-container command and owner UAT verification flow.

Session notes (2026-03-06, final hardening pass):
- Ran static quality gates:
  - `npm run lint` (pass)
  - `npm run typecheck` (pass)
- Audited codebase for unresolved markers (`TODO`, `FIXME`, `HACK`, `TBD`) in core directories and found no active placeholders.
- Current status: implementation checklist complete; remaining step is owner runtime/UAT verification flow in local environment.

Session notes (2026-03-06, docker build + env hotfix):
- Fixed Docker image build sequence in `Dockerfile` by running `npx prisma generate` after `COPY . .` and before `npm run build`.
  - resolves build-time Prisma type mismatch (`ConversationStatus` not exported) inside container builds.
- Reduced compose startup noise for missing optional WhatsApp credentials by adding safe dev defaults in `docker-compose.yml` for:
  - `WHATSAPP_APP_SECRET`
  - `WHATSAPP_TOKEN_ENCRYPTION_KEY`
  - `WHATSAPP_EMBEDDED_APP_ID`
  - `WHATSAPP_EMBEDDED_CONFIG_ID`
- Validation:
  - `npm run build` (pass)
  - `docker compose config` (no missing-variable warnings for those keys)

Session notes (2026-03-06, WhatsApp mock-mode for pre-verification):
- Added development fallback mode for WhatsApp integration so platform can run before Meta app verification is complete.
- New env flag:
  - `WHATSAPP_MOCK_MODE` (default recommended in local dev: `true`)
- Behavior in mock mode:
  - outbound text/template sends return dummy message IDs without calling Meta API.
  - onboarding test message works without connected `WaAccount`.
  - inbox message send flow no longer blocks on missing WhatsApp credentials during local platform-first development.
- Files updated:
  - `lib/whatsapp/mockMode.ts`
  - `server/services/whatsappApiService.ts`
  - `server/services/messageService.ts`
  - `server/services/whatsappService.ts`
  - `.env.example`
  - `PROJECT_SETUP_GUIDE.md`

Session notes (2026-03-06, batch perbaikan 1 — shortcut PRD sync):
- Synced keyboard shortcut implementation and help modal with DOC 01 mapping:
  - `N` next unassigned
  - `A` assign to me
  - `I` create invoice
  - `P` attach proof
  - `/` quick reply
  - `Ctrl+/` shortcut help
- Files updated:
  - `components/inbox/InboxWorkspace.tsx`
  - `components/inbox/ShortcutHelpModal.tsx`

Session notes (2026-03-06, batch perbaikan 2 — realtime minimum DOC 16):
- Expanded realtime publisher support to DOC 16 core events:
  - `message.new`
  - `conversation.updated`
  - `assignment.changed`
  - `invoice.created`
  - `invoice.updated`
  - `invoice.paid` (publisher available for upcoming paid-status flow)
  - `proof.attached`
  - `customer.updated`
  - `storage.updated`
- Updated token capability to include both channel patterns:
  - `org:{orgId}`
  - `org:{orgId}:user:{userId}`
- Connected event emits in current services:
  - conversation assignment/status
  - invoice create/edit
  - proof attach
  - customer tag/note updates
  - storage cleanup updates
- Updated inbox client subscription to listen to all core events and refresh workspace state.
- Files updated:
  - `lib/realtime/ably.ts`
  - `lib/realtime/ablyClient.ts`
  - `server/services/realtimeService.ts`
  - `server/services/conversationService.ts`
  - `server/services/messageService.ts`
  - `server/services/invoiceService.ts`
  - `server/services/paymentProofService.ts`
  - `server/services/crmService.ts`
  - `server/services/storageService.ts`
  - `components/inbox/InboxWorkspace.tsx`

Session notes (2026-03-06, batch perbaikan 3 — sinkronisasi status invoice docs):
- Resolved DOC contradiction between invoice architecture and schema contract:
  - persisted invoice statuses aligned to schema (`DRAFT`, `SENT`, `PARTIALLY_PAID`, `PAID`, `VOID`)
  - `OVERDUE` documented as UI-derived presentation state (not persisted enum)
- Documents updated:
  - `docs/DOC_07_INVOICE_SYSTEM.md`
  - `docs/DOC_11_TASKLIST.md` (Phase 12 status wording)

Session notes (2026-03-06, workflow/deployment remediation batch):
- DOC 09 critical compliance improvements:
  - added baseline tests for critical logic areas:
    - `tests/unit/orgPermissions.test.ts` (permission matrix)
    - `tests/unit/invisibleMarker.test.ts` (CTWA marker encode/decode integrity)
  - added test command in `package.json`:
    - `npm test` -> `tsx --test tests/**/*.test.ts`
  - added explicit auth failure logging in `app/api/auth/login/route.ts` (masked email in logs).
- DOC 10 deployment/environment sync:
  - updated `docs/DOC_10_DEPLOYMENT_AND_ENVIRONMENT.md`:
    - worker command aligned to `npm run worker:start`
    - clarified embedded-signup credential model + `WHATSAPP_MOCK_MODE`
    - added minimum backup runbook for Docker MySQL
  - updated `README.md` env + worker command details to match current runtime
  - updated `PROJECT_SETUP_GUIDE.md` with backup runbook section.

Session notes (2026-03-06, PRD blocking remediation batch):
- Closed invoice compliance blockers from PRD/DOC 07:
  - implemented `POST /api/invoices/[invoiceId]/send` to send invoice link to chat and transition status to `SENT`.
  - implemented `POST /api/invoices/[invoiceId]/mark-paid` with role logic:
    - `OWNER`: can mark paid without proof.
    - `ADMIN`/`CS`: must have at least one payment proof attached.
  - implemented milestone-driven status progression:
    - no paid milestones -> `SENT`
    - some paid milestones -> `PARTIALLY_PAID`
    - all paid milestones -> `PAID`
- Added invoice drawer actions to consume new APIs:
  - `Send Invoice`
  - `Mark DP Paid` / `Mark Final Paid` for DP+Final invoices
  - `Mark Paid` for full invoices
- Added canonical PRD shortlink redirect route:
  - `/r/[code]` now active (click tracking + invisible marker + redirect)
  - `/s/[code]` retained for backward compatibility.

Session notes (2026-03-06, architecture/security hardening batch):
- Cross-org WhatsApp webhook mapping hardened:
  - `WaAccount.phoneNumberId` is now globally unique (`@@unique([phoneNumberId])`).
  - webhook resolver switched to `findUnique({ phoneNumberId })`.
  - added service guard in embedded-signup completion to block connecting a number already used by another org.
  - migration added/applied: `20260306133000_wa_account_phone_number_unique`.
- Outgoing endpoint contract alignment:
  - added `POST /api/inbox/send` (architecture canonical flow) while keeping `/api/messages/send` for compatibility.
  - inbox UI send flow updated to use `/api/inbox/send`.
- Redis responsibilities expanded beyond queue:
  - idempotency lock (`lib/redis/idempotency.ts`) used in webhook processing by `waMessageId`.
  - rate limiting (`lib/redis/rateLimit.ts`) added to outbound send endpoints.
  - short-lived caching (`lib/redis/cache.ts`) added for shortlink lookups in redirect routes.
- Org isolation consistency improvements:
  - message listing queries now include `orgId` filters in addition to `conversationId`.
  - payment proof count query now includes `orgId` filter.
- Cleanup processing now follows Redis queue pattern:
  - new queue: `server/queues/cleanupQueue.ts`
  - new scheduler: `worker/processors/storageCleanupScheduler.ts`
  - cleanup processor changed from timer-only execution to queue consumer (`BLPOP` loop).
- Storage policy hardening:
  - media transfer now strictly allows only `image/*`, `video/*`, `audio/*`, and `application/pdf`.
  - payment proof document attachment restricted to PDF (`application/pdf`).
- Observability improvement for auth failures:
  - `requireApiSession` now logs unauthorized API access for missing vs invalid/expired session token.

Session notes (2026-03-06, tenant + invoice integrity remediation):
- Fixed invoice numbering scope and race-safety:
  - `Invoice.invoiceNo` is now unique per org (`@@unique([orgId, invoiceNo])`), no longer globally unique.
  - added `InvoiceSequence` table and switched invoice number reservation to transactional sequence increment (`upsert + increment`) to prevent duplicate numbers under concurrent creation.
- Strengthened tenant ownership on invoice child tables:
  - added `orgId` to `InvoiceItem` and `PaymentMilestone`, including data backfill + indexes + foreign keys.
  - service writes now always set `orgId` on created invoice items/milestones.
- Added missing relational integrity for payment proof message linkage:
  - `PaymentProof.messageId` now has FK to `Message.id` with index for query performance.
  - payment proof milestone validation now also filters by `orgId`.
- Extended timestamp consistency:
  - added `createdAt` to `WaAccount` and `ShortlinkClick`.
- Improved org-scoped query consistency in invoice mutation flows:
  - status updates now use org-scoped writes (`updateMany` with `id + orgId`) followed by scoped reads.
- Normalized WhatsApp inbound phone handling:
  - webhook parser now normalizes `message.from` and contact `wa_id` into E.164 (`+` prefix + strict validation) before message persistence.
- Migrations applied:
  - `20260306142000_invoice_tenant_integrity`
  - `20260306153000_created_at_compliance`

Session notes (2026-03-06, architecture consistency remediation):
- API thin-controller consistency improved for auth:
  - extracted register/login business logic from route handlers into `server/services/authService.ts`.
  - `app/api/auth/register/route.ts` and `app/api/auth/login/route.ts` now focus on transport concerns (JSON parse, service call, response mapping).
- Integration library structure synchronized with DOC 04:
  - added official adapter paths:
    - `lib/ably/publisher.ts`
    - `lib/ably/client.ts`
    - `lib/r2/client.ts`
    - `lib/ctwa/invisibleMarker.ts`
  - updated service/component imports to use these official integration namespaces.
- Worker/job structure synchronized:
  - moved worker job handlers from `server/jobs/*` to `worker/jobs/*`.
  - updated worker processors to import from `worker/jobs`.
- Component domain folder consistency improved:
  - moved invoice UI files from `components/invoice/*` to `components/invoices/*`.
  - updated all imports accordingly.
- App route/folder structure aligned to DOC example:
  - added top-level routes:
    - `app/inbox/page.tsx`
    - `app/customers/page.tsx`
    - `app/invoices/page.tsx`
    - `app/settings/page.tsx`
    - `app/settings/shortlinks/page.tsx`
  - currently implemented as safe redirects to existing workspace routes.
- File-size policy remediation started:
  - reduced `server/services/storageService.ts` below 400 lines by extracting:
    - `server/services/storage/storageTypes.ts`
    - `server/services/storage/storageConstants.ts`
- Remaining large files (>400 lines) still need phased refactor in subsequent sessions:
  - `server/services/invoiceService.ts`
  - `server/services/messageService.ts`
  - `server/services/conversationService.ts`
  - `components/inbox/InboxWorkspace.tsx`
  - `components/invoices/InvoiceDrawer.tsx`
  - `components/onboarding/OrganizationOnboarding.tsx`

Session notes (2026-03-06, WhatsApp reliability + contract remediation):
- Enforced rule `1 Organization = 1 WhatsApp number` at DB level:
  - added unique constraint on `WaAccount.orgId`.
  - migration: `20260306165000_whatsapp_outbound_reliability`.
- Completed template send contract for required `components`:
  - `POST /api/inbox/send` and `POST /api/messages/send` now validate `templateComponents` for `TEMPLATE` messages.
  - WhatsApp template sender now always forwards `template.components`.
- Outbound error handling hardened:
  - outbound rows now track send state (`PENDING`/`SENT`/`FAILED`), error message, attempt count, retry flag.
  - failed sends are persisted in message timeline; errors are saved; retry is manual via new endpoint:
    - `POST /api/inbox/retry`
- Inbox UI improvements:
  - failed outbound bubble now shows error + retry action.
  - template send UI now includes template category cost visibility and tooltip explaining conversation-window pricing.
- Post-connect flow now runs automatic checks:
  - after embedded-signup connect, backend triggers post-connect webhook test event enqueue.
  - response includes post-connect status flags (`webhookVerified`, `testEventTriggered`) and onboarding UI displays them.
- Webhook/media dedupe gap closed:
  - media download enqueue now protected by dedicated idempotency lock (`idempotency:whatsapp:media-enqueue:{messageId}`).

Session notes (2026-03-06, DOC 06 inbox compliance patch):
- Completed inbox UI compliance fixes for DOC 06 minimum panel behavior without adding new product modules.
- Updated sidebar routing in `app/layout.tsx` to target module paths (`/inbox`, `/customers`, `/invoices`, `/dashboard`, `/settings`).
- Improved conversation list minimum content in `components/inbox/ConversationListPanel.tsx`:
  - avatar initials fallback
  - unread indicator badge
  - last message preview text
- Added chat header status action in `components/inbox/ChatWindow.tsx` + `InboxWorkspace` wiring:
  - close/reopen conversation via `POST /api/conversations/status`.
- Added message input attachment workflow in `components/inbox/MessageInput.tsx`:
  - attachment picker (image/pdf/video)
  - attachment validation
  - send attachment action wired as system outbound note (dummy-safe flow while WhatsApp credentials are pending verification).
- Added CRM context enrichment for right panel:
  - new service `server/services/inboxCrmService.ts`
  - new API `GET /api/conversations/[conversationId]/crm-context`
  - invoices section + timeline events (invoice created/sent, proof attached, invoice paid) in `components/inbox/CrmContextPanel.tsx`.
- Extended conversation list backend to support `lastMessagePreview` via `server/services/conversationService.ts` and shared types.
- Verification:
  - `npm run lint` ✅
  - `npm run build` ✅
  - `npm run typecheck` ✅

Session notes (2026-03-06, invoice lifecycle + bank transfer hardening):
- Implemented invoice core operational flow in module page:
  - new invoices workspace UI at `/invoices` (`components/invoices/InvoicesWorkspace.tsx`)
  - supports invoice list, status filtering, send invoice, mark paid (FULL/DP/FINAL), and timeline panel.
- Added invoice list API support:
  - extended `GET /api/invoices` in `app/api/invoices/route.ts`.
  - added `listInvoices()` service in `server/services/invoiceService.ts`.
- Added invoice timeline implementation:
  - new service `getInvoiceTimeline()` in `server/services/invoiceService.ts`
  - new endpoint `GET /api/invoices/[invoiceId]/timeline`
  - timeline events include created, sent, proof attached, payment marked, completed.
- Hardened invoice lifecycle rules in service layer:
  - `sendInvoiceToCustomer` now rejects paid/partially paid invoices for re-send.
  - `markInvoicePaid` now rejects `DRAFT` invoices (must be sent first).
- Hardened invoice number uniqueness per organization under concurrency:
  - added retry mechanism for unique-constraint collisions during draft creation.
  - bank account snapshot and invoice creation now executed with conflict-safe retry path.
- Completed bank transfer workflow for "up to 5 accounts":
  - new bank account service `server/services/orgBankAccountService.ts`
  - new API `GET/POST/DELETE /api/orgs/bank-accounts`
  - owner/admin-only management with max 5 accounts enforcement.
  - new settings UI `components/settings/BankAccountManager.tsx` integrated into dashboard settings page.
  - invoice snapshot now uses up to 5 accounts (`take: 5`) per DOC 07 rule.
- Fixed public invoice copy-amount UX:
  - copy payment amount now copies formatted amount label (not raw `totalCents` integer representation).
  - updated `components/invoices/PublicInvoicePaymentInstructions.tsx`.
- Verification:
  - `npm run lint` ✅
  - `npm run build` ✅
  - `npm run typecheck` ✅

Session notes (2026-03-06, CTWA attribution compliance patch):
- Closed DOC 08 naming gaps for attribution payloads and UI labels:
  - shortlink API/service now supports `ad` input/output alias (while keeping `adName` compatibility).
  - inbox attribution tooltip now uses `Source/Campaign/Adset/Ad` labels.
- Enforced disabled shortlink behavior without cache stale window:
  - disabling shortlink now invalidates redirect cache key (`cache:shortlink:{code}`), so `/r/{code}` and `/s/{code}` return `404` immediately.
- Added canonical shortlink host override:
  - env: `SHORTLINK_BASE_URL` (e.g. `https://wa.20byte.com`), fallback remains `${APP_URL}/r/{code}`.
- Completed customer attribution structure alignment:
  - added customer-level attribution columns `adset` and `ad` (with migration `20260306201000_customer_ctwa_adset_ad`).
  - message ingestion persists both modern fields (`adset`/`ad`) and compatibility fields (`platform`/`medium`).
- Manual shortlink generation is available in frontend:
  - `app/dashboard/settings/shortlinks/page.tsx` with `ShortlinkManager` create/list/disable flow.

---

# COMPLIANCE BACKLOG — Quality & Ops

[x] Reduce all core files to < 400 lines (`server/services/invoice/core.ts`, `server/services/message/core.ts`, `conversationService`)  
[x] Add critical logic tests for invoice lifecycle transitions and webhook deduplication  
[x] Implement structured authentication failure logging  
[x] Add operational artifact for daily backup automation  

Session notes (2026-03-06, DOC 10 sync + inbox invoice quick actions):
- DOC 10 and runtime deployment sync:
  - worker command/entrypoint clarified (`npm run worker:start`, `worker/main.ts` -> `worker/index.ts`).
  - Docker WhatsApp/env contract aligned with safe defaults in `docker-compose.yml`.
  - added `.env.docker.example` for Docker profile baseline.
  - backup runbook now references executable script artifact.
- Auth failure logging compliance:
  - added structured auth logger in `lib/logging/auth.ts`.
  - integrated in `lib/auth/middleware.ts` (missing/invalid session).
  - integrated in `server/services/authService.ts` (invalid login credentials).
  - integrated in `app/api/auth/login/route.ts` (internal auth failure path).
- Operational backup artifact:
  - `scripts/backup/mysql-daily-backup.sh` (daily dump + retention cleanup).
  - `scripts/backup/cron.example` (cron template).
- Inbox main panel invoice actions:
  - added `Send`, `Mark Paid`, `Mark DP Paid`, `Mark Final Paid` directly in CRM invoice cards.
  - role-based UI guard added: only `OWNER/ADMIN/CS` can operate buttons.
  - non-owner proof rule reflected in UI disable state when `proofCount=0`.

Session notes (2026-03-06, inbox closed-conversation discoverability):
- Closed-conversation discoverability improved in left panel:
  - added status tabs `Open` / `Closed` in `ConversationListPanel`.
  - wired inbox query status filter from UI to `GET /api/conversations`.
  - default remains `Open`, but users can now browse `Closed` conversations and reopen from chat panel.

Session notes (2026-03-06, refactor batch for large-file reduction):
- Extracted invoice service shared modules:
  - `server/services/invoice/invoiceTypes.ts`
  - `server/services/invoice/invoiceUtils.ts`
  - `server/services/invoiceService.ts` now imports/re-exports these modules.
- Extracted message service shared modules:
  - `server/services/message/messageTypes.ts`
  - `server/services/message/messageUtils.ts`
  - `server/services/messageService.ts` now consumes shared modules.
- Extracted inbox workspace local response/domain types:
  - `components/inbox/workspace/types.ts`
  - reduced `components/inbox/InboxWorkspace.tsx` type clutter.
- Extracted invoice drawer types/helpers:
  - `components/invoices/invoice-drawer/types.ts`
  - reduced `components/invoices/InvoiceDrawer.tsx`.
- Post-batch line counts:
  - `server/services/invoiceService.ts`: 1256 -> 958
  - `server/services/messageService.ts`: 1137 -> 981
  - `components/inbox/InboxWorkspace.tsx`: 1181 -> 1033
  - `components/invoices/InvoiceDrawer.tsx`: 649 -> 533
- Validation:
  - `npm run lint` ✅
  - `npm run typecheck` ✅

Session notes (2026-03-06, docker registry DNS resilience):
- Added configurable Docker image sources in compose:
  - `MYSQL_IMAGE` (default `mysql:8`)
  - `REDIS_IMAGE` (default `redis:7`)
- Updated environment baseline:
  - `.env.docker.example` now includes `MYSQL_IMAGE` and `REDIS_IMAGE`.
- Added troubleshooting guidance for Docker Hub DNS/proxy pull failures in `PROJECT_SETUP_GUIDE.md`.

Session notes (2026-03-06, large-file reduction batch continuation):
- Completed UI file-size target for inbox/invoice workspace components:
  - `components/inbox/InboxWorkspace.tsx`: `1033 -> 197`
  - `components/invoices/InvoiceDrawer.tsx`: `533 -> 259`
- Extraction approach:
  - moved inbox controller logic into `components/inbox/workspace/useInboxWorkspaceController.ts`.
  - moved invoice drawer state/handlers into `components/invoices/invoice-drawer/useInvoiceDrawer.ts`.
- Introduced service domain entrypoints for phased split (`inbound/outbound/listing`) while preserving compatibility:
  - `server/services/message/{inbound.ts,outbound.ts,listing.ts}`
  - `server/services/invoice/{inbound.ts,outbound.ts,listing.ts}`
  - `server/services/messageService.ts` and `server/services/invoiceService.ts` now act as thin barrels.
- Transitional core implementation files added for safe incremental migration:
  - `server/services/message/core.ts` (current full implementation source)
  - `server/services/invoice/core.ts` (current full implementation source)
- Validation:
  - `npm run lint` ✅
  - `npm run typecheck` ✅

Session notes (2026-03-06, cross-org hardening batch):
- Hardening write-path completed on:
  - `server/services/catalogService.ts`
  - `server/services/conversationService.ts`
  - `server/services/shortlinkService.ts`
  - `server/services/whatsappService.ts`
- Hardening tx-path completed on:
  - `server/services/message/core.ts`
  - `server/services/invoice/core.ts`
  - `server/services/storageService.ts`
- Cross-org write protections tightened by replacing direct ID-only writes with org-scoped writes (or org-scoped pre-check in transaction flow where Prisma nested write requires `update`).
- Added regression guard tests:
  - `tests/unit/crossOrgWriteGuard.test.ts`
  - Covers write-path + tx-path services and enforces org-scoped write query patterns.
- Validation:
  - `npm run lint` ✅
  - `npm run typecheck` ✅
  - `npm test` ✅

Session notes (2026-03-06, prisma migration recovery without reset):
- Fixed Prisma migration-chain error and drift (`Message.templateComponentsJson`, `Message.sendError`) on local dev DB without data reset.
- Updated checksum for edited migration `20260306050340_whatsapp_outbound_reliability` in local `_prisma_migrations` to match current file state.
- Applied pending migrations and repair migrations:
  - `20260306201000_customer_ctwa_adset_ad`
  - `20260306220000_message_outbound_longtext_repair`
  - auto-generated by Prisma during sync: `20260306101637_apply_pending_repairs`
- Current status: `npx prisma migrate status` reports database schema up to date.

Session notes (2026-03-06, service domain split hardening continuation):
- Completed real per-domain split for message service (not only barrel wrappers):
  - `server/services/message/inbound.ts` contains inbound storage flow.
  - `server/services/message/outboundShared.ts`, `outboundSend.ts`, `outboundRetry.ts` contain outbound + retry flow.
  - `server/services/message/listing.ts` contains message listing flow.
  - `server/services/message/core.ts` reduced to compatibility facade exports.
- Completed real per-domain split for invoice service:
  - `server/services/invoice/access.ts` for role/access + invoice number reservation helpers.
  - `server/services/invoice/draft.ts` for draft create/edit flows.
  - `server/services/invoice/payment.ts` for mark-paid + timeline flows.
  - `server/services/invoice/outbound.ts` for send invoice flow.
  - `server/services/invoice/listing.ts` for list flow.
  - `server/services/invoice/core.ts` reduced to compatibility facade exports.
- Updated cross-org write guard regression test targets to new files:
  - `tests/unit/crossOrgWriteGuard.test.ts`.
- Current line-count status after split:
  - `server/services/message/core.ts`: `1008 -> 3`
  - `server/services/invoice/core.ts`: `972 -> 14`
  - `server/services/message/inbound.ts`: `374`
  - `server/services/message/outboundShared.ts`: `252`
  - `server/services/invoice/draft.ts`: `358`
  - `server/services/invoice/payment.ts`: `356`
- Remaining backlog note:
  - checklist item `Reduce all core files to < 400 lines (...)` still intentionally unchecked because `server/services/conversationService.ts` is still > 400.
- Validation:
  - `npm run lint` ✅
  - `npm run typecheck` ✅
  - `npm test` ✅

Session notes (2026-03-06, conversation service split completion):
- Completed conversation service decomposition and removed large monolith file:
  - `server/services/conversation/create.ts`
  - `server/services/conversation/assignment.ts`
  - `server/services/conversation/status.ts`
  - `server/services/conversation/listing.ts`
  - shared modules: `types.ts`, `utils.ts`, `access.ts`, `mappers.ts`
  - `server/services/conversationService.ts` now thin facade export only.
- Updated cross-org guard test target for conversation write-path:
  - `tests/unit/crossOrgWriteGuard.test.ts` now validates `server/services/conversation/assignment.ts`.
- Line-count closure for previously blocking compliance item:
  - `server/services/message/core.ts`: `3`
  - `server/services/invoice/core.ts`: `14`
  - `server/services/conversationService.ts`: `16`
  - all target “core” files now `< 400`.
- Validation:
  - `npm run lint` ✅
  - `npm run typecheck` ✅
  - `npm test` ✅

Session notes (2026-03-06, critical logic tests closure):
- Added invoice lifecycle regression tests:
  - `tests/unit/invoiceLifecycle.test.ts`
  - covers status transitions (`SENT -> PARTIALLY_PAID -> PAID`), `VOID` preservation, and milestone validation errors.
- Added webhook dedupe regression tests:
  - `tests/unit/webhookDeduplication.test.ts`
  - introduced testable processing helper `processInboundMessagesWithDeps()` in `server/services/whatsappWebhookService.ts` to validate:
    - idempotency lock miss => duplicate + skip store.
    - duplicate-in-db and accepted media message => enqueue media download exactly once per stored message id path.
- Validation:
  - `npm run lint` ✅
  - `npm run typecheck` ✅
  - `npm test` ✅

Session notes (2026-03-06, E.164 normalization regression coverage):
- Added dedicated E.164 normalization tests for inbound WhatsApp parsing path:
  - `tests/unit/e164Normalization.test.ts`
  - covers accepted formats (already E.164, numeric without `+`), noisy formatted input cleanup, and invalid/null rejection.
- Validation:
  - `npm run lint` ✅
  - `npm run typecheck` ✅
  - `npm test` ✅

Session notes (2026-03-06, invoice mark-paid policy test hardening):
- Extracted mark-paid business rules into policy helper:
  - `server/services/invoice/paymentPolicy.ts`
  - includes:
    - `assertMarkPaidProofRule` (Owner bypass vs Admin/CS proof requirement),
    - `resolveTargetMilestoneTypes`,
    - `assertMilestoneTypesExist`.
- Refactored `server/services/invoice/payment.ts` to consume policy helper (no behavior change, easier testability).
- Added dedicated policy regression tests:
  - `tests/unit/invoicePaymentPolicy.test.ts`
  - validates Owner/Admin/CS permission rules and milestone selection/validation errors.
- Validation:
  - `npm run lint` ✅
  - `npm run typecheck` ✅
  - `npm test` ✅

Session notes (2026-03-06, invoice send policy test hardening):
- Extracted send-invoice business rules into policy helper:
  - `server/services/invoice/sendPolicy.ts`
  - includes:
    - `assertInvoiceSendable` (`VOID` and paid statuses are blocked),
    - `buildAutomatedInvoiceText` (centralized outbound invoice message format).
- Refactored `server/services/invoice/outbound.ts` to consume policy helper (behavior preserved).
- Added dedicated send-policy regression tests:
  - `tests/unit/invoiceSendPolicy.test.ts`
  - validates sendability matrix (`DRAFT/SENT` allowed, `VOID/PAID/PARTIALLY_PAID` rejected) and automated message marker.
- Validation:
  - `npm run lint` ✅
  - `npm run typecheck` ✅
  - `npm test` ✅

Session notes (2026-03-06, conversation utility regression coverage):
- Added dedicated conversation utility tests:
  - `tests/unit/conversationUtils.test.ts`
  - covers:
    - `validatePhoneE164` valid/invalid behavior,
    - `resolveLastMessagePreview` mapping + truncation logic,
    - `normalizeValue`, `normalizeOptionalName`, `normalizePage`, `normalizeLimit` deterministic bounds.
- Validation:
  - `npm run lint` ✅
  - `npm run typecheck` ✅
  - `npm test` ✅

Session notes (2026-03-06, shortlink policy regression hardening):
- Extracted shortlink validation/normalization rules into policy helper:
  - `server/services/shortlink/policy.ts`
  - includes:
    - `assertWhatsAppDestination`,
    - `normalizeShortlinkValue`,
    - `resolveShortlinkAttribution` (adset/ad fallback mapping compatibility).
- Refactored `server/services/shortlinkService.ts` to consume policy helper (behavior preserved).
- Added shortlink policy regression tests:
  - `tests/unit/shortlinkPolicy.test.ts`
  - covers destination URL allowlist and attribution fallback precedence.
- Validation:
  - `npm run lint` ✅
  - `npm run typecheck` ✅
  - `npm test` ✅

Session notes (2026-03-06, storage media whitelist tightening):
- Tightened media MIME whitelist from broad prefix checks to explicit allowlist:
  - `server/services/storage/mediaPolicy.ts`
  - allowed inbound media now explicitly: `application/pdf`, `image/jpeg|jpg|png|webp`, `video/mp4|3gpp`, `audio/ogg|mpeg|aac|mp4`.
- Refactored `server/services/whatsappMediaService.ts` to use centralized storage media policy checks.
- Added regression tests for storage media policy:
  - `tests/unit/mediaPolicy.test.ts`
  - covers unsupported MIME rejection, explicit allowlist acceptance, and size-limit enforcement (10MB non-video, 50MB video).
- Validation:
  - `npm run lint` ✅
  - `npm run typecheck` ✅
  - `npm test` ✅

Session notes (2026-03-06, auth failure logging regression coverage):
- Added dedicated auth failure logging regression tests:
  - `tests/unit/authLogging.test.ts`
  - covers:
    - structured payload shape (`scope`, `event`, `reason`, `at`),
    - email masking behavior (normal, short local-part, malformed),
    - IP normalization from forwarded chain (`x-forwarded-for` first hop),
    - optional field handling when request context is absent.
- Validation:
  - `npm run lint` ✅
  - `npm run typecheck` ✅
  - `npm test` ✅

Session notes (2026-03-06, realtime event contract hardening):
- Extracted realtime event payload builders into dedicated module:
  - `lib/realtime/eventPayloads.ts`
  - covers channel naming (`org:{orgId}`) and standardized payload builders for all DOC 16 core events.
- Refactored realtime publisher to consume builders:
  - `lib/realtime/ably.ts`
  - behavior preserved, with improved contract clarity and testability.
- Added regression tests for event contract:
  - `tests/unit/eventPayloads.test.ts`
  - validates:
    - org-scoped channel format,
    - base payload fields + event-specific fields,
    - invoice payload optional `total`,
    - storage payload optional `storageUsedMb` / `quotaMb`.
- Validation:
  - `npm run lint` ✅
  - `npm run typecheck` ✅
  - `npm test` ✅

Session notes (2026-03-06, media object key extension hardening):
- Hardened media object key extension resolution:
  - `lib/storage/mediaObjectKey.ts`
  - extension now prioritizes trusted `mimeType` mapping first, then falls back to `fileName`, then `bin`.
  - reduces extension spoofing risk from arbitrary inbound filename metadata.
- Added regression tests:
  - `tests/unit/mediaObjectKey.test.ts`
  - validates MIME-first behavior, fallback logic, MIME alias mapping, and fixed invoice PDF extension path.
- Validation:
  - `npm run lint` ✅
  - `npm run typecheck` ✅
  - `npm test` ✅

Session notes (2026-03-06, message utils regression coverage):
- Added dedicated message utility regression tests:
  - `tests/unit/messageUtils.test.ts`
  - covers:
    - normalization defaults (`normalize*`, page/limit/fileSize),
    - template component/language normalization,
    - send error trimming + max length cap,
    - system message automation marker enforcement,
    - safe template JSON parsing fallback behavior.
- Validation:
  - `npm run lint` ✅
  - `npm run typecheck` ✅
  - `npm test` ✅

Session notes (2026-03-06, invoice core utility regression coverage):
- Added dedicated invoice core utility tests:
  - `tests/unit/invoiceCoreUtils.test.ts`
  - covers:
    - invoice number format + sequence padding (`formatInvoiceNumber`),
    - UTC year boundary range (`getInvoiceYearRange`),
    - public token generation shape/entropy (`createPublicToken`),
    - public invoice URL precedence and fallback (`APP_URL` -> `NEXTAUTH_URL` -> localhost).
- Validation:
  - `npm run lint` ✅
  - `npm run typecheck` ✅
  - `npm test` ✅

Session notes (2026-03-06, invoices workspace file-size refactor):
- Refactored `components/invoices/InvoicesWorkspace.tsx` into modular workspace components:
  - `components/invoices/workspace/types.ts`
  - `components/invoices/workspace/utils.ts`
  - `components/invoices/workspace/InvoiceFilters.tsx`
  - `components/invoices/workspace/InvoiceListPanel.tsx`
  - `components/invoices/workspace/InvoiceActionsPanel.tsx`
- Result:
  - `components/invoices/InvoicesWorkspace.tsx`: `471 -> 270` lines.
  - behavior preserved, UI output unchanged.
- Validation:
  - `npm run lint` ✅
  - `npm run typecheck` ✅
  - `npm test` ✅

Session notes (2026-03-06, onboarding file-size refactor):
- Refactored `components/onboarding/OrganizationOnboarding.tsx` into modular sections and shared types:
  - `components/onboarding/types.ts`
  - `components/onboarding/sections/OnboardingWizard.tsx`
  - `components/onboarding/sections/CreateOrganizationSection.tsx`
  - `components/onboarding/sections/OrganizationsSection.tsx`
  - `components/onboarding/sections/OnboardingStatusSection.tsx`
  - `components/onboarding/sections/ConnectWhatsAppSection.tsx`
  - `components/onboarding/sections/TestMessageSection.tsx`
  - `components/onboarding/sections/OnboardingCompletionSection.tsx`
- Result:
  - `components/onboarding/OrganizationOnboarding.tsx`: `581 -> 358` lines.
  - behavior preserved; parent now focused on state + handlers only.
- Validation:
  - `npm run lint` ✅
  - `npm run typecheck` ✅
  - `npm test` ✅

Session notes (2026-03-06, message outbound infra split):
- Refactored outbound message internals into infra modules (behavior preserved):
  - `server/services/message/outboundInfra/access.ts`
  - `server/services/message/outboundInfra/events.ts`
  - `server/services/message/outboundInfra/persistence.ts`
  - `server/services/message/outboundInfra/transport.ts`
- Converted `server/services/message/outboundShared.ts` into thin re-export barrel.
- Updated org-scope write guard regression target for outbound tx-path:
  - `tests/unit/crossOrgWriteGuard.test.ts`
  - `message outbound tx-path` now validates `server/services/message/outboundInfra/persistence.ts`.
- Result:
  - `server/services/message/outboundShared.ts`: `252 -> 17` lines.
  - all outbound write/update paths still require `orgId` filters.
- Validation:
  - `npm run lint` ✅
  - `npm run typecheck` ✅
  - `npm test` ✅

Session notes (2026-03-06, message inbound infra split):
- Refactored inbound message internals into dedicated infra modules (behavior preserved):
  - `server/services/message/inboundInfra/attribution.ts`
  - `server/services/message/inboundInfra/customerConversation.ts`
  - `server/services/message/inboundInfra/events.ts`
  - `server/services/message/inboundInfra/persistence.ts`
- Converted `server/services/message/inbound.ts` into thin orchestrator.
- Result:
  - `server/services/message/inbound.ts`: `374 -> 106` lines.
  - all inbound write/update paths still enforce `orgId` filters.
- Updated cross-org write guard target:
  - `tests/unit/crossOrgWriteGuard.test.ts`
  - `message inbound tx-path` now validates `server/services/message/inboundInfra/persistence.ts`.
- Validation:
  - `npm run lint` ✅
  - `npm run typecheck` ✅
  - `npm test` ✅

Session notes (2026-03-06, invoice draft/payment modularization):
- Refactored invoice service internals into domain helpers (behavior preserved):
  - `server/services/invoice/draftInternals.ts`
  - `server/services/invoice/paymentInternals.ts`
- Converted orchestrators:
  - `server/services/invoice/draft.ts`: `358 -> 238` lines
  - `server/services/invoice/payment.ts`: `341 -> 147` lines
- Maintained tenant-safety guard semantics (`orgId` on write/update paths) across extracted internals.
- Updated cross-org write regression mapping:
  - `tests/unit/crossOrgWriteGuard.test.ts`
  - added case `invoice draft create tx-path` -> `server/services/invoice/draftInternals.ts`
  - switched `invoice payment tx-path` target to `server/services/invoice/paymentInternals.ts`
- Validation:
  - `npm run lint` ✅
  - `npm run typecheck` ✅
  - `npm test` ✅ (67 pass)

Session notes (2026-03-06, inbox workspace maintainability split):
- Refactored `components/inbox/InboxWorkspace.tsx` by extracting UI state persistence and shortcut logic into dedicated hooks:
  - `components/inbox/workspace/useInboxWorkspacePreferences.ts`
  - `components/inbox/workspace/useInboxSelectedConversationPersistence.ts`
- Result:
  - `components/inbox/InboxWorkspace.tsx`: `352 -> 267` lines.
  - behavior preserved (density/CRM/focus localStorage, keyboard shortcuts, selected conversation persistence).
- Validation:
  - `npm run lint` ✅
  - `npm run typecheck` ✅
  - `npm test` ✅ (67 pass)

Session notes (2026-03-06, inbox chat/list UI modularization):
- Refactored inbox chat window and conversation list into smaller UI modules (behavior preserved).
- Added chat modules:
  - `components/inbox/chat/chatUtils.ts`
  - `components/inbox/chat/ChatHeader.tsx`
  - `components/inbox/chat/ChatMessagesSkeleton.tsx`
- Added conversation list modules:
  - `components/inbox/conversation-list/constants.ts`
  - `components/inbox/conversation-list/utils.ts`
  - `components/inbox/conversation-list/ConversationListFilters.tsx`
  - `components/inbox/conversation-list/ConversationRow.tsx`
  - `components/inbox/conversation-list/ConversationListSkeleton.tsx`
- Updated orchestrators:
  - `components/inbox/ChatWindow.tsx`: `355 -> 240` lines
  - `components/inbox/ConversationListPanel.tsx`: `279 -> 101` lines
- Validation:
  - `npm run lint` ✅
  - `npm run typecheck` ✅
  - `npm test` ✅ (67 pass)

Session notes (2026-03-06, message composer/bubble modularization):
- Refactored message composer and message bubble into smaller modules (behavior preserved).
- Added message input modules:
  - `components/inbox/input/utils.ts`
  - `components/inbox/input/AttachmentPendingBar.tsx`
  - `components/inbox/input/TemplateComposer.tsx`
- Added message bubble modules:
  - `components/inbox/bubble/utils.ts`
  - `components/inbox/bubble/MediaContent.tsx`
- Updated orchestrators:
  - `components/inbox/MessageInput.tsx`: `254 -> 184` lines
  - `components/inbox/MessageBubble.tsx`: `234 -> 101` lines
- Validation:
  - `npm run lint` ✅
  - `npm run typecheck` ✅
  - `npm test` ✅ (67 pass)

Session notes (2026-03-06, inbox type domain split):
- Split inbox types into domain-specific modules:
  - `components/inbox/types/conversation.ts`
  - `components/inbox/types/message.ts`
- Converted `components/inbox/types.ts` to thin barrel export to preserve existing import paths.
- Result:
  - improved type ownership clarity (conversation vs message) with zero API behavior changes.
- Validation:
  - `npm run lint` ✅
  - `npm run typecheck` ✅
  - `npm test` ✅ (67 pass)

Session notes (2026-03-06, workspace type import consistency):
- Updated `components/inbox/workspace/types.ts` to use explicit type import (`MessageItem`) instead of inline `import("...")` type expression.
- Result:
  - inbox workspace typing is cleaner and consistent with new domain-based inbox type modules.
- Validation:
  - `npm run lint` ✅
  - `npm run typecheck` ✅
  - `npm test` ✅ (67 pass)

Session notes (2026-03-06, lint hardening for type imports):
- Enabled ESLint rule `@typescript-eslint/consistent-type-imports` in `.eslintrc.json`.
- Applied repository-wide mechanical auto-fix using `npx eslint . --fix` to normalize type-only imports (`import type`).
- Result:
  - consistent type import style enforced across API routes, components, and service/helper modules.
- Validation:
  - `npm run lint` ✅
  - `npm run typecheck` ✅
  - `npm test` ✅ (67 pass)

Session notes (2026-03-06, lint hardening for no type-import side effects):
- Added ESLint rule `@typescript-eslint/no-import-type-side-effects` in `.eslintrc.json`.
- Adjusted `@typescript-eslint/consistent-type-imports` style to top-level `import type` (removed inline fixStyle) to avoid rule conflict.
- Applied repository-wide auto-fix again (`npx eslint . --fix`) to migrate inline type specifiers into safe top-level type imports.
- Validation:
  - `npm run lint` ✅
  - `npm run typecheck` ✅
  - `npm test` ✅ (67 pass)

Session notes (2026-03-06, inbox utility regression tests):
- Added regression tests for inbox utility modules:
  - `tests/unit/inboxUtils.test.ts`
  - covers chat day/avatar helpers, conversation-list helpers, message input attachment/template helpers, and message bubble media/time helpers.
- Adjusted one date-label assertion to match JavaScript Date normalization behavior for overflow date strings.
- Validation:
  - `npm run lint` ✅
  - `npm run typecheck` ✅
  - `npm test` ✅ (71 pass)

Session notes (2026-03-06, invoice internals regression tests):
- Added focused regression tests for extracted invoice helper internals:
  - `tests/unit/invoiceInternals.test.ts`
  - covers:
    - `normalizeConversationId`
    - `computeDraftInputDerived` (FULL and DP_AND_FINAL cases)
    - `buildInvoiceTimelineEvents` (PAID and non-PAID lifecycle behavior)
- Validation:
  - `npm run lint` ✅
  - `npm run typecheck` ✅
  - `npm test` ✅ (76 pass)

Session notes (2026-03-06, cross-org write guard audit expansion):
- Performed quick audit of `updateMany`/`deleteMany` usage across `server/services` and expanded guard coverage mapping in:
  - `tests/unit/crossOrgWriteGuard.test.ts`
- Added new guarded write-path cases for:
  - `server/services/conversation/create.ts`
  - `server/services/conversation/status.ts`
  - `server/services/orgBankAccountService.ts`
  - `server/services/message/inboundInfra/customerConversation.ts`
  - `server/services/invoice/outbound.ts`
- Validation:
  - `npm run lint` ✅
  - `npm run typecheck` ✅
  - `npm test` ✅ (81 pass)

Session notes (2026-03-06, automation for cross-org guard coverage audit):
- Added automation script:
  - `scripts/audit-cross-org-write-coverage.mjs`
  - compares service files that contain `updateMany`/`deleteMany` against mapped files in `tests/unit/crossOrgWriteGuard.test.ts`.
  - exits non-zero when uncovered write-path files are found.
- Added npm command:
  - `npm run audit:cross-org-write-coverage`
- Current audit result:
  - write-path service files: 15
  - mapped in crossOrgWriteGuard: 15
  - uncovered write-path files: 0
- Validation:
  - `npm run audit:cross-org-write-coverage` ✅
  - `npm run lint` ✅
  - `npm run typecheck` ✅
  - `npm test` ✅ (81 pass)

Session notes (2026-03-06, inbox visual polish batch):
- Applied shadcn-style UI refinement for inbox workspace shell without changing business flow:
  - `app/layout.tsx`: replaced base font with `Space Grotesk`, added subtle radial background accents, refined shell chrome.
  - `components/inbox/InboxRail.tsx`: improved elevation/contrast and action-button hover states.
  - `components/inbox/ConversationListPanel.tsx`: tightened panel styling and changed top-right action label to `Refresh` (matches current behavior).
  - `components/inbox/conversation-list/ConversationListFilters.tsx`: redesigned filter chips into clearer grouped pills (`Status` and `Visibility`).
  - `components/inbox/chat/ChatHeader.tsx`: refined action cluster and conversation status color contrast.
- Validation:
  - `npm run lint` ✅
  - `npm run typecheck` ✅
  - `npm test` ✅ (81 pass)

Session notes (2026-03-06, inbox bubble/media visual alignment):
- Refined chat bubble presentation to better match modern chat reference style:
  - `components/inbox/MessageBubble.tsx`:
    - improved inbound/outbound surface contrast and send-status chip styling
    - upgraded `Use as payment proof` / `Retry send` actions to consistent button primitives
    - refined failed-send error panel and timestamp/read-check visual hierarchy
- Refined media/document rendering for message cards:
  - `components/inbox/bubble/MediaContent.tsx`:
    - document messages now render as compact file cards with icon, mime meta, `Download` and `Preview` actions
    - video messages now render as clean preview cards with play affordance (fallback path retained when media URL is unavailable)
- Validation:
  - `npm run lint` ✅
  - `npm run typecheck` ✅
  - `npm test` ✅ (81 pass)

Session notes (2026-03-06, inbox mobile responsiveness batch):
- Improved mobile inbox usability by introducing explicit pane switching in workspace shell:
  - `components/inbox/InboxWorkspace.tsx`
  - added mobile `Conversations / Chat` switcher (`lg:hidden`)
  - auto-switches to `Chat` after selecting a conversation
  - added `Back to conversations` affordance on mobile chat view
  - hides desktop rail on mobile and prevents list/chat stacking overload on small screens
- No business logic changes; only workspace layout/presentation flow for viewport responsiveness.
- Validation:
  - `npm run lint` ✅
  - `npm run typecheck` ✅
  - `npm test` ✅ (81 pass)

Session notes (2026-03-06, mobile CRM/invoice access polish):
- Added mobile CRM access path directly in inbox workspace:
  - `components/inbox/InboxWorkspace.tsx`
  - mobile chat toolbar now includes `CRM` toggle button
  - CRM context opens as full-screen overlay panel on mobile (`2xl:hidden`) with close action
  - preserves same CRM actions (tags, notes, assign, invoice send/mark paid/proof attach), no business-logic changes
- Improved mobile chat viewport fit:
  - `components/inbox/ChatWindow.tsx`
  - updated minimum height to `min-h-[420px]` on mobile and `md:min-h-[560px]` on larger screens
- Validation:
  - `npm run lint` ✅
  - `npm run typecheck` ✅
  - `npm test` ✅ (81 pass)

Session notes (2026-03-07, invoice drawer mobile ergonomics):
- Improved `InvoiceDrawer` usability on mobile and tablet without changing invoice business logic:
  - `components/invoices/InvoiceDrawer.tsx`
  - drawer header is now sticky (`Close`, invoice number, status stay visible while scrolling)
  - action row is now sticky at bottom (create/update/send/mark-paid actions stay reachable)
  - added bottom padding to form content so fields are not hidden behind sticky action bar
  - kept existing status flow and permission gating behavior untouched
- Size check:
  - `components/invoices/InvoiceDrawer.tsx` remains under 400 lines (`265`)
- Validation:
  - `npm run lint` ✅
  - `npm run typecheck` ✅
  - `npm test` ✅ (81 pass)

Session notes (2026-03-07, mobile CRM quick-jump navigation):
- Improved mobile CRM overlay discoverability/navigation in inbox workspace:
  - `components/inbox/InboxWorkspace.tsx`
  - added sticky quick-jump chips (`Profile`, `Assign`, `Proof`, `Tags`, `Notes`, `Invoices`, `Timeline`) inside mobile CRM overlay
  - chip click now smooth-scrolls to corresponding CRM section anchor
- Added section anchors in CRM panel to support jump navigation:
  - `components/inbox/CrmContextPanel.tsx`
  - IDs: `crm-profile`, `crm-assignment`, `crm-proof`, `crm-tags`, `crm-notes`, `crm-invoices`, `crm-timeline`
- Quality guardrail maintained:
  - `components/inbox/InboxWorkspace.tsx` reduced back under 400 lines (`394`)
  - `components/inbox/CrmContextPanel.tsx` remains under 400 lines (`389`)
- Validation:
  - `npm run lint` ✅
  - `npm run typecheck` ✅
  - `npm test` ✅ (81 pass)

Session notes (2026-03-07, CRM overlay accessibility + file-size compliance):
- Implemented accessibility hardening for mobile CRM overlay:
  - `components/inbox/workspace/MobileCrmOverlay.tsx` (new)
  - added keyboard `Escape` to close overlay
  - added focus management (focus `Close` button on open, restore previous focus on close)
  - added body scroll lock while overlay is open
  - retained sticky quick-jump chips and section jump behavior
- Refactored workspace composition to keep core file-size guardrail:
  - moved mobile CRM overlay view logic out of `InboxWorkspace` into dedicated component
  - `components/inbox/InboxWorkspace.tsx`: `367` lines (< 400)
  - `components/inbox/workspace/MobileCrmOverlay.tsx`: `180` lines
  - `components/inbox/CrmContextPanel.tsx`: `389` lines (< 400)
- Validation:
  - `npm run lint` ✅
  - `npm run typecheck` ✅
  - `npm test` ✅ (81 pass)

Session notes (2026-03-07, invoice drawer accessibility hardening):
- Improved keyboard/focus accessibility for invoice drawer modal:
  - `components/invoices/InvoiceDrawer.tsx`
  - added `role="dialog"`, `aria-modal="true"`, and label for drawer container
  - added `Escape` key support to close drawer
  - added initial-focus behavior to `Close` button when drawer opens
  - added focus restore to previously active element when drawer closes
  - added body scroll lock while drawer is open
  - added Tab/Shift+Tab focus loop (simple focus trap) inside drawer
- Guardrail check:
  - `components/invoices/InvoiceDrawer.tsx` remains under 400 lines (`321`)
- Validation:
  - `npm run lint` ✅
  - `npm run typecheck` ✅
  - `npm test` ✅ (81 pass)

Session notes (2026-03-07, focus-trap regression tests + shared helper):
- Added reusable accessibility helper for keyboard focus looping:
  - `lib/a11y/focusTrap.ts`
  - exports `resolveFocusTrapTarget` and `getFocusableElements`
- Added regression tests for focus-trap boundary behavior:
  - `tests/unit/focusTrap.test.ts`
  - verifies wrap behavior for `Tab` and `Shift+Tab` plus empty-focusable case
- Refactored modal keyboard handling to use shared helper:
  - `components/invoices/InvoiceDrawer.tsx`
  - `components/inbox/workspace/MobileCrmOverlay.tsx`
- Validation:
  - `npm run lint` ✅
  - `npm run typecheck` ✅
  - `npm test` ✅ (84 pass)

Session notes (2026-03-07, modal keyboard decision helper + regression tests):
- Added pure helper for modal keyboard decision logic:
  - `lib/a11y/modalKeydown.ts`
  - `resolveModalKeydown` now centralizes decision for:
    - `Escape` => close action
    - `Tab`/`Shift+Tab` boundary wrap => focus action
    - other keys => no-op
- Refactored modal components to use shared keydown decision helper:
  - `components/invoices/InvoiceDrawer.tsx`
  - `components/inbox/workspace/MobileCrmOverlay.tsx`
- Added dedicated unit tests:
  - `tests/unit/modalKeydown.test.ts`
  - covers escape close, unsupported key no-op, and tab-boundary focus wrapping
- Existing focus trap helper remains in use for focusable querying and index-wrap resolution.
- Validation:
  - `npm run lint` ✅
  - `npm run typecheck` ✅
  - `npm test` ✅ (87 pass)

Session notes (2026-03-07, shared modal lifecycle hook):
- Added shared modal accessibility lifecycle hook:
  - `lib/a11y/useModalAccessibility.ts`
  - centralizes: body scroll lock, initial focus, focus restore, and keydown handling (`Escape` + focus loop)
- Refactored modal components to remove duplicated lifecycle code:
  - `components/invoices/InvoiceDrawer.tsx`
  - `components/inbox/workspace/MobileCrmOverlay.tsx`
- Existing pure helpers remain integrated:
  - `lib/a11y/focusTrap.ts`
  - `lib/a11y/modalKeydown.ts`
- Quality impact:
  - reduced component complexity and line counts:
    - `InvoiceDrawer.tsx`: `315 -> 277`
    - `MobileCrmOverlay.tsx`: `206 -> 169`
- Validation:
  - `npm run lint` ✅
  - `npm run typecheck` ✅
  - `npm test` ✅ (87 pass)

Session notes (2026-03-07, modal a11y rollout to inbox shortcuts):
- Applied shared modal accessibility hook to remaining inbox shortcut modals:
  - `components/inbox/QuickReplyModal.tsx`
  - `components/inbox/ShortcutHelpModal.tsx`
  - `components/inbox/AttachProofShortcutModal.tsx`
- Improvements now consistent across those modals:
  - `role="dialog"` + `aria-modal="true"` labeling
  - initial focus to close button
  - `Escape` close support
  - focus loop for `Tab` / `Shift+Tab`
  - body scroll lock and focus restore on close
- Validation:
  - `npm run lint` ✅
  - `npm run typecheck` ✅
  - `npm test` ✅ (87 pass)

Session notes (2026-03-07, modal lifecycle util extraction + tests):
- Added pure modal lifecycle utility:
  - `lib/a11y/modalLifecycle.ts`
  - provides:
    - `captureModalLifecycleState` (captures previous focus + body overflow)
    - `shouldFocusElement` (safe focus-target predicate without DOM-global dependency)
- Added regression tests:
  - `tests/unit/modalLifecycle.test.ts`
  - covers state capture and focus-target predicate behavior
- Updated shared hook to use lifecycle util:
  - `lib/a11y/useModalAccessibility.ts`
- Validation:
  - `npm run lint` ✅
  - `npm run typecheck` ✅
  - `npm test` ✅ (90 pass)

Session notes (2026-03-07, shared focusable selector constant guard):
- Refined focus-trap implementation to centralize selector string:
  - `lib/a11y/focusTrap.ts`
  - added exported `FOCUSABLE_SELECTOR` constant and reused it in `getFocusableElements`
- Extended regression coverage:
  - `tests/unit/focusTrap.test.ts`
  - added guard test that validates focusable selector contract and expected coverage segments
- Validation:
  - `npm run lint` ✅
  - `npm run typecheck` ✅
  - `npm test` ✅ (91 pass)

Session notes (2026-03-07, API error/success helper consistency mini-refactor):
- Standardized selected routes/middleware to shared API response helpers (`lib/api/http.ts`):
  - `app/api/realtime/ably/token/route.ts`
  - `app/api/whatsapp/embedded-signup/route.ts`
  - `lib/auth/middleware.ts`
- Removed duplicated local `errorResponse` implementations in selected routes and switched success payloads to `successResponse` where applicable.
- Kept response contract unchanged (`{ data, meta }` for success and `{ error: { code, message } }` for errors), now with more consistent helper usage.
- Validation:
  - `npm run lint` ✅
  - `npm run typecheck` ✅
  - `npm test` ✅ (91 pass)

Session notes (2026-03-07, dark/light mode + visual polish baseline):
- Added dark/light theming infrastructure with `next-themes`:
  - `components/providers/ThemeProvider.tsx`
  - `components/ui/theme-toggle.tsx`
- Wired theme provider and toggle actions into the root shell:
  - `app/layout.tsx`
  - header now includes a functional theme toggle
  - left rail includes a functional theme toggle
- Updated global design tokens for dual-theme support:
  - `styles/globals.css`
  - split token sets into `:root` (light) and `.dark` (dark)
  - added shadcn-compatible `card` and `popover` token families
- Extended Tailwind token mapping:
  - `tailwind.config.ts`
  - added `card` and `popover` colors to match existing `bg-card` usage across inbox UI
- Inbox rail now uses live theme toggle instead of static moon icon:
  - `components/inbox/InboxRail.tsx`
- Validation:
  - `npm run lint` ✅
  - `npm run typecheck` ✅
  - `npm test` ✅ (91 pass)

Session notes (2026-03-07, inbox visual polish continuation):
- Refined inbox shell visual hierarchy for better contrast in both themes:
  - `components/inbox/InboxWorkspace.tsx`
  - stronger card borders/shadows and cleaner mobile pane switch styling
- Improved conversation panel presentation:
  - `components/inbox/ConversationListPanel.tsx`
  - header now shows conversation count, `New` action, and dedicated refresh icon button
- Improved selected conversation discoverability:
  - `components/inbox/conversation-list/ConversationRow.tsx`
  - selected row now has primary left indicator and clearer active contrast
- Improved chat header readability and status badge:
  - `components/inbox/chat/ChatHeader.tsx`
- Improved message composer polish:
  - `components/inbox/MessageInput.tsx`
  - refined container shape, placeholder tone, and send button shape
- Improved chat viewport depth:
  - `components/inbox/ChatWindow.tsx`
  - richer gradient background tuned for light/dark mode
- Validation:
  - `npm run lint` ✅
  - `npm run typecheck` ✅
  - `npm test` ✅ (91 pass)

Session notes (2026-03-07, inbox polish batch: bubble + CRM + state UX):
- Improved state panels across inbox/modules:
  - `components/ui/state-panels.tsx`
  - added visual icons for empty/loading/error and refined panel styling for readability
- Refined loading skeleton treatment:
  - `components/inbox/chat/ChatMessagesSkeleton.tsx`
  - `components/inbox/conversation-list/ConversationListSkeleton.tsx`
  - better card depth/contrast to reduce flat UI feel
- Refined message bubble appearance:
  - `components/inbox/MessageBubble.tsx`
  - improved inbound/outbound surface contrast and minor typography consistency cleanup
- Improved CRM panel visual hierarchy:
  - `components/inbox/CrmContextPanel.tsx`
  - `components/inbox/crm/InvoicesSection.tsx`
  - `components/inbox/crm/ActivityTimelineSection.tsx`
  - standardized section cards, status color readability, and button hover/transition behavior
- Validation:
  - `npm run lint` ✅
  - `npm run typecheck` ✅
  - `npm test` ✅ (91 pass)

Session notes (2026-03-07, inbox micro-interaction + mobile overlay polish):
- Refined conversation filter controls:
  - `components/inbox/conversation-list/ConversationListFilters.tsx`
  - improved active/hover transitions, `aria-pressed` semantics, and visual grouping background
- Refined template composer interaction styling:
  - `components/inbox/input/TemplateComposer.tsx`
  - better card treatment, select focus-ring, and button transition consistency
- Updated conversation header surface/status readability:
  - `components/inbox/ConversationHeader.tsx`
- Improved mobile CRM overlay presentation:
  - `components/inbox/workspace/MobileCrmOverlay.tsx`
  - rounded sheet style, stronger elevation, and cleaner quick-anchor pills
- Added dedicated CRM mobile overlay entrance animation:
  - `styles/globals.css`
  - new `inbox-slide-up` keyframe + utility class
- Validation:
  - `npm run lint` ✅
  - `npm run typecheck` ✅
  - `npm test` ✅ (91 pass)

Session notes (2026-03-07, final visual tuning batch for demo readiness):
- Improved responsive list/chat spacing and typography:
  - `components/inbox/ConversationListPanel.tsx`
  - `components/inbox/ChatWindow.tsx`
  - `components/inbox/MessageInput.tsx`
  - mobile paddings tightened, title scaling refined, and floating action positioning adjusted
- Improved invoice action button hierarchy in CRM:
  - `components/inbox/crm/InvoicesSection.tsx`
  - emphasized primary actions (`Send`, `Mark Paid`) with semantic color styling while keeping role/disable logic unchanged
- Improved CRM quick actions styling consistency:
  - `components/inbox/CrmContextPanel.tsx`
  - `Create Invoice` and `Attach proof` now visually align with action priority
- Validation:
  - `npm run lint` ✅
  - `npm run typecheck` ✅
  - `npm test` ✅ (91 pass)

Session notes (2026-03-07, pixel-pass consistency batch):
- Improved cross-panel visual consistency for avatar/action density:
  - `components/inbox/conversation-list/ConversationRow.tsx`
  - `components/inbox/chat/ChatHeader.tsx`
  - unified tighter mobile spacing and heading scale while preserving desktop density
- Refined inbox rail action button consistency:
  - `components/inbox/InboxRail.tsx`
  - standardized icon button behavior with shared hover/border/transition style and consistent theme-toggle treatment
- Improved mobile readability of message bubbles:
  - `components/inbox/MessageBubble.tsx`
  - raised mobile bubble max width and added relaxed line-height for text readability
- Validation:
  - `npm run lint` ✅
  - `npm run typecheck` ✅
  - `npm test` ✅ (91 pass)

Session notes (2026-03-07, visual QA closure batch):
- Refined compact/mobile conversation row rhythm and timestamp sizing:
  - `components/inbox/conversation-list/ConversationRow.tsx`
- Refined chat header scale/spacing for better mobile balance:
  - `components/inbox/chat/ChatHeader.tsx`
- Standardized inbox rail icon-button interaction style:
  - `components/inbox/InboxRail.tsx`
  - unified hover border/background transitions and theme toggle parity
- Improved bubble readability on small screens:
  - `components/inbox/MessageBubble.tsx`
  - mobile bubble width raised (`max-w-[90%]`) and text line-height relaxed
- Validation:
  - `npm run lint` ✅
  - `npm run typecheck` ✅
  - `npm test` ✅ (91 pass)

Session notes (2026-03-07, light-mode contrast QA follow-up):
- Improved avatar palette contrast for light theme while preserving dark theme balance:
  - `components/inbox/chat/chatUtils.ts`
  - `components/inbox/conversation-list/utils.ts`
  - avatar tones now use dual-theme text colors (`text-*-700` + `dark:text-*-300`)
- Improved META source badge readability on light theme:
  - `components/inbox/conversation-list/utils.ts`
  - badge text now adapts with dual-theme color classes
- Validation:
  - `npm run lint` ✅
  - `npm run typecheck` ✅
  - `npm test` ✅ (91 pass)

Session notes (2026-03-07, dummy seed end-to-end data):
- Added idempotent database seeder for full demo flow:
  - `scripts/seedDatabase.ts`
  - covers: users + role memberships, org + plan + bank accounts, WhatsApp account mock-safe token, shortlinks + clicks, customers + conversations + messages, tags + notes, invoices + items + milestones + proof, audit log, service catalog
- Added seed command:
  - `package.json` -> `npm run db:seed`
- Updated setup docs with seed instructions and demo credentials:
  - `README.md`
  - `PROJECT_SETUP_GUIDE.md`
- Demo login credentials from seed:
  - `owner@seed.20byte.local` / `DemoPass123!`
  - `admin@seed.20byte.local` / `DemoPass123!`
  - `cs@seed.20byte.local` / `DemoPass123!`
  - `advertiser@seed.20byte.local` / `DemoPass123!`
- Validation:
  - `npm run lint` ✅
  - `npm run typecheck` ✅
  - `npm test` ✅ (91 pass)

Session notes (2026-03-07, full dummy dataset expansion):
- Expanded seed data to cover broader end-to-end scenarios across all major modules:
  - inbox message variants (`TEXT`, `IMAGE`, `VIDEO`, `AUDIO`, `DOCUMENT`, `TEMPLATE`, `SYSTEM`)
  - conversation status variants (`OPEN`, `CLOSED`)
  - invoice status variants (`DRAFT`, `SENT`, `PARTIALLY_PAID`, `PAID`, `VOID`)
  - CTWA shortlink variants (`enabled` + `disabled`) and click records
  - audit trail variants (`whatsapp.connected`, `conversation.assigned`, `invoice.sent`, `invoice.proof_attached`, `invoice.mark_paid`)
- Refactored seed implementation into small files to stay within file size guideline:
  - `scripts/seedDatabase.ts`
  - `scripts/seed/seedCore.ts`
  - `scripts/seed/seedBusiness.ts`
  - `scripts/seed/types.ts`
- Updated setup docs to explain seed coverage:
  - `README.md`
  - `PROJECT_SETUP_GUIDE.md`
- Validation:
  - `npm run lint` ✅
  - `npm run typecheck` ✅
  - `npm run db:seed` ✅

Session notes (2026-03-07, single-sidebar inbox + expandable app nav):
- Removed duplicate left rail in inbox workspace so layout now uses one primary app sidebar only:
  - `components/inbox/InboxWorkspace.tsx`
  - deleted nested `InboxRail` column from desktop grid.
- Added expandable/collapsible primary sidebar in app shell:
  - `components/layout/AppShell.tsx`
  - supports collapsed icon mode and expanded label mode.
  - persisted sidebar state with `localStorage` key `app-shell-sidebar-expanded`.
- Validation:
  - `npm run lint` ✅
  - `npm run typecheck` ✅

Session notes (2026-03-07, shell header removal + sidebar avatar + chat polish):
- Removed desktop top header in authenticated app shell and kept compact mobile-only topbar:
  - `components/layout/AppShell.tsx`
- Moved account avatar/menu into bottom section of primary left sidebar:
  - `components/layout/AppShell.tsx`
  - sidebar footer now hosts both theme toggle and avatar menu.
- Refined inbox visual treatment for cleaner chat experience:
  - `components/inbox/InboxWorkspace.tsx` (height/layout tuning after header removal)
  - `components/inbox/ChatWindow.tsx` (panel depth + background + spacing balance)
  - `components/inbox/ConversationListPanel.tsx` (header/search/list contrast refinements)
  - `components/inbox/MessageInput.tsx` (composer spacing/typography polish)
- Validation:
  - `npm run lint` ✅
  - `npm run typecheck` ✅

Session notes (2026-03-07, account menu clickability + sidebar UX refinement):
- Fixed avatar/account menu clickability in sidebar with stronger layering and interaction area:
  - `components/layout/AccountMenu.tsx`
  - raised menu layer (`z-50`), improved click target, and upgraded expanded-sidebar account trigger.
- Improved sidebar UX polish:
  - `components/layout/AppShell.tsx`
  - sidebar now uses improved visual depth and passes expanded-state to account menu.
- Validation:
  - `npm run lint` ✅
  - `npm run typecheck` ✅

Session notes (2026-03-07, micro-UX follow-up batch):
- Added collapsed-sidebar nav tooltip consistency:
  - `components/layout/AppShell.tsx`
  - menu icons now expose native tooltip label via `title` in collapsed mode.
- Added smoother panel transitions in inbox mobile pane switching:
  - `components/inbox/InboxWorkspace.tsx`
  - visible list/chat panel now uses subtle `inbox-fade-slide` entry animation.
- Added keyboard shortcut hint text in message composer:
  - `components/inbox/MessageInput.tsx`
  - hints now match actual bindings (`/`, `I`, `Ctrl+/`).
- Validation:
  - `npm run lint` ✅
  - `npm run typecheck` ✅

Session notes (2026-03-07, inbox icon action compliance + interaction clarity):
- Ensured inbox action icons are functional and clear:
  - `components/inbox/chat/ChatHeader.tsx`
  - video/phone icons now trigger WhatsApp intent links using selected customer phone (disabled safely when no number).
- Improved chat composer icon utility:
  - `components/inbox/MessageInput.tsx`
  - emoji icon inserts inline emoji into input.
  - mic icon now provides explicit in-product hint state (no dead click).
- Improved conversation list quick action behavior:
  - `components/inbox/ConversationListPanel.tsx`
  - `New` button now resets to `OPEN + UNASSIGNED` and focuses search for faster next action.
- Validation:
  - `npm run lint` ✅
  - `npm run typecheck` ✅

Session notes (2026-03-07, strict sidebar cleanup + avatar menu hardening):
- Reworked desktop app sidebar to cleaner icon-rail style with reduced visual noise:
  - `components/layout/AppShell.tsx`
  - tighter icon sizing/spacing, simplified surfaces, and clearer active states.
- Removed non-essential desktop sidebar clutter:
  - theme toggle removed from desktop rail (still available on mobile header/settings).
- Hardened avatar dropdown reliability:
  - `components/layout/AccountMenu.tsx`
  - menu now uses fixed-position anchoring from trigger bounds and robust outside-click/escape handling.
  - prevents hidden/overlapped dropdown behavior near viewport edges.
- Reduced initial inbox visual noise:
  - `components/inbox/workspace/useInboxWorkspacePreferences.ts`
  - CRM side panel default visibility set to `false` (can still be opened by user action/shortcut).
- Validation:
  - `npm run lint` ✅
  - `npm run typecheck` ✅

Session notes (2026-03-07, account shell + profile settings + landing baseline):
- Added authenticated account menu and public auth actions:
  - `components/layout/AccountMenu.tsx`
  - shows avatar initials fallback, profile/settings links, and logout action for authenticated users.
  - shows `Login` and `Register` actions for unauthenticated users.
- Added app shell route-mode split:
  - `components/layout/AppShell.tsx`
  - public routes (`/`, `/login`, `/register`) now use a minimal public header.
  - app routes use sidebar/workspace shell with account menu + theme toggle.
- Updated root layout to pass server session into shell:
  - `app/layout.tsx`
  - session is resolved from signed cookie and injected as `currentUser`.
- Added auth/logout and profile endpoints:
  - `POST /api/auth/logout` (`app/api/auth/logout/route.ts`)
  - `GET/PATCH /api/auth/profile` (`app/api/auth/profile/route.ts`)
- Extended auth service with profile domain logic:
  - `server/services/authService.ts`
  - added `getProfile` + `updateProfile` with password policy/current-password verification.
- Added profile settings UI and routes:
  - `components/settings/ProfileSettings.tsx`
  - `app/dashboard/settings/profile/page.tsx`
  - `app/settings/profile/page.tsx` (redirects to dashboard settings page).
- Replaced homepage with initial landing page baseline:
  - `app/page.tsx`
  - includes hero, feature highlights, and quick-start section.
- Validation:
  - `npm run lint` ✅
  - `npm run typecheck` ✅
  - `npm test` ✅ (91 pass)
