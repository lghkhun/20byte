# DOC 06 — Inbox System Architecture
File: DOC_06_INBOX_SYSTEM.md

Product: 20byte  
Module: Inbox Workspace  
Purpose: Define the architecture and behavior of the chat inbox system.

The Inbox is the **core workspace of 20byte**.

Everything in the system revolves around the chat experience.

Users must be able to:

- read messages
- respond to customers
- manage CRM
- create invoices
- attach payment proof
- assign conversations
- track lead sources

All **without leaving the chat interface**.

---

# 1. Inbox Philosophy

The inbox must behave like:

WhatsApp Web  
but with CRM and sales tools.

Key design principle:

"Chat is the workspace."

Users should not need to switch between many pages.

Everything important should be accessible from the chat screen.

---

# 2. Inbox Layout

The inbox UI is divided into **three main panels**.

Layout structure:

Left Panel → Conversation List  
Center Panel → Chat Window  
Right Panel → CRM Context Panel

Visual structure:

Sidebar (collapsed icons)
|
Conversation List
|
Chat Window
|
CRM Panel

---

# 3. Left Sidebar

The sidebar contains navigation icons.

Default behavior:

Collapsed (icons only).

Menu items:

Inbox  
Customers  
Invoices  
Dashboard  
Settings

Inbox must be the **default landing page** after login.

---

# 4. Conversation List Panel

The conversation list displays all customer conversations.

Each item contains:

Customer avatar  
Customer name  
Last message preview  
Timestamp  
Assignment status  
Unread indicator  
Source attribution badge (optional)

Sorting:

Latest message first.

Pagination:

Infinite scroll.

---

# 5. Conversation Filters

The conversation list supports three filters.

Unassigned  
My Chats  
All Chats

Definitions:

Unassigned → conversations not assigned to any member  
My Chats → conversations assigned to current user  
All Chats → all conversations in org

Default filter:

Unassigned

---

# 6. Conversation Assignment

Users can assign conversations.

Assignment methods:

Click assign button  
Keyboard shortcut

Rules:

When assigned:

assignedToMemberId is updated.

Realtime event must notify other users.

---

# 7. Conversation Status

Each conversation has a status.

Values:

OPEN  
CLOSED

Meaning:

OPEN → active conversation  
CLOSED → archived conversation

Closed conversations should be hidden from default inbox view.

Users can reopen conversations.

---

# 8. Conversation Header

The chat header displays key customer info.

Fields:

Customer name  
Phone number  
Tags  
Source attribution  
Assignment status  
Conversation status

Actions available:

Assign conversation  
Close conversation  
Create invoice

---

# 9. Chat Window

The chat window displays messages in chronological order.

Message rendering rules:

Inbound messages on left  
Outbound messages on right

Each message bubble includes:

Message text  
Timestamp  
Media preview if present

---

# 10. Message Types

Supported message types:

TEXT  
IMAGE  
VIDEO  
AUDIO (voice note)  
DOCUMENT  
TEMPLATE  
SYSTEM

SYSTEM messages include events such as:

Invoice sent  
Payment confirmed

SYSTEM messages must show a label:

[Automated]

---

# 11. Media Messages

Media messages include:

Image preview  
Video preview  
Audio player  
PDF download

Media files are loaded from R2 storage.

---

# 12. Message Input Area

The message input includes:

Text input  
Attachment button  
Template button  
Send button

Attachment types allowed:

Image  
PDF  
Video

Voice recording is not required in MVP.

Voice messages can only be received.

---

# 13. Template Messages

Users can send template messages.

Template UI must show:

Template name  
Category  
Estimated cost

Example categories:

Marketing  
Utility  
Authentication  
Service

Tooltip must explain:

Meta charges per conversation window.

---

# 14. Keyboard Shortcuts

The inbox must support keyboard shortcuts.

Required shortcuts:

N → next unassigned conversation  
A → assign conversation to self  
I → create invoice  
P → attach payment proof  
/ → quick reply  
Ctrl + / → open shortcut help modal

Shortcut help modal must be accessible to users.

---

# 15. CRM Context Panel

The right panel shows customer context.

Sections include:

Customer profile  
Tags  
Notes  
Invoices  
Activity timeline

This panel allows quick CRM actions.

---

# 16. Customer Profile Section

Fields displayed:

Customer name  
Phone number  
Avatar

Avatar priority:

WhatsApp profile picture  
Fallback to initials

User can edit display name.

---

# 17. Tags

Users can create custom tags.

Example tags:

VIP  
Hot Lead  
Wedding  
Corporate

Tags appear in conversation header and CRM panel.

---

# 18. Notes

Users can add internal notes to a customer.

Notes are visible only to organization members.

Each note includes:

Author  
Content  
Timestamp

Notes appear in customer activity timeline.

---

# 19. Customer Activity Timeline

Timeline shows major events.

Examples:

Conversation started  
Invoice created  
Invoice sent  
Payment proof attached  
Invoice marked paid

Timeline helps auditing customer history.

---

# 20. Creating Invoice from Chat

Users must be able to create invoices directly from chat.

Methods:

Click "Create Invoice"  
Keyboard shortcut I

Invoice drawer opens.

Customer information is auto-filled.

---

# 21. Attaching Payment Proof

Customer sends transfer proof.

CS can attach it to an invoice.

Steps:

Hover message  
Click "Attach to Invoice"  
Select invoice

Proof record is created.

Invoice shows attached proof.

---

# 22. Realtime Updates

Inbox must update in realtime.

Events:

New message  
Assignment change  
Conversation status change  
Invoice update

Realtime system uses Ably.

Channels:

org:{orgId}

---

# 23. Empty States

Inbox must show helpful empty states.

Examples:

No conversations → show onboarding hint  
No messages → show conversation start  
No invoices → encourage invoice creation

Empty states improve user understanding.

---

# 24. Performance Rules

Inbox must remain responsive.

Rules:

Use pagination for messages  
Use virtualization for long chats  
Avoid loading entire message history at once

---

# 25. Error Handling

Errors must not crash the UI.

Examples:

Failed message send → show retry option  
Failed media load → show placeholder

Error messages must be user-friendly.

---

# 26. Permission Rules

Role permissions:

Owner → full access  
Admin → operational access  
CS → chat handling  
Advertiser → no chat access

Advertiser must not see:

Messages  
Attachments  
Customer data

Advertiser may only see analytics.

---

# 27. Inbox System Summary

The inbox system is the heart of 20byte.

It must provide:

- real-time chat
- CRM context
- invoice creation
- payment proof tracking
- attribution visibility

All within a single workspace.

The goal is to make the inbox feel like:

"WhatsApp Web with superpowers for business."