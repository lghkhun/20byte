# INBOX INDICATOR GUIDE
File: docs/INBOX_INDICATOR_GUIDE.md

Purpose:

Quick reference for CS/operator to read conversation status in Inbox.

---

# 1. Avatar Presence Dot

- Green dot: customer has recent activity (<= 5 minutes)
- Gray dot: no recent activity

---

# 2. Conversation Status Dot

- Green small dot: conversation is open
- Gray small dot: conversation is closed

---

# 3. Proof Ready Indicator

- `Proof ready` label or green proof dot appears when latest inbound message is:
- image (`IMAGE`) or
- document (`DOCUMENT`)

This means message can be attached as payment proof.

---

# 4. Unread Badge

- Badge number = unread inbound message count
- Maximum visual cap is `99+`

---

# 5. Timestamp

- Shows latest activity time (`lastMessageAt`, fallback `updatedAt`)
- Format:
- today: `HH:mm`
- yesterday: `Yesterday`
- this week: short weekday
- older: `MMM dd`

---

# 6. Lead Status Chip

- Lead status chip next to header/customer profile shows current CRM lead status.
- Value follows Lead Settings.
