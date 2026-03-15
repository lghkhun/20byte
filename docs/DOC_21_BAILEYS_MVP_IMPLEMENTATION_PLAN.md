# DOC 21 - Baileys MVP Implementation Plan

File: `DOC_21_BAILEYS_MVP_IMPLEMENTATION_PLAN.md`

Product: 20byte  
Module: WhatsApp Transport Replacement  
Date verified: March 14, 2026

## 1. Objective

Replace the current Meta WhatsApp API MVP integration with Baileys so the product can:

- connect a WhatsApp account through WhatsApp Web multi-device
- receive inbound messages without Meta webhooks
- send outbound messages directly through the connected Baileys session
- keep the existing inbox, CRM, invoice, and realtime layers usable

This document is both the implementation plan and the current MVP execution record.

## 2. Source Baseline

Implementation decisions in this document were based on:

- Baileys docs index: https://baileys.wiki/docs/category/socket
- Baileys GitHub repository: https://github.com/WhiskeySockets/Baileys/
- npm package page: https://www.npmjs.com/package/baileys

Verified package state on March 14, 2026:

- package name: `baileys`
- npm latest tag: `7.0.0-rc.9`

Relevant guidance taken from upstream:

- use `makeWASocket` as the primary socket entry point
- persist auth state and save key updates on `creds.update`
- rebuild the socket on disconnect unless the session is logged out
- use event-driven ingestion via `messages.upsert` and `connection.update`
- `useMultiFileAuthState` is acceptable as a temporary guide/MVP approach, but production-grade deployments should migrate auth/key storage to SQL/NoSQL

## 3. Architecture Decision

### Decision

For this MVP, 20byte switches from:

- Meta embedded signup
- Meta webhook ingestion
- Meta Graph API outbound send

to:

- Baileys socket session per organization
- pairing-code based onboarding
- direct socket send for outbound messages
- direct event ingestion for inbound messages

### Why

- the current product is already centered on an internal inbox model, so the transport layer can be swapped without rewriting the whole UI
- Baileys removes the dependency on Meta app setup, webhook verification, and Graph API credentials
- pairing-code onboarding is faster for internal MVP use than Meta embedded signup
- constraining the MVP to one business per owner and one WhatsApp number per business reduces operational complexity during real-device rollout

## 4. MVP Scope

### In scope

- single-business model per owner account
- exactly one active WhatsApp number per business
- multi-user collaboration inside the same business
- per-org Baileys session lifecycle
- pairing code generation from onboarding
- inbound message ingestion into existing `Customer` / `Conversation` / `Message` records
- outbound text send
- template-message fallback as text for MVP continuity
- media download from Baileys and serving through authenticated app routes
- retirement of Meta-specific onboarding/webhook routes
- inbox visual refinement closer to competitor screenshots while preserving shadcn patterns

### Out of scope for this MVP

- SQL-backed Baileys auth/key store
- multi-instance distributed socket coordination
- full parity with Meta business templates
- advanced delivery/read receipt reconciliation
- server-managed QR rendering

## 5. Implemented Changes

### Backend provider layer

Added Baileys provider service:

- `server/services/baileysService.ts`

Responsibilities:

- start or reuse an org socket
- persist auth state using `useMultiFileAuthState`
- expose connection context for onboarding
- generate pairing code
- disconnect and clear local runtime data
- send outbound text
- map template sends to text fallback
- process inbound `messages.upsert`
- download inbound media to local runtime storage

### Inbound pipeline

The existing inbox/domain pipeline is preserved.

Baileys events now feed:

- `storeInboundMessage(...)`

Changes made:

- `server/services/message/messageTypes.ts`
- `server/services/message/inbound.ts`
- `server/services/message/inboundInfra/persistence.ts`

Additional inbound fields for MVP:

- `mediaUrl`
- `durationSec`

### Outbound pipeline

Meta transport calls were replaced at the provider boundary instead of rewriting business flows.

Updated files:

- `server/services/message/outboundInfra/access.ts`
- `server/services/message/outboundInfra/transport.ts`
- `server/services/message/outboundShared.ts`
- `server/services/message/outboundSend.ts`
- `server/services/message/outboundRetry.ts`

Result:

- existing inbox send/retry flow still works
- outbound transport now uses Baileys session state instead of Graph API credentials

### Connection/API flow

Added new Baileys management route:

- `app/api/whatsapp/baileys/route.ts`

Capabilities:

- `GET` connection state
- `POST` generate QR or pairing code
- `DELETE` disconnect session

Updated test-message flow:

- `app/api/whatsapp/test-message/route.ts`

Legacy onboarding UI has been retired. The active flow now lives only in Settings.

### Settings connect flow

Added settings-based WhatsApp entry point:

