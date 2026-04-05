import { publishConversationUpdatedEvent, publishMessageNewEvent } from "@/lib/ably/publisher";

export function publishMessageNewEventNonBlocking(input: {
  orgId: string;
  conversationId: string;
  messageId: string;
  direction: "INBOUND" | "OUTBOUND";
}): void {
  void publishMessageNewEvent(input);
}

export function publishInboundConversationUpdatedNonBlocking(input: {
  orgId: string;
  conversationId: string;
  assignedToMemberId: string | null;
  status: "OPEN" | "CLOSED";
  crmPipelineId?: string | null;
  crmStageId?: string | null;
  crmStageName?: string | null;
}): void {
  void publishConversationUpdatedEvent(input);
}
