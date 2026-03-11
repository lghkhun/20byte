import { publishConversationUpdatedEvent, publishMessageNewEvent } from "@/lib/ably/publisher";

export function publishMessageNewEventNonBlocking(input: {
  orgId: string;
  conversationId: string;
  messageId: string;
  direction: "INBOUND" | "OUTBOUND";
}): void {
  void publishMessageNewEvent(input);
}

export async function publishConversationUpdated(input: {
  orgId: string;
  conversationId: string;
  assignedToMemberId: string | null;
  status: "OPEN" | "CLOSED";
}): Promise<void> {
  await publishConversationUpdatedEvent(input);
}
