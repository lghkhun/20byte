# DOC 12 — UI Design System
File: DOC_12_UI_DESIGN_SYSTEM.md

Product: 20byte  
Purpose: Define the visual design system and UI rules for the platform.

This document ensures that all UI components created by Codex remain:

- consistent
- clean
- modern
- SaaS-quality
- beginner friendly

The visual direction must resemble modern SaaS tools such as:

- Linear
- Stripe
- Vercel
- Notion

The interface must be **minimal, calm, and productivity-focused**.

---

# 1. Design Philosophy

20byte UI must follow these principles:

Clarity over decoration  
Speed over animation  
Function over complexity

The interface must feel:

clean  
fast  
predictable

Users of this platform are often **non-technical business owners**, therefore the UI must remain simple.

---

# 2. Design Style

Visual style:

Modern SaaS  
Minimalistic  
Flat with subtle depth

Avoid:

heavy shadows  
skeuomorphic design  
excessive gradients  
overly colorful UI

The platform should feel calm and professional.

---

# 3. Color System

Primary brand color:

Emerald

Primary:

```
#10B981
```

Usage:

Primary buttons  
Active states  
Important highlights

---

Neutral colors:

Background:

```
#0F172A
```

Surface:

```
#111827
```

Border:

```
#1F2937
```

Text Primary:

```
#F9FAFB
```

Text Secondary:

```
#9CA3AF
```

---

Status Colors

Success:

```
#22C55E
```

Warning:

```
#F59E0B
```

Danger:

```
#EF4444
```

Info:

```
#3B82F6
```

---

# 4. Typography

Primary font:

Inter

Fallback:

system-ui  
sans-serif

Font sizes:

Heading XL — 32px  
Heading L — 24px  
Heading M — 20px  
Body — 14px  
Small text — 12px

Line height should remain comfortable for reading.

---

# 5. Layout System

The application layout uses:

Sidebar + Workspace layout.

Structure:

Sidebar (collapsed icons)  
Conversation list  
Chat workspace  
CRM context panel

Spacing scale:

```
4px
8px
12px
16px
24px
32px
```

Spacing must remain consistent across all components.

---

# 6. Component Library

UI components must be based on:

shadcn/ui

Examples:

Button  
Input  
Dialog  
Dropdown  
Popover  
Tabs  
Badge  
Card

Custom components may be built on top of these primitives.

---

# 7. Button System

Button variants:

Primary  
Secondary  
Ghost  
Danger

Primary button:

Used for important actions.

Example:

Send message  
Create invoice  
Connect WhatsApp

Secondary button:

Used for secondary actions.

Ghost button:

Used inside toolbars.

Danger button:

Used for destructive actions.

---

# 8. Icon System

Icon library:

Lucide Icons

Icons must remain simple and consistent.

Avoid mixing icon libraries.

Example icons:

MessageCircle  
User  
Tag  
FileText  
Settings  
Search

---

# 9. Sidebar Navigation

Sidebar default state:

Collapsed.

Icons only.

Navigation items:

Inbox  
Customers  
Invoices  
Dashboard  
Settings

Active page must highlight with primary color.

---

# 10. Conversation List UI

Conversation list must include:

Avatar  
Customer name  
Message preview  
Timestamp  
Unread indicator  
Attribution badge

Unread indicator:

Small colored dot.

---

# 11. Chat Bubble Design

Chat bubbles must resemble WhatsApp.

Inbound messages:

Left side  
Neutral background

Outbound messages:

Right side  
Primary background

Bubble content includes:

Message text  
Media preview  
Timestamp

---

# 12. CRM Panel UI

CRM context panel contains:

Customer profile  
Tags  
Notes  
Invoices  
Activity timeline

Each section must use collapsible panels.

---

# 13. Tag Design

Tags must be:

small  
rounded  
colored

Example tags:

VIP  
Wedding  
Corporate  
Hot Lead

Tags help users quickly classify customers.

---

# 14. Badge System

Badges represent status.

Examples:

Conversation source  
Invoice status  
Assignment status

Badge styles must remain minimal.

---

# 15. Empty States

Empty states must guide the user.

Examples:

Inbox empty → show onboarding hint  
No invoices → encourage creating invoice  
No customers → explain CRM benefits

Empty states must include:

icon  
headline  
short explanation

---

# 16. Loading States

Loading must use skeleton components.

Examples:

Conversation list skeleton  
Chat message skeleton  
Invoice list skeleton

Avoid spinner-only loading states.

---

# 17. Error States

Errors must display friendly messages.

Example:

"Failed to send message. Please try again."

Avoid technical error messages.

---

# 18. Form Design

Forms must follow these rules:

Labels above inputs  
Clear validation messages  
Minimal required fields

Example fields:

Customer name  
Service name  
Price  
Due date

---

# 19. Modal Design

Modals must be used for:

Invoice creation  
Confirmation dialogs  
Settings

Modals must remain focused.

Avoid overly complex modal workflows.

---

# 20. Animation Rules

Animations must remain subtle.

Allowed animations:

fade  
scale  
slide

Duration:

150–250ms

Avoid heavy motion effects.

---

# 21. Mobile Responsiveness

The primary target is desktop.

However basic mobile responsiveness should exist.

Conversation list may collapse on small screens.

---

# 22. Accessibility

Basic accessibility rules:

Buttons must have labels  
Inputs must have labels  
Color contrast must be sufficient

Keyboard navigation must work for core inbox actions.

---

# 23. UI Consistency Rules

Codex must ensure:

consistent spacing  
consistent typography  
consistent component usage

Avoid inventing new UI patterns unnecessarily.

---

# 24. Design Summary

The 20byte design system must remain:

minimal  
clean  
fast  
modern

Inspired by modern SaaS products.

The interface must prioritize usability for:

service businesses  
advertisers  
small teams