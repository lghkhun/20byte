export type ConversationListFilter = "UNASSIGNED" | "MY" | "ALL";

export type ConversationItem = {
  id: string;
  orgId: string;
  customerId: string;
  customerPhoneE164: string;
  customerDisplayName: string | null;
  status: "OPEN" | "CLOSED";
  assignedToMemberId: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
  updatedAt: string;
};

export type MessageItem = {
  id: string;
  waMessageId: string | null;
  direction: "INBOUND" | "OUTBOUND";
  type: "TEXT" | "IMAGE" | "VIDEO" | "AUDIO" | "DOCUMENT" | "TEMPLATE" | "SYSTEM";
  text: string | null;
  mediaUrl: string | null;
  mimeType: string | null;
  fileName: string | null;
  templateName: string | null;
  templateCategory: "MARKETING" | "UTILITY" | "AUTHENTICATION" | "SERVICE" | null;
  isAutomated: boolean;
  createdAt: string;
};
