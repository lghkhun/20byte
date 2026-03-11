# DOC 07 — Invoice System Architecture
File: DOC_07_INVOICE_SYSTEM.md

Product: 20byte  
Module: Invoice & Payment Tracking  
Purpose: Define how invoices are created, managed, and tracked inside the platform.

The invoice system is one of the **core differentiators of 20byte**.

Unlike traditional CRM tools, invoices must be deeply integrated with the chat workspace.

Users must be able to:

- create invoices from chat
- send invoices to customers
- track payments
- support down payment and full payment
- attach payment proof
- manage invoice status

This system must be simple for Indonesian service businesses.

---

# 1. Invoice Philosophy

The invoice system must prioritize:

- simplicity
- flexibility
- auditability

Indonesian service businesses often use:

- negotiation-based pricing
- manual bank transfers
- down payments

The system must support this workflow.

Important design principle:

"Invoice must be easy to create from chat."

---

# 2. Invoice Types

There are two invoice patterns.

Single Invoice  
Down Payment + Final Payment

Users must be able to choose either.

---

## 2.1 Single Invoice

Used when the customer pays once.

Example:

Service price: Rp 2.000.000

Invoice total:

Rp 2.000.000

---

## 2.2 Down Payment + Final Payment

Used for projects.

Example:

Service price: Rp 5.000.000

Down payment:

Rp 2.000.000

Final payment:

Rp 3.000.000

The system must store two milestones.

---

# 3. Invoice Structure

Each invoice includes:

Invoice number  
Customer  
Items  
Milestones  
Total amount  
Status  
Public link

Invoices belong to:

Organization  
Customer

---

# 4. Invoice Number Generation

Invoice numbers are generated automatically.

Format:

INV-YYYY-XXXX

Example:

INV-2026-0001

Rules:

Sequence resets every year.

The sequence is unique per organization.

Users cannot manually edit invoice numbers.

---

# 5. Invoice Items

Invoices contain one or more items.

Each item includes:

Name  
Description (optional)  
Unit price  
Quantity  
Subtotal

Example item:

Service: Wedding Catering  
Quantity: 1  
Price: Rp 20.000.000

---

# 6. Service Catalog Integration

Users may optionally select items from a service catalog.

Catalog fields:

Service name  
Price  
Unit  
Optional attachments (image / PDF / link)

Catalog helps speed up invoice creation.

Users can still create custom items.

---

# 7. Invoice Milestones

Invoices support multiple payment milestones.

Examples:

Down Payment  
Final Payment

Each milestone includes:

Name  
Amount  
Due date  
Status

Milestone statuses:

PENDING  
PAID

---

# 8. Invoice Status

Invoice status uses persisted DB enum values (see DOC 14 schema).

Possible statuses:

DRAFT  
SENT  
PARTIALLY_PAID  
PAID  
VOID

Status rules:

DRAFT → invoice created but not sent  
SENT → invoice shared with customer  
PARTIALLY_PAID → some milestones paid  
PAID → all milestones paid  
VOID → invoice cancelled/voided

UI note:

OVERDUE may still be shown as a derived badge in UI when due date has passed and status is not PAID/VOID.
This is a presentation state, not a persisted DB enum value.

---

# 9. Sending Invoice

Invoices can be sent to customers via chat.

Flow:

Create invoice  
Generate public link  
Send link via WhatsApp

Example message:

"Here is your invoice: https://20byte.com/i/{token}"

System messages must include label:

[Automated]

---

# 10. Public Invoice Page

Invoices must have a public page.

URL format:

/i/{publicToken}

This allows:

Customers  
Finance staff  
Managers

to open the invoice without login.

---

# 11. Public Invoice Page Content

The invoice page must show:

Business name  
Customer name  
Invoice number  
Invoice items  
Milestones  
Payment instructions  
Total amount

Optional:

Proof attachments

---

# 12. Payment Instructions

Because MVP uses manual bank transfer:

Invoices must show bank details.

Users can configure up to:

5 bank accounts.

Fields:

Bank name  
Account number  
Account holder

The invoice page must include:

Copy account number button  
Copy payment amount button

---

# 13. Unique Transfer Code (Optional)

Users may enable a unique transfer code.

Example:

Invoice amount:

Rp 1.500.000

With unique code:

Rp 1.500.123

Purpose:

Helps identify payments.

This feature is optional.

---

# 14. Marking Invoice as Paid

Payments can be marked manually.

Rules:

Owner can mark paid without proof.

Admin/CS must attach proof before mark paid.

Roles allowed to mark paid:

Owner  
Admin  
CS

---

# 15. Payment Proof

Proof can be attached from chat.

Flow:

Customer sends transfer image  
CS clicks "Attach to Invoice"  
Select milestone

Proof record created.

Proof limit:

Maximum 5 proofs per invoice.

---

# 16. Proof Storage

Proof files are stored in:

Cloudflare R2

Database stores metadata only.

Fields:

mediaUrl  
mimeType  
fileSize  
uploadedAt

---

# 17. Invoice PDF

Invoices must support PDF export.

PDF is generated when invoice is created.

PDF contains:

Company info  
Invoice number  
Customer  
Items  
Milestones  
Total

PDF stored in R2.

---

# 18. Invoice Timeline

Each invoice includes an activity timeline.

Events:

Invoice created  
Invoice sent  
Proof attached  
Payment marked  
Invoice completed

This helps auditing.

---

# 19. Invoice Permissions

Role access:

Owner → full control  
Admin → manage invoices  
CS → create invoice  
Advertiser → no access

Advertisers must never see financial data.

---

# 20. Invoice Realtime Updates

Invoice updates must trigger realtime events.

Examples:

Invoice created  
Invoice paid  
Proof attached

These events update the UI immediately.

---

# 21. Invoice From Chat Workflow

This is the primary workflow.

Chat conversation  
→ Create invoice  
→ Send invoice  
→ Customer pays  
→ Customer sends proof  
→ CS attaches proof  
→ Admin/CS marks paid (proof required) or Owner override

Everything happens inside the chat workspace.

---

# 22. Invoice System Summary

The invoice system must support:

- flexible invoice creation
- down payment structure
- manual bank transfer workflows
- payment proof attachment
- public invoice pages
- chat-first invoice workflow

This allows Indonesian service businesses to manage sales without leaving the inbox.
