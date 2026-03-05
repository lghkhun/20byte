# DOC 01 — Product Freeze PRD (Phase 1 MVP)
**Product:** 20byte  
**Scope:** Phase 1 (MVP) — **FROZEN**  
**Audience:** Codex + Owner (you)  
**Primary goal:** Codex can build the MVP *step-by-step* with high correctness and minimal ambiguity.

---

## 1) Product Summary
### 1.1 What is 20byte?
20byte is an **AI Sales Workspace** for **service-based businesses** (UMKM jasa).  
It combines a **WhatsApp-like inbox**, **lightweight CRM**, **invoice + proof workflow**, and **ad attribution** into a single, chat-first workspace.

The user experience goal is:  
> “Feels like WhatsApp Web, but super-powered for sales and billing.”

### 1.2 Who is it for?
**Primary:** Service SMEs in Indonesia (catering, schools/courses, clinics, agencies, WO, travel, event organizers).  
**Secondary:** Advertisers/marketers who want tracking + reporting but should not access chats.

### 1.3 What problem does it solve?
Service businesses often:
- Manage customers through WhatsApp but lose context, follow-ups, and accountability.
- Create invoices manually and track payment proof in messy chat threads.
- Struggle with Meta Ads measurement (CTWA + CAPI for service flows).
- Avoid CRMs because they are complex, “product/ecommerce-centric,” and not chat-first.

20byte solves this with:
- **Chat-first workflow** (inbox is the workspace)
- **Invoices tied to customers**
- **Payment proof audit trail**
- **Transparent WhatsApp template costs**
- **Attribution tracking from ads to revenue**

---

## 2) Product Principles (Non-negotiable)
1. **Chat is the workspace.**  
   Users must be able to manage customers and invoices without switching tabs/pages.

2. **Beginner-friendly onboarding.**  
   First login must guide users until WhatsApp is successfully connected via Embedded Signup + Coexistence.

3. **High functional correctness over speed.**  
   MVP progress is allowed to be slower; every feature must be correct and polished.

4. **No scope creep in MVP.**  
   Any new feature request must be added to Phase 2+ backlog and not implemented in Phase 1.

5. **Bilingual UI:** English-first but ID formatting.  
   UI copy is primarily English; currency/date formatting follows Indonesia standards.

---

## 3) Definitions & Key Terms
- **Org**: A workspace/company account (tenant).
- **Member**: A user inside an Org with a role.
- **Customer**: One WhatsApp phone number (E.164) mapped to a customer entity.
- **Conversation**: One chat thread between org and customer.
- **Open/Closed**: Conversation status for inbox management.
- **Invoice**: Billing document tied to a customer (and optionally to a conversation).
- **DP**: Down payment milestone.
- **Final**: Settlement milestone.
- **Proof**: Media evidence of payment (transfer proof) attached to invoice.
- **Embedded Signup**: Meta embedded onboarding flow for WABA.
- **Coexistence**: WhatsApp Business App remains usable while Cloud API is connected.
- **CTWA**: Click-to-WhatsApp ads flow.
- **Attribution**: campaign/platform/medium tagging for leads.

---

## 4) MVP Scope (Phase 1) — FROZEN
### 4.1 MUST HAVE (Phase 1)
#### A) WhatsApp Connection & Onboarding
1. **WhatsApp Cloud API** connection using:
   - **Embedded Signup**
   - **Coexistence**
2. **First-login onboarding wizard** until WhatsApp is connected successfully:
   - Connect Meta
   - Select Business / WABA
   - Select Phone Number (1 number per org)
   - Verify webhook & test message
   - Done → user lands in Inbox

#### B) Inbox (WhatsApp Web-like)
3. Inbox UI with 3-pane layout:
   - Conversation list
   - Chat workspace
   - CRM panel (customer context + actions)
4. Conversation filters:
   - **Unassigned**
   - **My chats**
   - **All chats**
5. Assignment:
   - Default queue is **Unassigned**
   - Members can assign to self
6. Conversation status:
   - **Open**
   - **Closed**
7. Keyboard shortcuts (must exist + help modal):
   - `N` → next unassigned conversation
   - `A` → assign to me
   - `I` → create invoice (from current conversation)
   - `P` → attach proof (from selected message/media)
   - `/` → quick reply search/insert
   - `Ctrl + /` → shortcut help

#### C) CRM (Customer-centric)
8. Customer model:
   - **1 phone number = 1 customer** (E.164)
9. Customer profile:
   - Display name (editable)
   - Phone number
   - Notes
   - Tags
10. Tags:
   - User can create custom tags
   - Tag color (simple palette)
11. Customer notes:
   - Free-text notes saved in timeline
