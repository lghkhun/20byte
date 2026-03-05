# DOC 20 — Subscription Model
File: DOC_20_SUBSCRIPTION_MODEL.md

Product: 20byte

Purpose:
Define SaaS subscription structure for the platform.

This document ensures:

- predictable pricing
- fair system usage
- scalable infrastructure
- clear upgrade paths

The billing model combines:

subscription plan  
fair usage limits

---

# 1. Pricing Philosophy

The platform uses:

Seat-based subscription  
Usage-based fair limits

Users pay primarily for:

team size  
advanced features

Usage limits protect infrastructure.

---

# 2. Subscription Plans

Initial plans:

Starter  
Growth  
Enterprise

---

# 3. Starter Plan

Target users:

small service businesses

Limits:

Seats  
3 users

Storage  
2 GB

Chat Retention  
90 days

Catalog items  
50

Invoices per month  
500

AI Sales Agent  
Not available

Price (example)

Rp 199.000 / month

---

# 4. Growth Plan

Target users:

growing teams

Limits:

Seats  
10 users

Storage  
10 GB

Chat Retention  
180 days

Catalog items  
500

Invoices per month  
5000

AI Sales Agent  
Limited access

Price (example)

Rp 599.000 / month

---

# 5. Enterprise Plan

Target users:

large service businesses

Limits:

Seats  
Unlimited

Storage  
100 GB+

Chat Retention  
365 days

Catalog items  
Unlimited

Invoices per month  
Unlimited

AI Sales Agent  
Full automation

Price

Custom pricing

---

# 6. Feature Access

| Feature | Starter | Growth | Enterprise |
|------|------|------|------|
Inbox | ✓ | ✓ | ✓ |
CRM | ✓ | ✓ | ✓ |
Invoice | ✓ | ✓ | ✓ |
Catalog | ✓ | ✓ | ✓ |
CTWA Attribution | ✓ | ✓ | ✓ |
Automation | ✗ | limited | ✓ |
AI Sales Agent | ✗ | limited | ✓ |

---

# 7. Fair Usage Policy

Fair usage prevents infrastructure abuse.

Examples:

Maximum messages per minute

Maximum media uploads per hour

Excessive usage may trigger throttling.

---

# 8. Storage Quota

Storage counts:

chat media  
invoice PDFs  
payment proofs  
catalog attachments

Storage is calculated per organization.

Example:

Starter

2GB total

If quota exceeded:

uploads blocked

until cleanup or upgrade.

---

# 9. Chat Retention

Chat messages expire after retention period.

Example:

Starter

90 days

Older messages are automatically deleted.

Invoices are not deleted.

---

# 10. Seat Limit

Seats represent active users in an organization.

Example:

Starter

3 users max

If exceeded:

invitation blocked until upgrade.

---

# 11. Usage Indicators

UI must display usage indicators.

Examples:

Storage usage

```
1.2GB / 2GB
```

Seat usage

```
2 / 3 users
```

Retention indicator.

---

# 12. Upgrade Flow

Users can upgrade plan at any time.

Upgrade effect:

immediate

Downgrade effect:

next billing cycle.

---

# 13. Billing Cycle

Subscription cycle:

Monthly

Future support:

Annual billing

---

# 14. Trial

New organizations may receive:

14 day free trial.

During trial:

full feature access.

After trial expires:

system locks until subscription.

---

# 15. Subscription Data Model

The system stores subscription data in:

OrgPlan

Fields:

planKey  
seatLimit  
storageQuotaMb  
retentionDays

---

# 16. Future Expansion

Future billing may include:

WhatsApp usage billing  
AI usage billing  
Ads wallet billing

---

# 17. Subscription Summary

The subscription model balances:

predictable pricing  
fair system usage  
scalable infrastructure

Plans encourage growth while protecting platform resources.