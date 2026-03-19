# DOC 21 — Meta Pixel & CAPI Integration (Service-Based Funnel)
File: DOC_21_META_PIXEL_CAPI_INTEGRATION.md

Product: 20byte

Purpose:
Define tracking architecture for Meta Ads using Pixel + Conversion API (CAPI),
optimized specifically for **service-based businesses using WhatsApp + Invoice flow**.

This document covers:

- tracking via shortlink (no landing page MVP)
- event mapping for service funnel
- identity bridging via WhatsApp
- multi-tenant Meta integration
- CAPI payload structure
- implementation guide for Codex

---

# 1. Tracking Philosophy

20byte does NOT use traditional ecommerce funnel.

Instead:

Chat = Lead  
Invoice = Checkout  
Payment = Purchase  

This system replaces:

landing page  
checkout page  

with:

WhatsApp chat + invoice system

---

# 2. Funnel Mapping (FINAL)

| Stage | Meta Event | Custom Event |
|------|----------|-------------|
| Chat started | Lead | ChatStarted |
| Invoice created | InitiateCheckout | InvoiceCreated |
| Invoice paid | Purchase | InvoicePaid |

Codex must always send:

- standard event (for Meta optimization)
- custom event (for analytics)

---

# 3. MVP Flow (No Landing Page)

Flow:

Meta Ads  
→ Shortlink (20byte)  
→ Redirect to wa.me  
→ Chat enters platform  
→ Invoice created  
→ Invoice paid  

No browser pixel dependency for MVP.

CAPI is primary tracking method.

---

# 4. Identity Bridging (CRITICAL)

Because WhatsApp has no cookies:

Tracking must use message injection.

---

## 4.1 Shortlink Redirect Logic

Example shortlink:

```
https://20byte.com/s/abc123
```

Redirect to:

```
https://wa.me/628xxx?text=Hello%20[ref:abc123xyz]
```

Rules:

- tracking_id must be generated per click
- format:

```
ref:{shortlinkId}-{timestamp}
```

Example:

```
ref:abc123-1700000000
```

---

## 4.2 Chat Parsing

When message arrives:

System must:

- detect `[ref:xxxx]`
- extract tracking_id
- link to:

shortlink  
campaign  
customer  

Store in:

conversation.sourceCampaign  
customer.source  

---

# 5. Event Triggers

---

## 5.1 Chat Started Event

Trigger:

- first inbound message
- contains tracking_id

Send:

```
event_name: Lead
custom_event: ChatStarted
```

---

## 5.2 Invoice Created Event

Trigger:

- invoice created

Send:

```
event_name: InitiateCheckout
custom_event: InvoiceCreated
```

---

## 5.3 Invoice Paid Event

Trigger:

- invoice marked paid

Send:

```
event_name: Purchase
custom_event: InvoicePaid
```

This is the most important event.

---

# 6. Multi-Tenant Meta Integration

Create table:

```
meta_integration {
  id
  orgId
  pixelId
  accessToken
  testEventCode
  createdAt
}
```

Each org uses its own:

- Pixel ID
- Access Token

---

# 7. CAPI Service (server/services/metaEventService.ts)

Codex must create service:

Responsibilities:

- build payload
- hash user data
- send request to Meta API
- handle retry

---

## 7.1 Hashing Rules

Phone must be:

- normalized (628xxx)
- hashed using SHA256

---

## 7.2 Payload Example

```
POST https://graph.facebook.com/v18.0/{PIXEL_ID}/events
```

```
{
  "data": [
    {
      "event_name": "Purchase",
      "event_time": 1710000000,
      "event_id": "payment_inv_123",
      "action_source": "system_generated",
      "user_data": {
        "ph": "<sha256_phone>"
      },
      "custom_data": {
        "currency": "IDR",
        "value": 1500000
      }
    }
  ]
}
```

---

# 8. Event ID (Deduplication)

Use consistent format:

Chat:

```
chat_{conversationId}
```

Invoice:

```
invoice_{invoiceId}
```

Payment:

```
payment_{invoiceId}
```

---

# 9. Pixel (Optional Hybrid)

For MVP:

Pixel is optional.

Future:

- fire PageView on shortlink redirect
- fire ViewContent on landing page

---

# 10. Error Handling

If CAPI fails:

- log error
- retry via worker queue

Never block user flow.

---

# 11. Worker Integration

Worker must handle:

- async event sending
- retry logic
- failure logging

---

# 12. UI (Future)

User settings page:

Fields:

Pixel ID  
Access Token  
Test Event Code  

Button:

"Test Event"

---

# 13. Security

- Never expose access token to frontend
- Store token encrypted
- Only send CAPI from server

---

# 14. Future Upgrade (Phase 2)

When landing page is added:

Add:

- Meta Pixel script
- event deduplication
- browser + server hybrid tracking

---

# 15. Implementation Checklist (Codex)

Codex must implement:

[ ] meta_integration table  
[ ] metaEventService  
[ ] tracking_id generator  
[ ] shortlink redirect injection  
[ ] chat parser (extract ref)  
[ ] event trigger: chat  
[ ] event trigger: invoice  
[ ] event trigger: payment  
[ ] worker retry system  

---

# 16. Summary

20byte tracking system:

shortlink → chat → invoice → payment  

This replaces:

landing page → checkout  

and enables Meta Ads optimization for service businesses.