12. Customer avatar:
   - Use WhatsApp profile photo if accessible
   - Fallback to initials avatar

#### D) Messaging & Attachments
13. Receive messages (webhook) and display in chat:
   - Text
   - Image
   - PDF (document)
   - Video
   - Voice note (audio)
14. Send messages:
   - Text
   - Templates (see WhatsApp Costs)
15. Attachment limits:
   - Image/PDF max **10MB**
   - Video max **50MB**
   - Voice note: receive+play (no browser recording in MVP)

#### E) Invoice System (Core)
16. Invoice creation inside chat (drawer/modal):
   - Create invoice for current customer
   - Manual items allowed
   - Optionally choose from Service Catalog (if included in MVP, minimal; see below)
17. Invoice numbering:
   - Auto-generated by system: `INV-YYYY-XXXX` (increment per org)
18. Invoice types:
   - **Full payment** (single milestone)
   - **DP + Final** (two milestones)
19. DP rules:
   - DP invoice + Final invoice are linked milestones under one invoice record (or one invoice with milestones)
   - User may create Final anytime (customer may pay early)
20. Public invoice page:
   - Accessible via secure token
   - Shareable link (customer can forward to finance/boss)
21. Send invoice via WhatsApp (Cloud API):
   - Message includes link to public invoice page
   - Must be labeled as system/automated at the end of message: e.g. `[Automated]`
22. Manual bank transfer support in MVP:
   - Org can store up to **3 bank accounts**
   - Invoice page shows:
     - “Copy account number”
     - “Copy amount”
   - Customer pays manually; user marks as paid manually

#### F) Payment Proof & Audit Trail
23. Proof from chat:
   - Customer sends proof transfer as image (or document)
   - CS can attach that media to invoice as **Payment Proof**
24. Proof limits:
   - Max **5 proofs per invoice**
25. Mark paid permissions:
   - **Owner** may mark paid even without proof
   - Others (CS/Admin) require proof
26. Proof retention policy:
   - Proof follows **invoice retention** (not chat retention)
27. Audit trail:
   - Key actions must log who did what and when:
     - invoice created/sent/paid
     - proof attached
     - assignment changed
     - whatsapp connected

#### G) WhatsApp Template Cost Transparency
28. Template composer must display:
   - Template name
   - Category (Marketing/Utility/Authentication/Service)
   - Estimated IDR cost based on provided prices:
     - Marketing: **Rp 818**
     - Utility: **Rp 498**
     - Authentication: **Rp 498**
     - Service: **Rp 0**
29. Tooltip/explanation:
   - “Meta charges per conversation window (not per message).”
30. Dashboard: show estimated WhatsApp costs summary (month-to-date)

#### H) CTWA Attribution Tracking (Lead Source)
31. Shortlink generator:
   - Create shortlink for WA destination with metadata:
     - campaign
     - platform
     - medium
32. Redirect route:
   - `/r/:code` → redirect to WA URL
33. Conversation attribution:
   - When chat starts, auto-tag conversation with source
34. UI:
   - Conversation header shows attribution badges
35. Dashboard:
   - Breakdown leads by campaign/platform/medium (basic)

#### I) Dashboard (Basic)
36. Dashboard metrics (simple):
   - Leads (new conversations/customers)
   - Invoices created
   - Paid count
   - Revenue total (sum of paid)
37. WhatsApp cost estimate summary (basic)

#### J) Roles & Permissions
38. Roles:
   - Owner
   - Admin
   - CS
   - Advertiser
39. Advertiser restrictions:
   - Cannot view chat content
   - Can view analytics/dashboard (and attribution)
   - May view aggregated metrics only

#### K) Storage & Retention
40. Use Cloudflare R2 for storing:
   - Chat attachments (image/pdf/video/audio)
   - Invoice PDFs
   - Proof attachments
41. Storage quota:
   - Plan-based quota (starter/growth/pro)
   - UI indicator: usage and remaining
42. Retention:
   - Chat attachments retention based on plan
   - Proof retention based on invoice policy (longer)

---

### 4.2 MAY HAVE in MVP (Optional, if small & safe)
These may only be included if **they do not delay core MVP**:
- Minimal Service Catalog page (name, price, unit, category) with optional attachment (image/pdf/link; no video)
- Quick reply templates (text snippets)
- Customer stage (optional; keep extremely simple)

If these are not ready, push to Phase 2.

---

### 4.3 MUST NOT HAVE in MVP (Phase 2+)
- Booking/appointments + calendar + reminders
- Broadcast and message sequences
- Payment gateway integration and wallet system
- Ads management inside platform
- BNPL (buy now pay later)
- AI full automation that changes CRM/invoices without approvals
- Voice/video calls integration (WhatsApp Calling API) — future

