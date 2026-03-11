import type { ConversationListFilter, ConversationStatusFilter } from "@/components/inbox/types";

export const FILTER_LABELS: Record<ConversationListFilter, string> = {
  UNASSIGNED: "Unassigned",
  MY: "My Chats",
  ALL: "All Chats"
};

export const STATUS_LABELS: Record<ConversationStatusFilter, string> = {
  OPEN: "Open",
  CLOSED: "Closed"
};
