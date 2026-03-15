# DOC 05 — WhatsApp Integration Architecture
File: DOC_05_WHATSAPP_INTEGRATION.md

Product: 20byte
Integration: Baileys
Mode: Multi-device session pairing

Purpose:

This document defines the active WhatsApp integration used by 20byte.

It covers:

- QR and pairing-code onboarding
- socket lifecycle
- inbound message ingestion
- outbound message sending
- media handling
- current MVP limitations

---

# 1. Integration Overview

20byte uses Baileys as the active WhatsApp transport layer.

Connection methods:

- scan QR from settings
- or request a pairing code and enter it on the primary device

Important MVP rule:

1 organization = 1 active Baileys-linked WhatsApp number.

---

# 2. WhatsApp Connection Flow

First-time users connect WhatsApp from onboarding or settings.

Steps:

1. User clicks `Hubungkan WhatsApp`
2. Modal opens with QR tab and auth-code tab
3. User scans the QR or enters the pairing code from the phone
4. Baileys completes multi-device linking
5. The system persists the linked phone number for that organization
6. User can send a test message and continue to inbox

---

# 3. Stored WhatsApp Connection State

The active session consists of:

- database summary row in `WaAccount`
- auth files in `.runtime/baileys-auth/<orgId>`
- media files in `.runtime/baileys-media/<orgId>`

Current compatibility note:

- `WaAccount.metaBusinessId` and `WaAccount.wabaId` are set to `"baileys"` as a provider marker
- `WaAccount.accessTokenEnc` stores a placeholder string for schema compatibility and is no longer a Meta token

---

# 4. Inbound Event Source

Inbound messages no longer come from a Meta webhook.

Source of truth:

- `messages.upsert` events from the active Baileys socket

The service maps those events into the existing inbox persistence pipeline.

---

# 5. Inbound Idempotency

Each inbound WhatsApp message still carries a `waMessageId`.

Before inserting a message into database:

- check whether the `waMessageId` already exists
- if yes, skip duplicate persistence
- if no, continue normal processing

---

# 6. Incoming Message Flow

When a customer sends a message:

1. Baileys socket receives `messages.upsert`
2. Backend normalizes payload
3. Message is stored in database
4. If media exists:
   - download media from the socket session
   - persist file in `.runtime/baileys-media`
   - serve it through authenticated app route
5. Publish realtime event via Ably
6. Inbox UI updates

---

# 7. Supported Incoming Message Types

MVP must support:

Text
Image
Video
Audio (voice note)
Document (PDF)

Unsupported types may be ignored or logged.

---

# 8. Media Handling

When media is received:

Backend must:

1. detect media-bearing message type
2. download media via Baileys
3. write file under `.runtime/baileys-media/<orgId>`
4. store authenticated app media URL in database

Metadata fields:

mediaUrl
mimeType
fileSize

File size limits enforced:

Image / PDF:

10MB

Video:

50MB

---

# 9. Outgoing Message Flow

User sends message from chat UI.

Flow:

Chat UI
→ API route
→ Baileys socket send
→ message stored in database
→ realtime event via Ably

---

# 10. Template Messages

For this MVP, template sends are downgraded into text-like outbound messages.

This keeps retry and operator workflow working, but does not preserve official template semantics from Meta Cloud API.

---

# 11. Runtime Notes

Current runtime folders:

- `.runtime/baileys-auth/<orgId>`
- `.runtime/baileys-media/<orgId>`

Tradeoff:

- fast for local MVP work
- not suitable yet for multi-instance production

---

# 12. Current Limitations

Known MVP limitations:

- auth/key persistence is filesystem-based
- template sends are text fallbacks
- there is no distributed socket coordination
- final validation still depends on a real paired WhatsApp device
