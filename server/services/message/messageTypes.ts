import type { MessageDirection, MessageType } from "@prisma/client";

export type StoreInboundMessageInput = {
  orgId: string;
  customerPhoneE164: string;
  customerDisplayName?: string;
  customerAvatarUrl?: string;
  shortlinkCode?: string;
  trackingId?: string;
  waMessageId: string;
  type: MessageType;
  text?: string;
  mediaId?: string;
  mediaUrl?: string;
  mimeType?: string;
  fileName?: string;
  fileSize?: number;
  durationSec?: number;
};

export type InboundStoreResult = {
  stored: boolean;
  duplicate: boolean;
  messageId: string | null;
  conversationId: string | null;
  conversationStatus: "OPEN" | "CLOSED" | null;
  assignedToMemberId: string | null;
};

export type SendOutboundMessageInput = {
  actorUserId: string;
  orgId: string;
  conversationId: string;
  type: "TEXT" | "IMAGE" | "VIDEO" | "AUDIO" | "DOCUMENT" | "TEMPLATE" | "SYSTEM";
  text?: string;
  mediaId?: string;
  mediaUrl?: string;
  mimeType?: string;
  fileName?: string;
  fileSize?: number;
  templateName?: string;
  templateCategory?: "MARKETING" | "UTILITY" | "AUTHENTICATION" | "SERVICE";
  templateLanguageCode?: string;
  templateComponents?: Array<Record<string, unknown>>;
};

export type OutboundStoreResult = {
  messageId: string;
  waMessageId: string | null;
  type: "TEXT" | "IMAGE" | "VIDEO" | "AUDIO" | "DOCUMENT" | "TEMPLATE" | "SYSTEM";
  sendStatus: "PENDING" | "SENT" | "FAILED";
  deliveryStatus: "SENT" | "DELIVERED" | "READ" | null;
  sendError: string | null;
  retryable: boolean;
  sendAttemptCount: number;
  createdAt: Date;
};

export type ListMessagesInput = {
  actorUserId: string;
  orgId: string;
  conversationId: string;
  beforeMessageId?: string;
  limit?: number;
};

export type MessageListItem = {
  id: string;
  waMessageId: string | null;
  direction: MessageDirection;
  type: MessageType;
  text: string | null;
  mediaUrl: string | null;
  mimeType: string | null;
  fileName: string | null;
  templateName: string | null;
  templateCategory: string | null;
  templateLanguageCode: string | null;
  isAutomated: boolean;
  sendStatus: "PENDING" | "SENT" | "FAILED" | null;
  deliveryStatus: "SENT" | "DELIVERED" | "READ" | null;
  sendError: string | null;
  retryable: boolean;
  sendAttemptCount: number;
  deliveredAt: Date | null;
  readAt: Date | null;
  createdAt: Date;
};

export type MessageListResult = {
  messages: MessageListItem[];
  limit: number;
  hasMore: boolean;
  nextBeforeMessageId: string | null;
  total?: number;
};

export type SearchConversationMessagesInput = {
  actorUserId: string;
  orgId: string;
  conversationId: string;
  query: string;
  limit?: number;
};

export type SearchConversationMessagesResult = {
  messages: Array<{
    id: string;
    text: string;
    createdAt: Date;
  }>;
  limit: number;
};

export type ResolvedAttribution = {
  source: string;
  campaign?: string;
  adset?: string;
  ad?: string;
  platform?: string;
  medium?: string;
  shortlinkId?: string;
  trackingId?: string;
};

export type RetryOutboundMessageInput = {
  actorUserId: string;
  orgId: string;
  messageId: string;
};
