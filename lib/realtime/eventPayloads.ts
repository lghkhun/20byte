export type CoreEventType =
  | "message.new"
  | "conversation.updated"
  | "assignment.changed"
  | "invoice.created"
  | "invoice.updated"
  | "invoice.paid"
  | "proof.attached"
  | "customer.updated"
  | "storage.updated";

export type BaseEventPayload = {
  type: CoreEventType;
  orgId: string;
  entityId: string;
  timestamp: string;
};

export type MessageNewEventPayload = BaseEventPayload & {
  type: "message.new";
  conversationId: string;
  messageId: string;
  direction: "INBOUND" | "OUTBOUND";
};

export type ConversationUpdatedEventPayload = BaseEventPayload & {
  type: "conversation.updated";
  conversationId: string;
  assignedToMemberId: string | null;
  status: "OPEN" | "CLOSED";
};

export type AssignmentChangedEventPayload = BaseEventPayload & {
  type: "assignment.changed";
  conversationId: string;
  assignedToMemberId: string | null;
  status: "OPEN" | "CLOSED";
};

export type InvoiceEventStatus = "DRAFT" | "SENT" | "PARTIALLY_PAID" | "PAID" | "VOID";

export type InvoiceEventPayload = BaseEventPayload & {
  type: "invoice.created" | "invoice.updated" | "invoice.paid";
  invoiceId: string;
  status: InvoiceEventStatus;
  total?: number;
};

export type ProofAttachedEventPayload = BaseEventPayload & {
  type: "proof.attached";
  invoiceId: string;
  proofId: string;
};

export type CustomerUpdatedEventPayload = BaseEventPayload & {
  type: "customer.updated";
  customerId: string;
};

export type StorageUpdatedEventPayload = BaseEventPayload & {
  type: "storage.updated";
  storageUsedMb?: number;
  quotaMb?: number;
  orgUsageBytes?: number;
};

function nowIso(): string {
  return new Date().toISOString();
}

function requireTrimmed(value: string, fieldName: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${fieldName} is required.`);
  }

  return normalized;
}

export function buildOrgChannelName(orgId: string): string {
  return `org:${requireTrimmed(orgId, "orgId")}`;
}

export function buildMessageNewEventPayload(input: {
  orgId: string;
  conversationId: string;
  messageId: string;
  direction: "INBOUND" | "OUTBOUND";
}): MessageNewEventPayload {
  return {
    type: "message.new",
    orgId: requireTrimmed(input.orgId, "orgId"),
    entityId: requireTrimmed(input.messageId, "messageId"),
    timestamp: nowIso(),
    conversationId: requireTrimmed(input.conversationId, "conversationId"),
    messageId: requireTrimmed(input.messageId, "messageId"),
    direction: input.direction
  };
}

export function buildConversationUpdatedEventPayload(input: {
  orgId: string;
  conversationId: string;
  assignedToMemberId: string | null;
  status: "OPEN" | "CLOSED";
}): ConversationUpdatedEventPayload {
  return {
    type: "conversation.updated",
    orgId: requireTrimmed(input.orgId, "orgId"),
    entityId: requireTrimmed(input.conversationId, "conversationId"),
    timestamp: nowIso(),
    conversationId: requireTrimmed(input.conversationId, "conversationId"),
    assignedToMemberId: input.assignedToMemberId,
    status: input.status
  };
}

export function buildAssignmentChangedEventPayload(input: {
  orgId: string;
  conversationId: string;
  assignedToMemberId: string | null;
  status: "OPEN" | "CLOSED";
}): AssignmentChangedEventPayload {
  return {
    type: "assignment.changed",
    orgId: requireTrimmed(input.orgId, "orgId"),
    entityId: requireTrimmed(input.conversationId, "conversationId"),
    timestamp: nowIso(),
    conversationId: requireTrimmed(input.conversationId, "conversationId"),
    assignedToMemberId: input.assignedToMemberId,
    status: input.status
  };
}

export function buildInvoiceEventPayload(input: {
  type: "invoice.created" | "invoice.updated" | "invoice.paid";
  orgId: string;
  invoiceId: string;
  status: InvoiceEventStatus;
  total?: number;
}): InvoiceEventPayload {
  return {
    type: input.type,
    orgId: requireTrimmed(input.orgId, "orgId"),
    entityId: requireTrimmed(input.invoiceId, "invoiceId"),
    timestamp: nowIso(),
    invoiceId: requireTrimmed(input.invoiceId, "invoiceId"),
    status: input.status,
    total: input.total
  };
}

export function buildProofAttachedEventPayload(input: {
  orgId: string;
  invoiceId: string;
  proofId: string;
}): ProofAttachedEventPayload {
  return {
    type: "proof.attached",
    orgId: requireTrimmed(input.orgId, "orgId"),
    entityId: requireTrimmed(input.proofId, "proofId"),
    timestamp: nowIso(),
    invoiceId: requireTrimmed(input.invoiceId, "invoiceId"),
    proofId: requireTrimmed(input.proofId, "proofId")
  };
}

export function buildCustomerUpdatedEventPayload(input: {
  orgId: string;
  customerId: string;
}): CustomerUpdatedEventPayload {
  return {
    type: "customer.updated",
    orgId: requireTrimmed(input.orgId, "orgId"),
    entityId: requireTrimmed(input.customerId, "customerId"),
    timestamp: nowIso(),
    customerId: requireTrimmed(input.customerId, "customerId")
  };
}

export function buildStorageUpdatedEventPayload(input: {
  orgId: string;
  storageUsedMb?: number;
  quotaMb?: number;
  orgUsageBytes?: number;
}): StorageUpdatedEventPayload {
  return {
    type: "storage.updated",
    orgId: requireTrimmed(input.orgId, "orgId"),
    entityId: requireTrimmed(input.orgId, "orgId"),
    timestamp: nowIso(),
    storageUsedMb: input.storageUsedMb,
    quotaMb: input.quotaMb,
    orgUsageBytes: input.orgUsageBytes
  };
}
