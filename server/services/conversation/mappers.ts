import type { ConversationStatus } from "@prisma/client";

import type { ConversationSummary, ConversationListItem } from "@/server/services/conversation/types";
import { resolveLastMessagePreview } from "@/server/services/conversation/utils";

export function toConversationSummary(input: {
  conversation: {
    id: string;
    orgId: string;
    customerId: string;
    sourceCampaign: string | null;
    sourcePlatform: string | null;
    sourceMedium: string | null;
    status: ConversationStatus;
    assignedToMemberId: string | null;
    createdAt: Date;
    updatedAt: Date;
  };
  customer: {
    phoneE164: string;
    displayName: string | null;
    source: string | null;
  };
}): ConversationSummary {
  return {
    id: input.conversation.id,
    orgId: input.conversation.orgId,
    customerId: input.conversation.customerId,
    phoneE164: input.customer.phoneE164,
    customerDisplayName: input.customer.displayName,
    source: input.customer.source,
    sourceCampaign: input.conversation.sourceCampaign,
    sourceAdset: input.conversation.sourcePlatform,
    sourceAd: input.conversation.sourceMedium,
    sourcePlatform: input.conversation.sourcePlatform,
    sourceMedium: input.conversation.sourceMedium,
    status: input.conversation.status,
    assignedToMemberId: input.conversation.assignedToMemberId,
    createdAt: input.conversation.createdAt,
    updatedAt: input.conversation.updatedAt
  };
}

export function toConversationListItem(row: {
  id: string;
  orgId: string;
  customerId: string;
  sourceCampaign: string | null;
  sourcePlatform: string | null;
  sourceMedium: string | null;
  status: ConversationStatus;
  assignedToMemberId: string | null;
  lastMessageAt: Date | null;
  unreadCount: number;
  updatedAt: Date;
  customer: {
    phoneE164: string;
    displayName: string | null;
    source: string | null;
  };
  messages: Array<{
    text: string | null;
    type: string;
    fileName: string | null;
  }>;
}): ConversationListItem {
  return {
    id: row.id,
    orgId: row.orgId,
    customerId: row.customerId,
    customerPhoneE164: row.customer.phoneE164,
    customerDisplayName: row.customer.displayName,
    lastMessagePreview: row.messages[0]
      ? resolveLastMessagePreview({
          text: row.messages[0].text,
          type: row.messages[0].type,
          fileName: row.messages[0].fileName
        })
      : null,
    source: row.customer.source,
    sourceCampaign: row.sourceCampaign,
    sourceAdset: row.sourcePlatform,
    sourceAd: row.sourceMedium,
    sourcePlatform: row.sourcePlatform,
    sourceMedium: row.sourceMedium,
    status: row.status,
    assignedToMemberId: row.assignedToMemberId,
    lastMessageAt: row.lastMessageAt,
    unreadCount: row.unreadCount,
    updatedAt: row.updatedAt
  };
}
