# DOC 09 — Codex Development Workflow
File: DOC_09_CODEX_DEVELOPMENT_WORKFLOW.md

Product: 20byte  
Purpose: Define how Codex must develop this project step-by-step.

This project is **100% Codex-driven development**.

The human owner only:

- gives commands
- provides API credentials
- runs the dev server manually
- verifies UI behavior

Codex must perform all engineering work following this workflow.

This document ensures development stays:

- structured
- safe
- predictable
- maintainable

---

# 1. Codex Development Philosophy

Codex must prioritize:

- correctness over speed
- incremental development
- stability
- small iterations

Codex must never attempt to build the entire system in one session.

Features must be implemented gradually.

Example:

Inbox feature may require:

- database schema
- API endpoints
- service layer
- UI components
- realtime integration

These should be developed across multiple sessions.

---

# 2. Required Documents Codex Must Read

Before starting development, Codex must read:

DOC_00_Codex_Rules.md  
DOC_01_Product_Freeze_PRD.md  
DOC_02_SYSTEM_ARCHITECTURE.md  
DOC_03_DATABASE_ARCHITECTURE.md  
DOC_04_PROJECT_STRUCTURE.md  
DOC_05_WHATSAPP_INTEGRATION.md  
DOC_06_INBOX_SYSTEM.md  
DOC_07_INVOICE_SYSTEM.md  
DOC_08_CTWA_ATTRIBUTION_SYSTEM.md  
DOC_09_CODEX_DEVELOPMENT_WORKFLOW.md  
DOC_11_TASKLIST.md

Codex must treat these as the **official system specification**.

---

# 3. Development Session Flow

Every Codex development session must follow the same process.

Step 1 — Read Tasklist  
Step 2 — Select Tasks  
Step 3 — Plan Implementation  
Step 4 — Implement Code  
Step 5 — Validate Code  
Step 6 — Update Tasklist

This process must never be skipped.

---

# 4. Step 1 — Read Tasklist

Codex must open:

DOC_11_TASKLIST.md

This file contains all development tasks.

Each task has a checkbox:

[ ] not started  
[x] completed

Codex must identify:

- unfinished tasks
- tasks that logically follow previous work

---

# 5. Step 2 — Select Tasks

Codex must select **1–3 tasks maximum per session**.

Never more.

Example selection:

- Create Customer table
- Create Conversation table
- Implement conversationService

Small steps reduce bugs.

---

# 6. Step 3 — Plan Implementation

Before writing code, Codex must outline:

Files to create  
Files to modify  
Database migrations required  
Environment variables required  

Example:

Create:

server/services/customerService.ts

Modify:

prisma/schema.prisma

Add migration:

add_customer_table

This planning prevents chaotic changes.

---

# 7. Step 4 — Implement Code

During implementation:

Codex must follow:

DOC_04 project structure.

Rules:

Business logic → services  
Database queries → services  
API routes → thin controllers  
UI → components

Codex must avoid duplicating logic.

---

# 8. Step 5 — Code Validation

After writing code, Codex may run safe commands.

Allowed commands:

npm run lint  
npm run typecheck  
npm test  
npx prisma generate

Forbidden command:

npm run dev

Only the human owner may run the development server.

---

# 9. Runtime Verification

If UI verification is required, Codex must ask the owner.

Example request:

Please run:

npm run dev

Then open:

http://localhost:3000/inbox

And send a screenshot.

Codex will analyze the screenshot and logs.

---

# 10. Step 6 — Update Tasklist

After completing tasks, Codex must update:

DOC_11_TASKLIST.md

Completed tasks must change:

[ ] → [x]

Codex must also write notes explaining:

- what was implemented
- what files changed
- follow-up tasks

---

# 11. Code Quality Rules

Codex must maintain high code quality.

Rules:

Files should remain under 400 lines.

Functions should be small and focused.

Naming must be descriptive.

Avoid:

- overly complex abstractions
- unnecessary libraries
- premature optimization

---

# 12. Dependency Rules

Codex must minimize dependencies.

Allowed categories:

UI components  
database ORM  
queue systems  
realtime messaging

Avoid:

large frameworks  
heavy libraries  
duplicate dependencies

---

# 13. Database Change Rules

Database schema changes require:

1. schema.prisma modification  
2. Prisma migration  
3. code updates  
4. tasklist update  

Codex must explain migrations before applying them.

---

# 14. Error Handling Rules

Codex must implement proper error handling.

API errors must return structured responses.

Example:

{
  "error": "Invoice not found"
}

Worker failures must be logged.

---

# 15. Security Rules

Codex must enforce:

role permissions  
webhook verification  
org data isolation

Sensitive data must never appear in logs.

Example:

WhatsApp access tokens must never be logged.

---

# 16. Logging Standards

Important events must be logged.

Examples:

webhook processing  
invoice creation  
assignment changes  
authentication failures

Logs help debugging during early development.

---

# 17. Testing Philosophy

Testing must focus on critical logic.

Examples:

invoice calculation  
webhook deduplication  
permission rules

UI tests are optional in MVP.

---

# 18. Feature Completion Criteria

A feature is considered complete when:

database schema exists  
API endpoint works  
UI renders correctly  
errors handled  
permissions enforced

Incomplete features must remain unchecked in the tasklist.

---

# 19. Scope Protection

Codex must never add new features outside the PRD.

If the owner suggests a new idea during development:

Codex must:

add it to Phase 2 backlog  
continue working on MVP tasks

This prevents scope creep.

---

# 20. Development Stability Rules

Codex must avoid:

large refactors  
breaking schema changes  
rewriting stable components

Refactors must be small and safe.

---

# 21. Final Development Goal

Codex development must produce:

a stable MVP  
clean architecture  
maintainable repository  
predictable codebase

The system must remain understandable even after many development sessions.

---

# 22. Summary

Codex development workflow ensures:

structured engineering  
incremental feature development  
safe database evolution  
clear task tracking

By following this workflow, the 20byte platform can be developed reliably using AI-driven coding.