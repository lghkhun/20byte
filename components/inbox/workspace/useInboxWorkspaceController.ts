"use client";

import { useInboxWorkspaceActions } from "@/components/inbox/workspace/controller/useInboxWorkspaceActions";
import { useInboxWorkspaceLoaders } from "@/components/inbox/workspace/controller/useInboxWorkspaceLoaders";
import { useInboxWorkspaceState } from "@/components/inbox/workspace/controller/useInboxWorkspaceState";

export function useInboxWorkspaceController() {
  const state = useInboxWorkspaceState();
  const loaders = useInboxWorkspaceLoaders(state);
  const actions = useInboxWorkspaceActions(state, loaders);

  return {
    orgId: state.orgId,
    error: state.error,
    isLoadingList: state.isLoadingList,
    workspaceSubtitle: loaders.workspaceSubtitle,
    conversations: state.conversations,
    selectedConversationId: state.selectedConversationId,
    setSelectedConversationId: state.setSelectedConversationId,
    filter: state.filter,
    statusFilter: state.statusFilter,
    setFilter: state.setFilter,
    setStatusFilter: state.setStatusFilter,
    loadConversation: loaders.loadConversation,
    loadConversations: loaders.loadConversations,
    selectedConversation: state.selectedConversation,
    isUpdatingConversationStatus: state.isUpdatingConversationStatus,
    messages: state.messages,
    isLoadingMessages: state.isLoadingMessages,
    messageError: state.messageError,
    sendTextMessage: actions.sendTextMessage,
    sendAttachmentMessage: actions.sendAttachmentMessage,
    sendTemplateMessage: actions.sendTemplateMessage,
    toggleSelectedConversationStatus: actions.toggleSelectedConversationStatus,
    retryOutboundMessage: actions.retryOutboundMessage,
    setSelectedProofMessageId: state.setSelectedProofMessageId,
    setProofFeedback: state.setProofFeedback,
    activeOrgRole: loaders.activeOrgRole,
    isLoadingConversation: state.isLoadingConversation,
    isAssigning: state.isAssigning,
    assignError: state.assignError,
    tags: state.tags,
    notes: state.notes,
    crmInvoices: state.crmInvoices,
    crmActivity: state.crmActivity,
    isLoadingCrm: state.isLoadingCrm,
    crmError: state.crmError,
    createTagForCustomer: actions.createTagForCustomer,
    assignTagForCustomer: actions.assignTagForCustomer,
    createCustomerNoteEntry: actions.createCustomerNoteEntry,
    selectedProofMessageId: state.selectedProofMessageId,
    isAttachingProof: state.isAttachingProof,
    proofFeedback: state.proofFeedback,
    attachSelectedMessageAsProof: actions.attachSelectedMessageAsProof,
    openInvoiceDrawer: actions.openInvoiceDrawer,
    assignSelectedConversationToMe: actions.assignSelectedConversationToMe,
    sendInvoiceFromPanel: actions.sendInvoiceFromPanel,
    markInvoicePaidFromPanel: actions.markInvoicePaidFromPanel,
    isSendingInvoice: state.isSendingInvoice,
    isMarkingInvoicePaid: state.isMarkingInvoicePaid,
    invoiceActionError: state.invoiceActionError,
    invoiceActionSuccess: state.invoiceActionSuccess,
    isQuickReplyModalOpen: state.isQuickReplyModalOpen,
    setIsQuickReplyModalOpen: state.setIsQuickReplyModalOpen,
    sendQuickReply: actions.sendQuickReply,
    isShortcutHelpOpen: state.isShortcutHelpOpen,
    setIsShortcutHelpOpen: state.setIsShortcutHelpOpen,
    isProofShortcutModalOpen: state.isProofShortcutModalOpen,
    setIsProofShortcutModalOpen: state.setIsProofShortcutModalOpen,
    isInvoiceDrawerOpen: state.isInvoiceDrawerOpen,
    setIsInvoiceDrawerOpen: state.setIsInvoiceDrawerOpen
  };
}
