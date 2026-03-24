export { createConversation } from "@/server/services/conversation/create";
export { assignConversation } from "@/server/services/conversation/assignment";
export { markConversationAsRead, updateConversationStatus } from "@/server/services/conversation/status";
export { getConversationById, listConversations } from "@/server/services/conversation/listing";
export { deleteConversation } from "@/server/services/conversation/delete";

export type {
  AssignmentSummary,
  AssignConversationInput,
  ConversationListFilter,
  ConversationListItem,
  ConversationListResult,
  ConversationSummary,
  CreateConversationInput,
  DeleteConversationInput,
  ListConversationsInput,
  MarkConversationAsReadInput,
  UpdateConversationStatusInput
} from "@/server/services/conversation/types";
