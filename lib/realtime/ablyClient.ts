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

type SubscribeToOrgEventsInput = {
  orgId: string;
  onMessageNew?: (payload: MessageNewPayload) => void;
  onConversationUpdated?: () => void;
  onAssignmentChanged?: () => void;
  onInvoiceCreated?: () => void;
  onInvoiceUpdated?: () => void;
  onInvoicePaid?: () => void;
  onProofAttached?: () => void;
  onCustomerUpdated?: () => void;
  onStorageUpdated?: () => void;
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

export async function subscribeToOrgMessageEvents(input: SubscribeToOrgEventsInput): Promise<() => void> {
  const orgId = input.orgId.trim();
  if (!orgId) {
    throw new Error("orgId is required for realtime subscription.");
  }

  const client = new Realtime({
    authUrl: `/api/realtime/ably/token?orgId=${encodeURIComponent(orgId)}`
  });

  const channel = client.channels.get(`org:${orgId}`);
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

  const conversationUpdatedListener = () => {
    input.onConversationUpdated?.();
  };

  const assignmentChangedListener = () => {
    input.onAssignmentChanged?.();
  };

  const invoiceCreatedListener = () => {
    input.onInvoiceCreated?.();
  };

  const invoiceUpdatedListener = () => {
    input.onInvoiceUpdated?.();
  };

  const invoicePaidListener = () => {
    input.onInvoicePaid?.();
  };

  const proofAttachedListener = () => {
    input.onProofAttached?.();
  };

  const customerUpdatedListener = () => {
    input.onCustomerUpdated?.();
  };

  const storageUpdatedListener = () => {
    input.onStorageUpdated?.();
  };

  await channel.subscribe("message.new", messageNewListener);
  await channel.subscribe("conversation.updated", conversationUpdatedListener);
  await channel.subscribe("assignment.changed", assignmentChangedListener);
  await channel.subscribe("invoice.created", invoiceCreatedListener);
  await channel.subscribe("invoice.updated", invoiceUpdatedListener);
  await channel.subscribe("invoice.paid", invoicePaidListener);
  await channel.subscribe("proof.attached", proofAttachedListener);
  await channel.subscribe("customer.updated", customerUpdatedListener);
  await channel.subscribe("storage.updated", storageUpdatedListener);

  return () => {
    channel.unsubscribe("message.new", messageNewListener);
    channel.unsubscribe("conversation.updated", conversationUpdatedListener);
    channel.unsubscribe("assignment.changed", assignmentChangedListener);
    channel.unsubscribe("invoice.created", invoiceCreatedListener);
    channel.unsubscribe("invoice.updated", invoiceUpdatedListener);
    channel.unsubscribe("invoice.paid", invoicePaidListener);
    channel.unsubscribe("proof.attached", proofAttachedListener);
    channel.unsubscribe("customer.updated", customerUpdatedListener);
    channel.unsubscribe("storage.updated", storageUpdatedListener);
    client.close();
  };
}
