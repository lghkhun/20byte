export type ConversationListFilter = "UNASSIGNED" | "MY" | "ALL";
export type ConversationStatusFilter = "OPEN" | "CLOSED";

export type ConversationItem = {
  id: string;
  orgId: string;
  customerId: string;
  customerPhoneE164: string;
  customerDisplayName: string | null;
  lastMessagePreview: string | null;
  source: string | null;
  sourceCampaign: string | null;
  sourceAdset: string | null;
  sourceAd: string | null;
  sourcePlatform: string | null;
  sourceMedium: string | null;
  status: "OPEN" | "CLOSED";
  assignedToMemberId: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
  updatedAt: string;
};
