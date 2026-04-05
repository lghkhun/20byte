export type CoreEventType =
  | "message.new"
  | "message.status"
  | "conversation.updated"
  | "conversation.typing"
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

export type MessageStatusEventPayload = BaseEventPayload & {
  type: "message.status";
  conversationId: string;
  messageId: string;
  sendStatus: "PENDING" | "SENT" | "FAILED" | null;
  deliveryStatus: "SENT" | "DELIVERED" | "READ" | null;
  sendError: string | null;
  retryable: boolean;
  sendAttemptCount: number;
  deliveredAt: string | null;
  readAt: string | null;
};

export type ConversationUpdatedEventPayload = BaseEventPayload & {
  type: "conversation.updated";
  conversationId: string;
  assignedToMemberId: string | null;
  status: "OPEN" | "CLOSED";
  crmPipelineId?: string | null;
  crmStageId?: string | null;
  crmStageName?: string | null;
};

export type ConversationTypingEventPayload = BaseEventPayload & {
  type: "conversation.typing";
  conversationId: string;
  isTyping: boolean;
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

function normalizeOptionalTrimmed(value: string | null | undefined): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }

  const normalized = value.trim();
  return normalized || null;
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

export function buildMessageStatusEventPayload(input: {
  orgId: string;
  conversationId: string;
  messageId: string;
  sendStatus: "PENDING" | "SENT" | "FAILED" | null;
  deliveryStatus: "SENT" | "DELIVERED" | "READ" | null;
  sendError: string | null;
  retryable: boolean;
  sendAttemptCount: number;
  deliveredAt?: Date | string | null;
  readAt?: Date | string | null;
}): MessageStatusEventPayload {
  return {
    type: "message.status",
    orgId: requireTrimmed(input.orgId, "orgId"),
    entityId: requireTrimmed(input.messageId, "messageId"),
    timestamp: nowIso(),
    conversationId: requireTrimmed(input.conversationId, "conversationId"),
    messageId: requireTrimmed(input.messageId, "messageId"),
    sendStatus: input.sendStatus,
    deliveryStatus: input.deliveryStatus,
    sendError: input.sendError,
    retryable: Boolean(input.retryable),
    sendAttemptCount: Math.max(0, Math.floor(input.sendAttemptCount)),
    deliveredAt: input.deliveredAt ? new Date(input.deliveredAt).toISOString() : null,
    readAt: input.readAt ? new Date(input.readAt).toISOString() : null
  };
}

export function buildConversationUpdatedEventPayload(input: {
  orgId: string;
  conversationId: string;
  assignedToMemberId: string | null;
  status: "OPEN" | "CLOSED";
  crmPipelineId?: string | null;
  crmStageId?: string | null;
  crmStageName?: string | null;
}): ConversationUpdatedEventPayload {
  const crmPipelineId = normalizeOptionalTrimmed(input.crmPipelineId);
  const crmStageId = normalizeOptionalTrimmed(input.crmStageId);
  const crmStageName = normalizeOptionalTrimmed(input.crmStageName);

  return {
    type: "conversation.updated",
    orgId: requireTrimmed(input.orgId, "orgId"),
    entityId: requireTrimmed(input.conversationId, "conversationId"),
    timestamp: nowIso(),
    conversationId: requireTrimmed(input.conversationId, "conversationId"),
    assignedToMemberId: input.assignedToMemberId,
    status: input.status,
    ...(crmPipelineId !== undefined ? { crmPipelineId } : {}),
    ...(crmStageId !== undefined ? { crmStageId } : {}),
    ...(crmStageName !== undefined ? { crmStageName } : {})
  };
}

export function buildConversationTypingEventPayload(input: {
  orgId: string;
  conversationId: string;
  isTyping: boolean;
}): ConversationTypingEventPayload {
  return {
    type: "conversation.typing",
    orgId: requireTrimmed(input.orgId, "orgId"),
    entityId: requireTrimmed(input.conversationId, "conversationId"),
    timestamp: nowIso(),
    conversationId: requireTrimmed(input.conversationId, "conversationId"),
    isTyping: Boolean(input.isTyping)
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
