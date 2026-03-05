# DOC 16 — Event & Realtime System
File: DOC_16_EVENT_SYSTEM.md

Product: 20byte  
Purpose: Define realtime event architecture.

20byte uses **Ably** for realtime updates.

Events allow the UI to update instantly without polling.

---

# 1. Event Philosophy

Events must be:

predictable  
minimal  
structured

Avoid emitting unnecessary events.

---

# 2. Channel Structure

Channels follow:

```
org:{orgId}
org:{orgId}:user:{userId}
```

Example:

```
org:abc123
```

---

# 3. Core Events

The system must support the following events.

```
message.new
conversation.updated
assignment.changed
invoice.created
invoice.updated
invoice.paid
proof.attached
customer.updated
storage.updated
```

---

# 4. Event Payload Format

Standard payload:

```
{
  "type": "message.new",
  "orgId": "org_123",
  "entityId": "msg_456",
  "timestamp": "ISO_TIMESTAMP"
}
```

---

# 5. Message Events

```
message.new
```

Payload:

```
conversationId
messageId
direction
```

---

# 6. Conversation Events

```
conversation.updated
assignment.changed
```

Payload:

```
conversationId
assignedToMemberId
status
```

---

# 7. Invoice Events

```
invoice.created
invoice.updated
invoice.paid
```

Payload:

```
invoiceId
status
total
```

---

# 8. Storage Events

```
storage.updated
```

Payload:

```
orgId
storageUsedMb
quotaMb
```

---

# 9. Event Emission Rules

Emit events only when:

state changes  
user-visible update occurs

Avoid redundant events.

---

# 10. Event System Summary

Realtime events power the inbox experience.

Events must remain minimal and predictable.