- `app/dashboard/settings/whatsapp/page.tsx`
- `components/settings/WhatsAppConnectionSettings.tsx`

Settings behavior:

- settings root now redirects to WhatsApp settings
- user clicks `Hubungkan WhatsApp`
- a modal popup opens with competitor-inspired two-panel linking flow
- default mode is QR scan
- fallback mode is auth code / pairing code
- modal polls connection state while open
- operators can disconnect or send a test message from settings

### Media serving

Added authenticated media route:

- `app/api/media/[orgId]/[fileName]/route.ts`

Purpose:

- serve Baileys-downloaded media inside the current authenticated app shell
- keep media access scoped by org membership

### Meta-specific retirement

Removed provider-specific files:

- `app/api/whatsapp/embedded-signup/route.ts`
- `app/api/webhooks/whatsapp/route.ts`
- `server/services/whatsappService.ts`
- `server/services/whatsappApiService.ts`
- `server/services/whatsappWebhookService.ts`
- `server/services/whatsappMediaService.ts`
- `server/queues/webhookQueue.ts`
- `worker/processors/whatsappWebhookProcessor.ts`
- `worker/processors/whatsappMediaProcessor.ts`
- `worker/jobs/processWhatsAppWebhookJob.ts`
- `worker/jobs/processWhatsAppMediaJob.ts`
- `lib/whatsapp/webhookSignature.ts`

### Worker cleanup

Updated:

- `worker/index.ts`

Change:

- worker no longer starts Meta webhook/media processors for this MVP
- storage cleanup processors remain active

### Inbox visual pass

Inbox layout was refined to more closely match the competitor screenshots while still using existing shadcn-style primitives.

Updated files:

- `components/inbox/InboxWorkspace.tsx`
- `components/inbox/ConversationListPanel.tsx`
- `components/inbox/conversation-list/ConversationListFilters.tsx`
- `components/inbox/conversation-list/ConversationRow.tsx`
- `components/inbox/ChatWindow.tsx`
- `components/inbox/chat/ChatHeader.tsx`
- `components/inbox/CrmContextPanel.tsx`

Key UI goals addressed:

- stronger competitor-like 3-panel operator layout
- centered empty state card in the chat panel
- denser left conversation list
- more structured CRM sidebar cards
- spacing and visual hierarchy closer to the screenshot reference
- WhatsApp linking modal in settings visually follows the competitor reference while staying within existing shadcn-style primitives

## 6. Runtime Notes

Current Baileys MVP persistence uses local runtime folders:

- `.runtime/baileys-auth/<orgId>`
- `.runtime/baileys-media/<orgId>`

This is intentional for MVP speed.

Tradeoff:

- easy to run locally
- not safe enough for horizontally scaled production

## 7. Known Gaps

### 1. Auth persistence is filesystem-based

Current status:

- acceptable for MVP

Next step:

- move auth/key storage to SQL or Redis-backed persistence

### 2. Template sends are downgraded to text

Current status:

- outbound flow remains usable
- true Meta business template semantics are not preserved

Next step:

- add an internal template renderer or remove template UX until a stable strategy is chosen

### 3. Session lifecycle is app-process local

Current status:

- works for single-instance local/dev deployments

Next step:

- add a socket coordinator for multi-instance deployments

### 4. Message receipt parity is limited

Current status:

- send success is based on Baileys send response

Next step:

- add receipt/update reconciliation for stronger delivery state UX

## 8. Recommended Next Steps

### Phase A

- migrate Baileys auth state to a database-backed store
- store richer device/account metadata than the current compatibility shim in `WaAccount`

### Phase B

- replace template fallback text with internal template rendering
- support outbound media attachments through Baileys

### Phase C

- tighten inbox UI to closer 1:1 parity on:
  - sidebar card density
  - chat canvas tone and padding
  - CRM right-rail spacing and microcopy
  - WhatsApp connection modal spacing and icon rhythm against live browser rendering

## 9. Verification Checklist

Completed during implementation:

- `npm run typecheck`
- `npm run lint`

Manual verification still recommended:

- open `/dashboard/settings/whatsapp`
- click `Hubungkan WhatsApp`
- confirm QR modal opens and polling works
- switch modal from QR to auth code and generate pairing code
- generate pairing code from onboarding
- complete pairing on a real WhatsApp account
- send onboarding test message
- receive a real inbound text message
- verify media image/video/document render in inbox
- verify disconnect clears local runtime session

## 10. Summary

This MVP removes the project’s active dependency on Meta onboarding, Meta webhook ingestion, and Meta Graph API transport. The remaining `WaAccount` schema fields are retained only for database compatibility during the MVP phase.

20byte now runs on a Baileys-first transport layer while preserving the existing inbox domain model and UI shell, which makes it a practical transition path for rapid internal iteration.
