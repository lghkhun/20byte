import type { ConversationStatus, Role } from "@prisma/client";

export type CreateConversationInput = {
  actorUserId: string;
  orgId: string;
  phoneE164: string;
  customerDisplayName?: string;
};

export type AssignConversationInput = {
  actorUserId: string;
  orgId: string;
  conversationId: string;
  assigneeUserId?: string;
};

export type ConversationSummary = {
  id: string;
  orgId: string;
  customerId: string;
  phoneE164: string;
  customerDisplayName: string | null;
  customerAvatarUrl: string | null;
  customerLeadStatus: string | null;
  crmPipelineId: string | null;
  crmPipelineName: string | null;
  crmStageId: string | null;
  crmStageName: string | null;
  source: string | null;
  sourceCampaign: string | null;
  sourceAdset: string | null;
  sourceAd: string | null;
  sourcePlatform: string | null;
  sourceMedium: string | null;
  status: ConversationStatus;
  assignedToMemberId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type AssignmentSummary = {
  conversationId: string;
  orgId: string;
  assignedToMemberId: string;
  assigneeUserId: string;
  assigneeRole: Role;
  updatedAt: Date;
};

export type UpdateConversationStatusInput = {
  actorUserId: string;
  orgId: string;
  conversationId: string;
  status: ConversationStatus;
};

export type MarkConversationAsReadInput = {
  actorUserId: string;
  orgId: string;
  conversationId: string;
};

export type DeleteConversationInput = {
  actorUserId: string;
  orgId: string;
  conversationId: string;
};

export type ConversationListFilter = "UNASSIGNED" | "MY" | "ALL";

export type ListConversationsInput = {
  actorUserId: string;
  orgId: string;
  filter?: ConversationListFilter;
  status?: ConversationStatus;
  query?: string;
  page?: number;
  limit?: number;
};

export type ConversationListItem = {
  id: string;
  orgId: string;
  customerId: string;
  customerPhoneE164: string;
  customerDisplayName: string | null;
  customerAvatarUrl: string | null;
  customerLeadStatus: string | null;
  crmPipelineId: string | null;
  crmPipelineName: string | null;
  crmStageId: string | null;
  crmStageName: string | null;
  lastMessagePreview: string | null;
  lastMessageType: string | null;
  lastMessageDirection: "INBOUND" | "OUTBOUND" | null;
  source: string | null;
  sourceCampaign: string | null;
  sourceAdset: string | null;
  sourceAd: string | null;
  sourcePlatform: string | null;
  sourceMedium: string | null;
  status: ConversationStatus;
  assignedToMemberId: string | null;
  lastMessageAt: Date | null;
  unreadCount: number;
  updatedAt: Date;
};

export type ConversationListResult = {
  conversations: ConversationListItem[];
  page: number;
  limit: number;
  total: number;
};
