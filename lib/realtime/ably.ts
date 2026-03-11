import { Rest } from "ably";

import {
  type BaseEventPayload,
  type InvoiceEventStatus,
  buildAssignmentChangedEventPayload,
  buildConversationUpdatedEventPayload,
  buildCustomerUpdatedEventPayload,
  buildInvoiceEventPayload,
  buildMessageNewEventPayload,
  buildOrgChannelName,
  buildProofAttachedEventPayload,
  buildStorageUpdatedEventPayload
} from "@/lib/realtime/eventPayloads";

let ablyClient: Rest | null = null;
let warnedMissingKey = false;

function getAblyClient(): Rest | null {
  if (ablyClient) {
    return ablyClient;
  }

  const apiKey = process.env.ABLY_API_KEY?.trim();
  if (!apiKey) {
    if (!warnedMissingKey && process.env.NODE_ENV !== "test") {
      warnedMissingKey = true;
      console.warn("[realtime] ABLY_API_KEY is not set. Realtime publish is skipped.");
    }

    return null;
  }

  ablyClient = new Rest(apiKey);
  return ablyClient;
}

async function publishOrgEvent(payload: BaseEventPayload): Promise<void> {
  const client = getAblyClient();
  if (!client) {
    return;
  }

  const channel = client.channels.get(buildOrgChannelName(payload.orgId));
  await channel.publish(payload.type, payload);
}

export async function publishMessageNewEvent(input: {
  orgId: string;
  conversationId: string;
  messageId: string;
  direction: "INBOUND" | "OUTBOUND";
}): Promise<void> {
  const payload = buildMessageNewEventPayload(input);

  try {
    await publishOrgEvent(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown realtime publish error";
    console.error(`[realtime] failed to publish message.new: ${message}`);
  }
}

export async function publishConversationUpdatedEvent(input: {
  orgId: string;
  conversationId: string;
  assignedToMemberId: string | null;
  status: "OPEN" | "CLOSED";
}): Promise<void> {
  const payload = buildConversationUpdatedEventPayload(input);

  try {
    await publishOrgEvent(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown realtime publish error";
    console.error(`[realtime] failed to publish conversation.updated: ${message}`);
  }
}

export async function publishAssignmentChangedEvent(input: {
  orgId: string;
  conversationId: string;
  assignedToMemberId: string | null;
  status: "OPEN" | "CLOSED";
}): Promise<void> {
  const payload = buildAssignmentChangedEventPayload(input);

  try {
    await publishOrgEvent(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown realtime publish error";
    console.error(`[realtime] failed to publish assignment.changed: ${message}`);
  }
}

async function publishInvoiceEvent(input: {
  type: "invoice.created" | "invoice.updated" | "invoice.paid";
  orgId: string;
  invoiceId: string;
  status: InvoiceEventStatus;
  total?: number;
}): Promise<void> {
  const payload = buildInvoiceEventPayload(input);

  try {
    await publishOrgEvent(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown realtime publish error";
    console.error(`[realtime] failed to publish ${payload.type}: ${message}`);
  }
}

export async function publishInvoiceCreatedEvent(input: {
  orgId: string;
  invoiceId: string;
  status: InvoiceEventStatus;
  total?: number;
}): Promise<void> {
  await publishInvoiceEvent({
    type: "invoice.created",
    orgId: input.orgId,
    invoiceId: input.invoiceId,
    status: input.status,
    total: input.total
  });
}

export async function publishInvoiceUpdatedEvent(input: {
  orgId: string;
  invoiceId: string;
  status: InvoiceEventStatus;
  total?: number;
}): Promise<void> {
  await publishInvoiceEvent({
    type: "invoice.updated",
    orgId: input.orgId,
    invoiceId: input.invoiceId,
    status: input.status,
    total: input.total
  });
}

export async function publishInvoicePaidEvent(input: {
  orgId: string;
  invoiceId: string;
  status: "PAID";
  total?: number;
}): Promise<void> {
  await publishInvoiceEvent({
    type: "invoice.paid",
    orgId: input.orgId,
    invoiceId: input.invoiceId,
    status: input.status,
    total: input.total
  });
}

export async function publishProofAttachedEvent(input: {
  orgId: string;
  invoiceId: string;
  proofId: string;
}): Promise<void> {
  const payload = buildProofAttachedEventPayload(input);

  try {
    await publishOrgEvent(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown realtime publish error";
    console.error(`[realtime] failed to publish proof.attached: ${message}`);
  }
}

export async function publishCustomerUpdatedEvent(input: {
  orgId: string;
  customerId: string;
}): Promise<void> {
  const payload = buildCustomerUpdatedEventPayload(input);

  try {
    await publishOrgEvent(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown realtime publish error";
    console.error(`[realtime] failed to publish customer.updated: ${message}`);
  }
}

export async function publishStorageUpdatedEvent(input: {
  orgId: string;
  storageUsedMb?: number;
  quotaMb?: number;
  orgUsageBytes?: number;
}): Promise<void> {
  const payload = buildStorageUpdatedEventPayload(input);

  try {
    await publishOrgEvent(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown realtime publish error";
    console.error(`[realtime] failed to publish storage.updated: ${message}`);
  }
}
