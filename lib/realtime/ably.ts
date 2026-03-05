import { Rest } from "ably";

type CoreEventType =
  | "message.new"
  | "conversation.updated"
  | "assignment.changed"
  | "invoice.created"
  | "invoice.updated"
  | "invoice.paid"
  | "proof.attached"
  | "customer.updated"
  | "storage.updated";

type BaseEventPayload = {
  type: CoreEventType;
  orgId: string;
  entityId: string;
  timestamp: string;
};

type MessageNewEventPayload = BaseEventPayload & {
  type: "message.new";
  conversationId: string;
  messageId: string;
  direction: "INBOUND" | "OUTBOUND";
};

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

function orgChannelName(orgId: string): string {
  const normalized = orgId.trim();
  if (!normalized) {
    throw new Error("orgId is required for realtime publish.");
  }

  return `org:${normalized}`;
}

async function publishOrgEvent(payload: BaseEventPayload): Promise<void> {
  const client = getAblyClient();
  if (!client) {
    return;
  }

  const channel = client.channels.get(orgChannelName(payload.orgId));
  await channel.publish(payload.type, payload);
}

export async function publishMessageNewEvent(input: {
  orgId: string;
  conversationId: string;
  messageId: string;
  direction: "INBOUND" | "OUTBOUND";
}): Promise<void> {
  const payload: MessageNewEventPayload = {
    type: "message.new",
    orgId: input.orgId,
    entityId: input.messageId,
    timestamp: new Date().toISOString(),
    conversationId: input.conversationId,
    messageId: input.messageId,
    direction: input.direction
  };

  try {
    await publishOrgEvent(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown realtime publish error";
    console.error(`[realtime] failed to publish message.new: ${message}`);
  }
}

