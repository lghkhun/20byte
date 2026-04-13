import type { ConversationStatus } from "@prisma/client";

import type { ConversationSummary, ConversationListItem } from "@/server/services/conversation/types";
import { resolveLastMessagePreview } from "@/server/services/conversation/utils";

function parseGroupParticipantsJson(value: string | null | undefined): string[] {
  const raw = value?.trim() ?? "";
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  } catch {
    return [];
  }
}

export function sanitizeConversationAvatarUrl(value: string | null | undefined): string | null {
  const normalized = value?.trim() ?? "";
  if (!normalized) {
    return null;
  }

  try {
    const parsed = new URL(normalized);
    const hostname = parsed.hostname.toLowerCase();
    if (hostname === "pps.whatsapp.net") {
      return null;
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

export function toConversationSummary(input: {
  conversation: {
    id: string;
    orgId: string;
    customerId: string;
    crmPipelineId: string | null;
    crmStageId: string | null;
    sourceCampaign: string | null;
    sourcePlatform: string | null;
    sourceMedium: string | null;
    status: ConversationStatus;
    assignedToMemberId: string | null;
    createdAt: Date;
    updatedAt: Date;
    crmPipeline?: {
      name: string;
    } | null;
    crmStage?: {
      name: string;
    } | null;
  };
  customer: {
    phoneE164: string;
    displayName: string | null;
    waProfilePicUrl: string | null;
    source: string | null;
    leadStatus: string | null;
  };
}): ConversationSummary {
  return {
    id: input.conversation.id,
    orgId: input.conversation.orgId,
    customerId: input.conversation.customerId,
    phoneE164: input.customer.phoneE164,
    customerDisplayName: input.customer.displayName,
    customerAvatarUrl: sanitizeConversationAvatarUrl(input.customer.waProfilePicUrl),
    customerLeadStatus: input.customer.leadStatus,
    crmPipelineId: input.conversation.crmPipelineId,
    crmPipelineName: input.conversation.crmPipeline?.name ?? null,
    crmStageId: input.conversation.crmStageId,
    crmStageName: input.conversation.crmStage?.name ?? null,
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
  crmPipelineId: string | null;
  crmStageId: string | null;
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
    waProfilePicUrl: string | null;
    source: string | null;
    leadStatus: string | null;
  };
  crmPipeline?: {
    name: string;
  } | null;
  crmStage?: {
    name: string;
  } | null;
  assignedToMember?: {
    user: {
      name: string | null;
    };
  } | null;
  lastMessageSenderName?: string | null;
  groupParticipantsJson?: string | null;
  shortlinkId?: string | null;
  waChatJid?: string | null;
  messages?: Array<{
    text: string | null;
    type: string;
    direction: "INBOUND" | "OUTBOUND";
    fileName: string | null;
    senderDisplayName?: string | null;
    senderPhoneE164?: string | null;
  }>;
}): ConversationListItem {
  const firstMessage = row.messages?.[0] ?? null;
  const isGroupConversation = Boolean(row.waChatJid?.endsWith("@g.us"));
  const normalizedCustomerName = row.customer.displayName?.trim() || null;
  const inboundSenderName = firstMessage?.direction === "INBOUND"
    ? firstMessage.senderDisplayName?.trim() || firstMessage.senderPhoneE164?.trim() || null
    : null;
  const normalizedLastMessageSender = row.lastMessageSenderName?.trim() || null;
  const shouldTreatGroupNameAsSenderName =
    isGroupConversation &&
    Boolean(normalizedCustomerName) &&
    Boolean(normalizedLastMessageSender) &&
    normalizedCustomerName!.toLowerCase() === normalizedLastMessageSender!.toLowerCase();
  const groupFallbackName = row.waChatJid
    ? `Grup ${row.waChatJid.split("@")[0].slice(-6)}`
    : "Grup WhatsApp";
  const resolvedCustomerDisplayName = isGroupConversation
    ? (shouldTreatGroupNameAsSenderName ? groupFallbackName : normalizedCustomerName ?? groupFallbackName)
    : (inboundSenderName ?? normalizedCustomerName);

  return {
    id: row.id,
    orgId: row.orgId,
    customerId: row.customerId,
    customerPhoneE164: row.customer.phoneE164,
    customerDisplayName: resolvedCustomerDisplayName,
    customerAvatarUrl: sanitizeConversationAvatarUrl(row.customer.waProfilePicUrl),
    customerLeadStatus: row.customer.leadStatus,
    crmPipelineId: row.crmPipelineId,
    crmPipelineName: row.crmPipeline?.name ?? null,
    crmStageId: row.crmStageId,
    crmStageName: row.crmStage?.name ?? null,
    lastMessagePreview: firstMessage
      ? resolveLastMessagePreview({
          text: firstMessage.text,
          type: firstMessage.type,
          fileName: firstMessage.fileName
        })
      : null,
    lastMessageType: firstMessage?.type ?? null,
    lastMessageDirection: firstMessage?.direction ?? null,
    source: row.customer.source,
    sourceCampaign: row.sourceCampaign,
    sourceAdset: row.sourcePlatform,
    sourceAd: row.sourceMedium,
    sourcePlatform: row.sourcePlatform,
    sourceMedium: row.sourceMedium,
    status: row.status,
    assignedToMemberId: row.assignedToMemberId,
    assignedToMemberName: row.assignedToMember?.user?.name ?? null,
    lastMessageSenderName: row.lastMessageSenderName ?? null,
    groupParticipants: parseGroupParticipantsJson(row.groupParticipantsJson),
    shortlinkId: row.shortlinkId ?? null,
    waChatJid: row.waChatJid ?? null,
    lastMessageAt: row.lastMessageAt,
    unreadCount: row.unreadCount,
    updatedAt: row.updatedAt
  };
}
