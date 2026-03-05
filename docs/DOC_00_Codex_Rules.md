# DOC 00 — Codex Operating Rules (Non-Negotiable)
**Product:** 20byte  
**Purpose:** This document defines how Codex must work on the project, how scope is controlled, and how progress is tracked.  
**Audience:** Codex + Owner (you)  
**Status:** ACTIVE — applies to every session

---

## 0.1 Single Source of Truth
1) **DOCs are the contract.**  
   Codex must treat DOC 00–DOC 11 as the **only** source of truth for scope and implementation rules.

2) **Phase 1 (MVP) is frozen.**  
   If the user asks to add/change features outside Phase 1, Codex must:
   - Add it to **Phase 2+ backlog** in DOC 11 (Tasklist)
   - Reply with: “Added to Phase 2 backlog; continuing MVP tasks.”
   - Continue current planned tasks without detours.

3) **No hidden changes.**  
   If Codex changes any behavior that affects users (UI text, permissions, invoice rules), Codex must:
   - Update the relevant DOC
   - Note the change in DOC 11 (Tasklist notes)

---

## 0.2 Session Workflow (How Codex Must Operate)
Every Codex session must follow this exact structure:

### Step 1 — Read & Select Tasks
- Read DOC 11 (Tasklist).
- Choose **1–3 tasks maximum** (small steps).
- State the chosen tasks clearly and why they come next.

### Step 2 — Plan Changes
- List files to create/modify.
- Mention DB migrations if needed.
- Mention environment variables if needed.

### Step 3 — Implement Carefully
- Implement feature(s) fully according to Definition of Done (below).
- Prefer incremental PR-style edits over large refactors.

### Step 4 — Verify (Allowed Commands Only)
Codex may run:
- `npm run lint`
- `npm run typecheck`
- `npm test` / `vitest`
- `npx prisma generate`
- `npx prisma migrate dev` (only when instructed/allowed by owner)
- DB seed scripts (if present)

**Hard rule:** Codex must **NOT** run `npm run dev`.  
If runtime UI testing is needed, Codex must ask the owner to run it and share screenshots/logs.

### Step 5 — Update Tasklist
- Mark completed tasks in DOC 11 with `[x]`.
- Add notes:
  - what changed
  - any follow-up tasks
  - any known limitations or decisions

---

## 0.3 Hard Rules (Do Not Break)
### 0.3.1 No `npm run dev`
- Codex must never run `npm run dev`.  
- If Codex needs visual verification:
  - Ask owner: “Please run `npm run dev` and share screenshot / browser console / server log.”

### 0.3.2 No Scope Creep
- No Phase 2+ features in Phase 1.
- No speculative features “just in case.”
- If uncertain, default to **simpler** behavior that meets the PRD.

### 0.3.3 No Microservices
Architecture is:
- **Next.js monolith (web + API)**
- **One worker process**
- Redis + MySQL + R2 + Ably

No splitting into separate services in MVP.

### 0.3.4 No Big Refactors Without Permission
Codex must not refactor foundational components (auth, db layer, message pipeline) unless:
- a blocking issue is proven
- owner explicitly opens a “REFactor Window”

### 0.3.5 No Silent Schema Changes
Any DB schema change requires:
- prisma update
- migration plan
- mention in DOC 11 notes

---

## 0.4 Definition of Done (DoD)
A feature is **DONE** only if all applicable items are completed:

### Data & DB
- Schema exists (if needed)
- Migration applied (if needed)
- Seed/update scripts included (if needed)

### API
- Route exists and matches PRD
- Validation (Zod or equivalent)
- Consistent error responses
- Permission checks
- Idempotency where needed (webhooks)

### UI
- Working UI flow (happy path)
- Empty state
- Loading state
- Error state
- Copy and labels match bilingual rules (English-first)

### Security & Permissions
- Role checks enforced
- Advertiser cannot access chats
- Owner override policies respected (mark paid without proof)

### Audit & Observability
- Audit log for critical actions:
  - connect WhatsApp
  - assign conversation
  - create/send/mark-paid invoice
  - attach proof
- Logs for webhook processing & worker failures

### Minimal Tests
- At least 1–3 unit/integration tests for the feature’s critical logic
- Webhook dedupe tested (idempotency)

---

## 0.5 Product Quality Standards
### UX Standards
- Must feel like WhatsApp Web: fast, clear, minimal friction.
- “Chat-first”: core actions must be available from chat workspace.
- Beginner onboarding must be guided and non-technical.

### Stability Standards
- Webhook ingestion must be retry-safe & deduplicated.
- Worker jobs must be idempotent where possible.
- Media handling must not block webhook response.

### Performance Standards
- Conversation list must be paginated / efficient.
- Chat message list must support pagination and avoid rendering massive lists at once.
- Avoid heavy computation on request path; use worker.

---

## 0.6 Bilingual UI Rules (English-first, ID formats)
1) UI strings default to **English**.
2) ID currency formatting:
   - Display: `Rp 1.234.567`
   - Store in DB: integer cents (or rupiah smallest unit), consistent across the codebase.
3) Dates:
   - Display in ID-appropriate format (e.g., `dd MMM yyyy`), but keep locale aware.
4) Automated messages:
   - Must be labeled: `[Automated]` suffix.

---

## 0.7 Security Rules
- WhatsApp access tokens must be stored encrypted-at-rest.
- Webhook requests must verify signature (Meta headers).
- Never log raw tokens.
- Any endpoint that reads messages must enforce role restrictions.

---

## 0.8 “Owner Responsibilities” (What the human will provide)
Codex may request from owner:
- Meta App credentials for Embedded Signup
- WhatsApp Cloud API setup info
- Ably keys
- Cloudflare R2 credentials
- VPS Docker deployment credentials (later)
- Manual verification screenshots / logs (since Codex cannot run dev server)

---

## 0.9 Environment & Local Development Constraints
- During MVP, everything runs locally via owner using `npm run dev`.
- Codex should provide:
  - migrations
  - seeds
  - scripts
  - instructions
…but must not run the dev server.

---

## 0.10 Progress Tracking & Checklists
- DOC 11 is the **single checklist**.
- Codex must check tasks only when DoD is satisfied.
- If partially complete:
  - leave task unchecked
  - add notes what remains
  - optionally create sub-tasks

---

## 0.11 Conflict Resolution
If any DOC conflicts:
1) DOC 00 (Operating Rules) overrides all workflow behavior.
2) DOC 01 (Product Freeze PRD) overrides feature scope.
3) Technical docs (DOC 02+) guide implementation details.

If the owner gives an instruction conflicting with Phase 1 freeze:
- Codex must ask to confirm moving it to Phase 2 backlog (but still proceed with Phase 1 tasks).

---

## 0.12 Session Output Template (Codex must follow)
At the end of every session, Codex must output:

1) **Selected Tasks (from DOC 11):**  
   - [ ] Task A  
   - [ ] Task B  

2) **What Changed:**  
   - Files added/modified list

3) **Commands Run (allowed only):**  
   - `npm run lint` …  
   - `npm run typecheck` …

4) **Owner Action Needed (if any):**  
   - “Please run `npm run dev` and share screenshot of …”

5) **DOC 11 Update:**  
   - Mark checkboxes and add notes

---

## 0.13 Final Reminder (Non-negotiable)
- Do not run `npm run dev`.
- Do not add Phase 2 features to MVP.
- Build small, correct steps.
- Update DOC 11 after every session.