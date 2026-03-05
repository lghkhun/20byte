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

[ ] Initialize Next.js project (App Router + TypeScript)  
[ ] Install TailwindCSS  
[ ] Install shadcn/ui  
[ ] Setup ESLint + Prettier  
[ ] Setup project folder structure (DOC_04)  
[ ] Create base layout  
[ ] Create sidebar navigation skeleton  
[ ] Setup environment variable loader  
[ ] Create `.env.example` file  

---

# PHASE 1 — Database Foundation

[ ] Install Prisma  
[ ] Create Prisma schema file  
[ ] Setup MySQL connection  
[ ] Create Org model  
[ ] Create User model  
[ ] Create OrgMember model  
[ ] Create Customer model  
[ ] Create Conversation model  
[ ] Create Message model  
[ ] Create Tag model  
[ ] Create CustomerTag model  
[ ] Create CustomerNote model  

[ ] Run first migration  
[ ] Generate Prisma client  

---

# PHASE 2 — Authentication System

[ ] Implement email/password authentication  
[ ] Create password hashing utilities  
[ ] Create login API route  
[ ] Create register API route  
[ ] Create session management  
[ ] Create auth middleware  
[ ] Protect dashboard routes  

[ ] Create login page UI  
[ ] Create registration page UI  

---

# PHASE 3 — Organization System

[ ] Create organization creation flow  
[ ] Create organization onboarding step  
[ ] Add org membership roles  
[ ] Implement role permission system  
[ ] Add owner role logic  
[ ] Add admin role logic  
[ ] Add CS role logic  
[ ] Add advertiser role logic  

---

# PHASE 4 — WhatsApp Integration

[ ] Create WhatsApp account model  
[ ] Implement Embedded Signup flow  
[ ] Store WABA credentials  
[ ] Implement webhook verification endpoint  
[ ] Create WhatsApp webhook handler  
[ ] Implement webhook idempotency check  
[ ] Create webhook processing queue  
[ ] Create worker processor for webhook events  

---

# PHASE 5 — Conversation System

[ ] Implement conversationService  
[ ] Create conversation creation logic  
[ ] Implement conversation assignment  
[ ] Implement conversation status (OPEN/CLOSED)  
[ ] Create conversation list API  
[ ] Create conversation fetch API  

[ ] Build conversation list UI  
[ ] Build conversation header UI  

---

# PHASE 6 — Message System

[ ] Create messageService  
[ ] Implement inbound message storage  
[ ] Implement outbound message sending  
[ ] Implement message type support  

Message types:

[ ] TEXT  
[ ] IMAGE  
[ ] VIDEO  
[ ] AUDIO  
[ ] DOCUMENT  
[ ] TEMPLATE  
[ ] SYSTEM  

[ ] Create message bubble UI  
[ ] Create message input UI  

---

# PHASE 7 — Media Handling

[ ] Implement media download worker  
[ ] Implement R2 upload integration  
[ ] Store media metadata in database  
[ ] Render media preview in chat  

[ ] Image preview  
[ ] Video preview  
[ ] Audio player  
[ ] Document download  

---

# PHASE 8 — Realtime System

[ ] Install Ably SDK  
[ ] Create Ably wrapper module  
[ ] Publish message events  
[ ] Subscribe to conversation updates  
[ ] Update inbox in realtime  

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