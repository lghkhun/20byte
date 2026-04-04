import { Realtime } from "ably";

type MessageNewPayload = {
  type: "message.new";
  orgId: string;
  entityId: string;
  timestamp: string;
  conversationId: string;
  messageId: string;
  direction: "INBOUND" | "OUTBOUND";
};

type MessageStatusPayload = {
  type: "message.status";
  orgId: string;
  entityId: string;
  timestamp: string;
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

type ConversationUpdatedPayload = {
  type: "conversation.updated";
  orgId: string;
  entityId: string;
  timestamp: string;
  conversationId: string;
  assignedToMemberId: string | null;
  status: "OPEN" | "CLOSED";
};

type ConversationTypingPayload = {
  type: "conversation.typing";
  orgId: string;
  entityId: string;
  timestamp: string;
  conversationId: string;
  isTyping: boolean;
};

type AssignmentChangedPayload = {
  type: "assignment.changed";
  orgId: string;
  entityId: string;
  timestamp: string;
  conversationId: string;
  assignedToMemberId: string | null;
  status: "OPEN" | "CLOSED";
};

type InvoicePayload = {
  type: "invoice.created" | "invoice.updated" | "invoice.paid";
  orgId: string;
  entityId: string;
  timestamp: string;
  invoiceId: string;
  status: "DRAFT" | "SENT" | "PARTIALLY_PAID" | "PAID" | "VOID";
  total?: number;
};

type ProofAttachedPayload = {
  type: "proof.attached";
  orgId: string;
  entityId: string;
  timestamp: string;
  invoiceId: string;
  proofId: string;
};

type CustomerUpdatedPayload = {
  type: "customer.updated";
  orgId: string;
  entityId: string;
  timestamp: string;
  customerId: string;
};

type StorageUpdatedPayload = {
  type: "storage.updated";
  orgId: string;
  entityId: string;
  timestamp: string;
  storageUsedMb?: number;
  quotaMb?: number;
  orgUsageBytes?: number;
};

type SubscribeToOrgEventsInput = {
  orgId: string;
  onMessageNew?: (payload: MessageNewPayload) => void;
  onMessageStatus?: (payload: MessageStatusPayload) => void;
  onConversationUpdated?: (payload: ConversationUpdatedPayload) => void;
  onConversationTyping?: (payload: ConversationTypingPayload) => void;
  onAssignmentChanged?: (payload: AssignmentChangedPayload) => void;
  onInvoiceCreated?: (payload: InvoicePayload) => void;
  onInvoiceUpdated?: (payload: InvoicePayload) => void;
  onInvoicePaid?: (payload: InvoicePayload) => void;
  onProofAttached?: (payload: ProofAttachedPayload) => void;
  onCustomerUpdated?: (payload: CustomerUpdatedPayload) => void;
  onStorageUpdated?: (payload: StorageUpdatedPayload) => void;
  onConnectionStateChange?: (state: "initialized" | "connecting" | "connected" | "disconnected" | "suspended" | "failed") => void;
};

type AblyMessageData = Record<string, unknown> | null;

function parseMessageNewPayload(data: AblyMessageData, orgId: string): MessageNewPayload | null {
  if (!data || data.type !== "message.new") {
    return null;
  }

  if (
    data.orgId !== orgId ||
    typeof data.entityId !== "string" ||
    typeof data.timestamp !== "string" ||
    typeof data.conversationId !== "string" ||
    typeof data.messageId !== "string" ||
    (data.direction !== "INBOUND" && data.direction !== "OUTBOUND")
  ) {
    return null;
  }

  return {
    type: "message.new",
    orgId,
    entityId: data.entityId,
    timestamp: data.timestamp,
    conversationId: data.conversationId,
    messageId: data.messageId,
    direction: data.direction
  };
}

function parseMessageStatusPayload(data: AblyMessageData, orgId: string): MessageStatusPayload | null {
  if (!data || data.type !== "message.status") {
    return null;
  }

  const sendStatus = data.sendStatus;
  const deliveryStatus = data.deliveryStatus;
  if (
    data.orgId !== orgId ||
    typeof data.entityId !== "string" ||
    typeof data.timestamp !== "string" ||
    typeof data.conversationId !== "string" ||
    typeof data.messageId !== "string" ||
    (sendStatus !== null && sendStatus !== "PENDING" && sendStatus !== "SENT" && sendStatus !== "FAILED") ||
    (deliveryStatus !== null && deliveryStatus !== "SENT" && deliveryStatus !== "DELIVERED" && deliveryStatus !== "READ") ||
    (data.sendError !== null && typeof data.sendError !== "string") ||
    typeof data.retryable !== "boolean" ||
    typeof data.sendAttemptCount !== "number" ||
    (data.deliveredAt !== null && typeof data.deliveredAt !== "string") ||
    (data.readAt !== null && typeof data.readAt !== "string")
  ) {
    return null;
  }

  return {
    type: "message.status",
    orgId,
    entityId: data.entityId,
    timestamp: data.timestamp,
    conversationId: data.conversationId,
    messageId: data.messageId,
    sendStatus,
    deliveryStatus,
    sendError: data.sendError,
    retryable: data.retryable,
    sendAttemptCount: data.sendAttemptCount,
    deliveredAt: data.deliveredAt,
    readAt: data.readAt
  };
}

function parseConversationUpdatedPayload(data: AblyMessageData, orgId: string): ConversationUpdatedPayload | null {
  if (!data || data.type !== "conversation.updated") {
    return null;
  }

  if (
    data.orgId !== orgId ||
    typeof data.entityId !== "string" ||
    typeof data.timestamp !== "string" ||
    typeof data.conversationId !== "string" ||
    (data.assignedToMemberId !== null && typeof data.assignedToMemberId !== "string") ||
    (data.status !== "OPEN" && data.status !== "CLOSED")
  ) {
    return null;
  }

  return {
    type: "conversation.updated",
    orgId,
    entityId: data.entityId,
    timestamp: data.timestamp,
    conversationId: data.conversationId,
    assignedToMemberId: data.assignedToMemberId,
    status: data.status
  };
}

function parseConversationTypingPayload(data: AblyMessageData, orgId: string): ConversationTypingPayload | null {
  if (!data || data.type !== "conversation.typing") {
    return null;
  }

  if (
    data.orgId !== orgId ||
    typeof data.entityId !== "string" ||
    typeof data.timestamp !== "string" ||
    typeof data.conversationId !== "string" ||
    typeof data.isTyping !== "boolean"
  ) {
    return null;
  }

  return {
    type: "conversation.typing",
    orgId,
    entityId: data.entityId,
    timestamp: data.timestamp,
    conversationId: data.conversationId,
    isTyping: data.isTyping
  };
}

function parseAssignmentChangedPayload(data: AblyMessageData, orgId: string): AssignmentChangedPayload | null {
  if (!data || data.type !== "assignment.changed") {
    return null;
  }

  if (
    data.orgId !== orgId ||
    typeof data.entityId !== "string" ||
    typeof data.timestamp !== "string" ||
    typeof data.conversationId !== "string" ||
    (data.assignedToMemberId !== null && typeof data.assignedToMemberId !== "string") ||
    (data.status !== "OPEN" && data.status !== "CLOSED")
  ) {
    return null;
  }

  return {
    type: "assignment.changed",
    orgId,
    entityId: data.entityId,
    timestamp: data.timestamp,
    conversationId: data.conversationId,
    assignedToMemberId: data.assignedToMemberId,
    status: data.status
  };
}

function parseInvoicePayload(data: AblyMessageData, orgId: string): InvoicePayload | null {
  if (!data || (data.type !== "invoice.created" && data.type !== "invoice.updated" && data.type !== "invoice.paid")) {
    return null;
  }

  const status = data.status;
  if (
    data.orgId !== orgId ||
    typeof data.entityId !== "string" ||
    typeof data.timestamp !== "string" ||
    typeof data.invoiceId !== "string" ||
    (status !== "DRAFT" && status !== "SENT" && status !== "PARTIALLY_PAID" && status !== "PAID" && status !== "VOID")
  ) {
    return null;
  }

  if (data.total !== undefined && typeof data.total !== "number") {
    return null;
  }

  return {
    type: data.type,
    orgId,
    entityId: data.entityId,
    timestamp: data.timestamp,
    invoiceId: data.invoiceId,
    status,
    total: data.total
  };
}

function parseProofAttachedPayload(data: AblyMessageData, orgId: string): ProofAttachedPayload | null {
  if (!data || data.type !== "proof.attached") {
    return null;
  }

  if (
    data.orgId !== orgId ||
    typeof data.entityId !== "string" ||
    typeof data.timestamp !== "string" ||
    typeof data.invoiceId !== "string" ||
    typeof data.proofId !== "string"
  ) {
    return null;
  }

  return {
    type: "proof.attached",
    orgId,
    entityId: data.entityId,
    timestamp: data.timestamp,
    invoiceId: data.invoiceId,
    proofId: data.proofId
  };
}

function parseCustomerUpdatedPayload(data: AblyMessageData, orgId: string): CustomerUpdatedPayload | null {
  if (!data || data.type !== "customer.updated") {
    return null;
  }

  if (data.orgId !== orgId || typeof data.entityId !== "string" || typeof data.timestamp !== "string" || typeof data.customerId !== "string") {
    return null;
  }

  return {
    type: "customer.updated",
    orgId,
    entityId: data.entityId,
    timestamp: data.timestamp,
    customerId: data.customerId
  };
}

function parseStorageUpdatedPayload(data: AblyMessageData, orgId: string): StorageUpdatedPayload | null {
  if (!data || data.type !== "storage.updated") {
    return null;
  }

  if (data.orgId !== orgId || typeof data.entityId !== "string" || typeof data.timestamp !== "string") {
    return null;
  }

  if (
    (data.storageUsedMb !== undefined && typeof data.storageUsedMb !== "number") ||
    (data.quotaMb !== undefined && typeof data.quotaMb !== "number") ||
    (data.orgUsageBytes !== undefined && typeof data.orgUsageBytes !== "number")
  ) {
    return null;
  }

  return {
    type: "storage.updated",
    orgId,
    entityId: data.entityId,
    timestamp: data.timestamp,
    storageUsedMb: data.storageUsedMb,
    quotaMb: data.quotaMb,
    orgUsageBytes: data.orgUsageBytes
  };
}

export async function subscribeToOrgMessageEvents(input: SubscribeToOrgEventsInput): Promise<() => void> {
  const orgId = input.orgId.trim();
  if (!orgId) {
    throw new Error("orgId is required for realtime subscription.");
  }

  const client = new Realtime({
    authUrl: `/api/realtime/ably/token?orgId=${encodeURIComponent(orgId)}`
  });

  const channel = client.channels.get(`org:${orgId}`);
  input.onConnectionStateChange?.(client.connection.state as "initialized" | "connecting" | "connected" | "disconnected" | "suspended" | "failed");

  const connectionStateListener = (stateChange: { current: string }) => {
    const currentState = stateChange.current;
    if (
      currentState === "initialized" ||
      currentState === "connecting" ||
      currentState === "connected" ||
      currentState === "disconnected" ||
      currentState === "suspended" ||
      currentState === "failed"
    ) {
      input.onConnectionStateChange?.(currentState);
    }
  };
  client.connection.on(connectionStateListener);

  const messageNewListener = (message: { data?: unknown }) => {
    if (!input.onMessageNew) {
      return;
    }

    const payload = parseMessageNewPayload((message.data ?? null) as AblyMessageData, orgId);
    if (!payload) {
      return;
    }

    input.onMessageNew(payload);
  };

  const messageStatusListener = (message: { data?: unknown }) => {
    if (!input.onMessageStatus) {
      return;
    }

    const payload = parseMessageStatusPayload((message.data ?? null) as AblyMessageData, orgId);
    if (!payload) {
      return;
    }

    input.onMessageStatus(payload);
  };

  const conversationUpdatedPayloadListener = (message: { data?: unknown }) => {
    if (!input.onConversationUpdated) {
      return;
    }
    const payload = parseConversationUpdatedPayload((message.data ?? null) as AblyMessageData, orgId);
    if (!payload) {
      return;
    }
    input.onConversationUpdated(payload);
  };

  const assignmentChangedListener = (message: { data?: unknown }) => {
    if (!input.onAssignmentChanged) {
      return;
    }
    const payload = parseAssignmentChangedPayload((message.data ?? null) as AblyMessageData, orgId);
    if (!payload) {
      return;
    }
    input.onAssignmentChanged(payload);
  };

  const conversationTypingListener = (message: { data?: unknown }) => {
    if (!input.onConversationTyping) {
      return;
    }
    const payload = parseConversationTypingPayload((message.data ?? null) as AblyMessageData, orgId);
    if (!payload) {
      return;
    }
    input.onConversationTyping(payload);
  };

  const invoiceCreatedListener = (message: { data?: unknown }) => {
    if (!input.onInvoiceCreated) {
      return;
    }
    const payload = parseInvoicePayload((message.data ?? null) as AblyMessageData, orgId);
    if (!payload || payload.type !== "invoice.created") {
      return;
    }
    input.onInvoiceCreated(payload);
  };

  const invoiceUpdatedListener = (message: { data?: unknown }) => {
    if (!input.onInvoiceUpdated) {
      return;
    }
    const payload = parseInvoicePayload((message.data ?? null) as AblyMessageData, orgId);
    if (!payload || payload.type !== "invoice.updated") {
      return;
    }
    input.onInvoiceUpdated(payload);
  };

  const invoicePaidListener = (message: { data?: unknown }) => {
    if (!input.onInvoicePaid) {
      return;
    }
    const payload = parseInvoicePayload((message.data ?? null) as AblyMessageData, orgId);
    if (!payload || payload.type !== "invoice.paid") {
      return;
    }
    input.onInvoicePaid(payload);
  };

  const proofAttachedListener = (message: { data?: unknown }) => {
    if (!input.onProofAttached) {
      return;
    }
    const payload = parseProofAttachedPayload((message.data ?? null) as AblyMessageData, orgId);
    if (!payload) {
      return;
    }
    input.onProofAttached(payload);
  };

  const customerUpdatedListener = (message: { data?: unknown }) => {
    if (!input.onCustomerUpdated) {
      return;
    }
    const payload = parseCustomerUpdatedPayload((message.data ?? null) as AblyMessageData, orgId);
    if (!payload) {
      return;
    }
    input.onCustomerUpdated(payload);
  };

  const storageUpdatedListener = (message: { data?: unknown }) => {
    if (!input.onStorageUpdated) {
      return;
    }
    const payload = parseStorageUpdatedPayload((message.data ?? null) as AblyMessageData, orgId);
    if (!payload) {
      return;
    }
    input.onStorageUpdated(payload);
  };

  await channel.subscribe("message.new", messageNewListener);
  await channel.subscribe("message.status", messageStatusListener);
  await channel.subscribe("conversation.updated", conversationUpdatedPayloadListener);
  await channel.subscribe("conversation.typing", conversationTypingListener);
  await channel.subscribe("assignment.changed", assignmentChangedListener);
  await channel.subscribe("invoice.created", invoiceCreatedListener);
  await channel.subscribe("invoice.updated", invoiceUpdatedListener);
  await channel.subscribe("invoice.paid", invoicePaidListener);
  await channel.subscribe("proof.attached", proofAttachedListener);
  await channel.subscribe("customer.updated", customerUpdatedListener);
  await channel.subscribe("storage.updated", storageUpdatedListener);

  return () => {
    channel.unsubscribe("message.new", messageNewListener);
    channel.unsubscribe("message.status", messageStatusListener);
    channel.unsubscribe("conversation.updated", conversationUpdatedPayloadListener);
    channel.unsubscribe("conversation.typing", conversationTypingListener);
    channel.unsubscribe("assignment.changed", assignmentChangedListener);
    channel.unsubscribe("invoice.created", invoiceCreatedListener);
    channel.unsubscribe("invoice.updated", invoiceUpdatedListener);
    channel.unsubscribe("invoice.paid", invoicePaidListener);
    channel.unsubscribe("proof.attached", proofAttachedListener);
    channel.unsubscribe("customer.updated", customerUpdatedListener);
    channel.unsubscribe("storage.updated", storageUpdatedListener);
    client.connection.off(connectionStateListener);
    client.close();
  };
}