---

## 5) UX Requirements (Non-negotiable)
### 5.1 “WhatsApp Web familiarity”
- Chat layout must feel familiar:
  - inbound on left
  - outbound on right
  - message timestamps
  - delivery state (optional, if supported)
- Minimal clutter; actions are in predictable places.

### 5.2 “Super workspace” actions from chat
From inside the chat workspace, user can:
- Create invoice
- Attach proof to invoice
- Add tags & notes
- Change open/closed status
- Assign conversation

### 5.3 Onboarding wizard
- Must appear on first login and block usage until WhatsApp is connected.
- Show progress (e.g., Step 2/5).
- Provide clear, beginner-friendly errors (no technical jargon).

### 5.4 Empty states
- Inbox empty: tell user to connect WhatsApp
- No invoices: show “Create invoice from chat”
- No tags: show “Create your first tag”

### 5.5 Automated messages labeling
Any system-sent message (invoice sent, payment reminder, paid confirmation) must contain a suffix:
- `[Automated]` or `— Automated by 20byte`
(English-first; optionally show Indonesian tooltip.)

---

## 6) Functional Requirements by Module (Acceptance Criteria)

### 6.1 WhatsApp Connection
**Given** a user logs in for the first time  
**When** they follow onboarding steps  
**Then** WhatsApp connection must be established via Embedded Signup + Coexistence  
**And** webhook must be verified  
**And** a test message can be sent or a test event confirmed  
**And** user is redirected to Inbox with a “Connected” state.

### 6.2 Webhook & Message Ingestion
**Given** WhatsApp sends webhook events  
**When** the system receives duplicates  
**Then** it must store messages idempotently (no duplicate messages)  
**And** process media download/upload reliably via worker.

### 6.3 Inbox Assignment
**Given** a conversation is unassigned  
**When** CS presses `A` or clicks assign  
**Then** the conversation becomes assigned to that member  
**And** other members see the update via realtime.

### 6.4 Invoice Creation
**Given** a user is in a customer chat  
**When** they press `I` or click Create Invoice  
**Then** an invoice drawer opens  
**And** they can select Full or DP+Final  
**And** invoice number is generated automatically  
**And** public invoice link is created  
**And** PDF can be generated.

### 6.5 Proof Attach & Mark Paid
**Given** a customer sends a proof image  
**When** CS attaches it to an invoice  
**Then** invoice proof is stored and visible in invoice view  
**And** CS/Admin cannot mark paid without proof  
**But** Owner can override.

### 6.6 Template Cost Visibility
**Given** a user is about to send a template  
**When** they open template composer  
**Then** cost and category is shown clearly  
**And** user understands this cost is billed by Meta.

### 6.7 CTWA Tracking
**Given** a shortlink is created with metadata  
**When** customer clicks and starts chat  
**Then** the conversation is tagged with campaign/platform/medium  
**And** dashboard reflects this source.

---

## 7) Quality Requirements (MVP)
- Performance: inbox and chat should feel responsive
- Reliability: webhook must be idempotent and retry-safe
- Security: role-based access enforced everywhere
- Data integrity: invoice numbering must be monotonic per org
- Observability: basic logs for webhook and worker jobs

---

## 8) Non-Goals (Explicit)
- Replacing humans with AI in MVP
- Complex pipeline automation
- Multi-number per org in MVP (1 number per org)
- Advanced CRM pipeline features beyond basics

---

## 9) Future Vision (Phase 3+ AI)
### 9.1 AI Assisted (Phase 3)
- Suggested replies
- Auto tagging
- Conversation summary
- Lead qualification forms (assistive)

### 9.2 AI Sales Professional (Enterprise)
A subscription tier where AI can:
- handle customer chats
- use CRM features
- draft invoices
- follow up and collect required info
- handle complaints with policies
- negotiate within allowed guardrails
Owner receives “done” outcomes.

**Important:** This is future scope and must not affect MVP delivery, but architecture should not block it.

---

## 10) MVP Roadmap (High-level)
Phase 0: Repo + DB + Worker skeleton  
Phase 1: Auth + Org + WhatsApp connect + Inbox + Invoice + Proof + CTWA + Dashboard  
Phase 2: Broadcast/Sequences + Booking + Reminders  
Phase 3: AI Assist + Advanced analytics  
Phase 4+: Wallet + Payment gateway + Ads management + BNPL + AI Professional

---

## 11) Freeze Clause
This PRD is **frozen** for Phase 1.  
Any changes require:
1) explicit approval by owner (you)
2) an updated version note at top of this doc
3) update to task checklist doc (DOC 11)

**Codex must treat this as the contract.**