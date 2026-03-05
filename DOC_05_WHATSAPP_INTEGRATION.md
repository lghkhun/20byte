# DOC 05 — WhatsApp Integration Architecture
File: DOC_05_WHATSAPP_INTEGRATION.md

Product: 20byte  
Integration: WhatsApp Cloud API  
Mode: Embedded Signup + Coexistence  

Purpose:

This document defines how 20byte integrates with the WhatsApp Cloud API.

It covers:

- Embedded Signup onboarding
- WhatsApp Webhook handling
- Message sending
- Media handling
- Template messaging
- Conversation window pricing
- Coexistence rules
- Idempotent webhook processing

This document is critical because WhatsApp messaging is the **core infrastructure** of 20byte.

Codex must follow these rules exactly.

---

# 1. Integration Overview

20byte uses:

WhatsApp Cloud API  
via Meta Platform

Connection method:

Embedded Signup  
+  
Coexistence

Embedded Signup allows users to connect their WhatsApp Business account through Meta login.

Coexistence allows users to **continue using the WhatsApp Business App on their phone** while also connecting the number to the Cloud API.

Important MVP rule:

1 Organization = 1 WhatsApp number.

---

# 2. WhatsApp Connection Flow (Embedded Signup)

First-time users must connect WhatsApp during onboarding.

Steps:

1. User clicks "Connect WhatsApp"
2. Popup opens Meta Embedded Signup
3. User logs in to Meta account
4. User selects business portfolio
5. User selects WABA
6. User selects phone number
7. Meta returns:

- business_id
- waba_id
- phone_number_id
- access_token

The system stores these credentials securely.

After successful connection:

- webhook is verified
- test event is triggered
- user is redirected to inbox

---

# 3. Stored WhatsApp Credentials

The system must store the following fields.

WaAccount table:

orgId  
metaBusinessId  
wabaId  
phoneNumberId  
displayPhone  
accessTokenEnc  
connectedAt  

Security rule:

Access tokens must be encrypted before storage.

Tokens must never be logged.

---

# 4. Webhook Endpoint

WhatsApp sends all events to:

```
/api/webhooks/whatsapp
```

Webhook responsibilities:

1. Verify signature
2. Parse payload
3. Identify event type
4. Enqueue job to Redis queue
5. Respond immediately

Webhook must never block processing.

---

# 5. Webhook Idempotency

WhatsApp may resend events.

Therefore webhook processing must be idempotent.

Each message contains:

```
waMessageId
```

Before inserting a message into database:

Check if waMessageId already exists.

If yes:

Skip processing.

If no:

Process normally.

This prevents duplicate messages.

---

# 6. Incoming Message Flow

When a customer sends a message:

1. WhatsApp sends webhook event
2. API receives webhook
3. Event is added to queue
4. Worker processes event
5. Message is stored in database
6. If media exists:
   - download media
   - upload to R2
7. Publish realtime event via Ably
8. Inbox UI updates

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

Worker must:

1. Extract mediaId
2. Call WhatsApp API to download media
3. Upload media file to Cloudflare R2
4. Store metadata in database

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
→ WhatsApp Cloud API  
→ Message stored in database  
→ Realtime event via Ably

---

# 10. Sending Template Messages

Templates must be sent using:

WhatsApp Cloud API template endpoint.

Required fields:

templateName  
languageCode  
components

Example categories:

Marketing  
Utility  
Authentication  
Service

---

# 11. WhatsApp Template Cost Display

The platform must show estimated cost.

Indonesian pricing (example reference):

Marketing:

Rp 818

Utility:

Rp 498

Authentication:

Rp 498

Service:

Rp 0

Important:

Meta charges **per conversation window**, not per message.

UI must show a tooltip explaining this.

---

# 12. Conversation Window Logic

WhatsApp charges based on conversation windows.

Types:

Marketing window  
Utility window  
Authentication window  
Service window

Service conversations are typically free when initiated by user.

The system must log:

templateCategory

for cost analytics.

---

# 13. Message Direction

Messages must store direction.

Possible values:

INBOUND  
OUTBOUND

This allows UI to render correct message bubbles.

---

# 14. System Messages

Certain messages originate from system events.

Examples:

Invoice sent  
Payment confirmed  
Automated reminder

These messages must include suffix:

```
[Automated]
```

Users must be able to distinguish system messages from manual ones.

---

# 15. Realtime Updates

After storing a message:

System must publish Ably event.

Event type:

```
message.new
```

Payload includes:

orgId  
conversationId  
messageId  
timestamp  

Clients subscribed to:

```
org:{orgId}
```

receive updates.

---

# 16. Coexistence Behavior

Because of coexistence mode:

The WhatsApp Business App may still receive messages.

Possible behaviors:

Customer replies from phone → message still arrives via Cloud API webhook.

Platform must treat Cloud API as the source of truth.

---

# 17. Rate Limiting

WhatsApp API enforces rate limits.

Codex must implement:

Basic retry logic with exponential backoff.

Example:

Retry after:

1s  
3s  
10s  

Maximum attempts:

3

---

# 18. Message Error Handling

If WhatsApp API fails:

1. Mark message as failed
2. Store error message
3. Allow retry

Error must not crash API.

---

# 19. Message Ordering

Messages must be ordered by:

createdAt

This ensures correct chat rendering.

If webhook arrives out-of-order:

Database ordering must still produce correct timeline.

---

# 20. Security Rules

Webhook must verify signature.

Access tokens must be encrypted.

Media downloads must use secure URLs.

No sensitive tokens must appear in logs.

---

# 21. WhatsApp Integration Summary

20byte uses:

WhatsApp Cloud API  
+ Embedded Signup  
+ Coexistence

System supports:

- inbound messages
- outbound messages
- template messages
- media handling
- cost visibility

Webhook processing must always be:

fast  
idempotent  
asynchronous

This ensures a reliable chat experience.