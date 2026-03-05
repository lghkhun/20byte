# DOC 08 — CTWA Attribution & Lead Tracking System
File: DOC_08_CTWA_ATTRIBUTION_SYSTEM.md

Product: 20byte  
Module: CTWA Attribution Tracking  
Purpose: Track leads coming from Click-To-WhatsApp ads and organic sources.

This system enables businesses to understand:

- where a customer came from
- which campaign generated the lead
- which conversation generated revenue
- which ads generate invoices

Most CRM tools fail in Indonesia because they cannot track attribution for service businesses.

20byte solves this by integrating attribution directly into the chat system.

---

# 1. Attribution Philosophy

Attribution must be:

- simple
- automatic
- persistent

Once a customer is attributed to a source, that attribution must remain attached to the customer and conversation.

The goal is to answer:

"Which marketing campaign generated this customer?"

---

# 2. Lead Sources

The system must support two attribution sources.

Organic  
CTWA Ads

Organic means:

- direct WhatsApp contact
- saved number contact
- referrals

CTWA means:

- Click-To-WhatsApp ads from Meta Ads.

---

# 3. Shortlink System

CTWA attribution works through shortlinks.

Example link:

https://wa.20byte.com/abc123

This shortlink stores attribution data.

When a user clicks the link:

1. Attribution data is captured
2. The user is redirected to WhatsApp

Example final destination:

https://wa.me/628123456789

---

# 4. Shortlink Structure

Each shortlink stores the following fields.

orgId  
slug  
campaign  
adset  
ad  
source  
createdAt  

Example:

slug: abc123  
campaign: Wedding Campaign  
adset: Jakarta Brides  
ad: Video Ad 01  
source: meta_ads

---

# 5. Click Tracking

When a user clicks the shortlink:

The system records:

click timestamp  
IP address (optional)  
user agent (optional)

This is stored in a ShortlinkClick table.

Purpose:

Analytics and fraud prevention.

---

# 6. Redirect Behavior

After recording the click, the system redirects to WhatsApp.

Redirect URL format:

https://wa.me/{phone}?text={encodedText}

The encoded text may include hidden attribution markers.

Example:

Hello I want to ask about catering service

Attribution markers must remain invisible to users.

---

# 7. Attribution Resolution

When the customer sends the first message:

The system must attempt to match the conversation with the shortlink.

Possible methods:

- query parameter
- encoded text marker
- phone number mapping

Once identified, attribution is saved.

---

# 8. Stored Attribution Fields

Customer record must store:

source  
campaign  
adset  
ad  
firstContactAt  

Example:

source: meta_ads  
campaign: wedding_campaign  
adset: jakarta_brides  
ad: video_01

This attribution is permanent.

---

# 9. Conversation Attribution

Conversations inherit attribution from the customer.

This allows analytics to answer:

- which campaigns generate conversations
- which campaigns generate revenue

---

# 10. Organic Attribution

If no shortlink is detected:

The system assigns:

source: organic

This ensures every customer has a source.

---

# 11. Attribution Display in Inbox

Inbox UI must display attribution badges.

Example badges:

META  
ORGANIC

Hovering the badge should show:

campaign  
adset  
ad

Example tooltip:

Campaign: Wedding Leads  
Adset: Jakarta Brides  
Ad: Video 01

---

# 12. Attribution Analytics

The system must support future analytics such as:

Leads by campaign  
Revenue by campaign  
Invoices by campaign  
Conversion rate

This feature may appear in Phase 2 dashboard.

---

# 13. Shortlink Generation

Users can create shortlinks manually.

Example UI fields:

Campaign name  
Adset name  
Ad name

System generates:

slug

Example result:

wa.20byte.com/abc123

---

# 14. Shortlink Security

Shortlinks must use random slugs.

Slug format:

6–8 characters

Example:

abc123  
x9k2lm  

This prevents guessing links.

---

# 15. Expiration Rules

Shortlinks do not expire by default.

Users may disable shortlinks manually.

Disabled shortlinks must return:

404 page.

---

# 16. Attribution Integrity

Attribution must never change after the first conversation.

Example:

Customer first contact via Ads  
Later messages are organic

The attribution must remain Ads.

This prevents data corruption.

---

# 17. Multi-Conversation Handling

One customer may have multiple conversations.

All conversations must inherit the same attribution.

Example:

Customer contacted via ad in January  
Customer contacts again in March

Both conversations show the same attribution.

---

# 18. Privacy Considerations

The system must avoid storing sensitive data.

Allowed data:

campaign name  
adset name  
ad name  
source

Not allowed:

personal ad click identifiers.

---

# 19. Attribution System Summary

The CTWA attribution system allows 20byte to:

Track ad-driven conversations  
Identify marketing performance  
Connect revenue to campaigns

The system works through:

Shortlinks  
Click tracking  
Conversation attribution

This enables businesses to understand:

"Which marketing generated this customer."