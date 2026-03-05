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
  onMessageNew: (payload: MessageNewPayload) => void;
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
  const listener = (message: { data?: unknown }) => {
    const payload = parseMessageNewPayload((message.data ?? null) as AblyMessageData, orgId);
    if (!payload) {
      return;
    }

    input.onMessageNew(payload);
  };

  await channel.subscribe("message.new", listener);

  return () => {
    channel.unsubscribe("message.new", listener);
    client.close();
  };
}

