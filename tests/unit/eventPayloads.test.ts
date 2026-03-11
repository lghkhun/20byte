import test from "node:test";
import assert from "node:assert/strict";

import {
  buildAssignmentChangedEventPayload,
  buildConversationUpdatedEventPayload,
  buildInvoiceEventPayload,
  buildMessageNewEventPayload,
  buildOrgChannelName,
  buildStorageUpdatedEventPayload
} from "@/lib/realtime/eventPayloads";

test("buildOrgChannelName enforces org-scoped channel naming", () => {
  assert.equal(buildOrgChannelName("org-123"), "org:org-123");
  assert.throws(() => buildOrgChannelName("   "));
});

test("message/conversation/assignment payloads include base + domain fields", () => {
  const messagePayload = buildMessageNewEventPayload({
    orgId: "org-1",
    conversationId: "conv-1",
    messageId: "msg-1",
    direction: "INBOUND"
  });
  assert.equal(messagePayload.type, "message.new");
  assert.equal(messagePayload.orgId, "org-1");
  assert.equal(messagePayload.entityId, "msg-1");
  assert.equal(messagePayload.conversationId, "conv-1");
  assert.equal(messagePayload.direction, "INBOUND");
  assert.equal(Number.isNaN(Date.parse(messagePayload.timestamp)), false);

  const convPayload = buildConversationUpdatedEventPayload({
    orgId: "org-1",
    conversationId: "conv-1",
    assignedToMemberId: null,
    status: "OPEN"
  });
  assert.equal(convPayload.type, "conversation.updated");
  assert.equal(convPayload.entityId, "conv-1");

  const assignmentPayload = buildAssignmentChangedEventPayload({
    orgId: "org-1",
    conversationId: "conv-1",
    assignedToMemberId: "member-1",
    status: "CLOSED"
  });
  assert.equal(assignmentPayload.type, "assignment.changed");
  assert.equal(assignmentPayload.assignedToMemberId, "member-1");
  assert.equal(assignmentPayload.status, "CLOSED");
});

test("invoice payload supports DOC16 total field while keeping standard base fields", () => {
  const payload = buildInvoiceEventPayload({
    type: "invoice.updated",
    orgId: "org-1",
    invoiceId: "inv-1",
    status: "SENT",
    total: 125000
  });

  assert.equal(payload.type, "invoice.updated");
  assert.equal(payload.orgId, "org-1");
  assert.equal(payload.entityId, "inv-1");
  assert.equal(payload.invoiceId, "inv-1");
  assert.equal(payload.status, "SENT");
  assert.equal(payload.total, 125000);
});

test("storage payload supports DOC16 usage fields", () => {
  const payload = buildStorageUpdatedEventPayload({
    orgId: "org-1",
    storageUsedMb: 512,
    quotaMb: 2048
  });

  assert.equal(payload.type, "storage.updated");
  assert.equal(payload.orgId, "org-1");
  assert.equal(payload.entityId, "org-1");
  assert.equal(payload.storageUsedMb, 512);
  assert.equal(payload.quotaMb, 2048);
});
