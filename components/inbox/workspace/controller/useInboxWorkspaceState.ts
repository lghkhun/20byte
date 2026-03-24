"use client";

import { useState } from "react";

import type { ConversationItem, ConversationListFilter, ConversationStatusFilter, MessageItem } from "@/components/inbox/types";
import type { CrmActivityItem, CrmInvoiceItem, CustomerTagItem, OrgSummary } from "@/components/inbox/workspace/types";

export function useInboxWorkspaceState() {
  const [organizations, setOrganizations] = useState<OrgSummary[]>([]);
  const [hasLoadedOrganizations, setHasLoadedOrganizations] = useState(false);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [filter, setFilter] = useState<ConversationListFilter>("UNASSIGNED");
  const [statusFilter, setStatusFilter] = useState<ConversationStatusFilter>("OPEN");
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [isConversationManuallyCleared, setIsConversationManuallyCleared] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState<ConversationItem | null>(null);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [isLoadingConversation, setIsLoadingConversation] = useState(false);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messageError, setMessageError] = useState<string | null>(null);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [crmError, setCrmError] = useState<string | null>(null);
  const [isAssigning, setIsAssigning] = useState(false);
  const [isUpdatingConversationStatus, setIsUpdatingConversationStatus] = useState(false);
  const [isLoadingCrm, setIsLoadingCrm] = useState(false);
  const [isInvoiceDrawerOpen, setIsInvoiceDrawerOpen] = useState(false);
  const [selectedProofMessageId, setSelectedProofMessageId] = useState<string | null>(null);
  const [isAttachingProof, setIsAttachingProof] = useState(false);
  const [isSendingInvoice, setIsSendingInvoice] = useState(false);
  const [isMarkingInvoicePaid, setIsMarkingInvoicePaid] = useState(false);
  const [invoiceActionError, setInvoiceActionError] = useState<string | null>(null);
  const [invoiceActionSuccess, setInvoiceActionSuccess] = useState<string | null>(null);
  const [proofFeedback, setProofFeedback] = useState<string | null>(null);
  const [isProofShortcutModalOpen, setIsProofShortcutModalOpen] = useState(false);
  const [isQuickReplyModalOpen, setIsQuickReplyModalOpen] = useState(false);
  const [isShortcutHelpOpen, setIsShortcutHelpOpen] = useState(false);
  const [tags, setTags] = useState<CustomerTagItem[]>([]);
  const [crmInvoices, setCrmInvoices] = useState<CrmInvoiceItem[]>([]);
  const [crmActivity, setCrmActivity] = useState<CrmActivityItem[]>([]);
  const [metaTotal, setMetaTotal] = useState<number>(0);
  const [typingConversationId, setTypingConversationId] = useState<string | null>(null);

  return {
    organizations,
    setOrganizations,
    hasLoadedOrganizations,
    setHasLoadedOrganizations,
    orgId,
    setOrgId,
    filter,
    setFilter,
    statusFilter,
    setStatusFilter,
    conversations,
    setConversations,
    selectedConversationId,
    setSelectedConversationId,
    isConversationManuallyCleared,
    setIsConversationManuallyCleared,
    selectedConversation,
    setSelectedConversation,
    isLoadingList,
    setIsLoadingList,
    isLoadingConversation,
    setIsLoadingConversation,
    messages,
    setMessages,
    isLoadingMessages,
    setIsLoadingMessages,
    error,
    setError,
    messageError,
    setMessageError,
    assignError,
    setAssignError,
    crmError,
    setCrmError,
    isAssigning,
    setIsAssigning,
    isUpdatingConversationStatus,
    setIsUpdatingConversationStatus,
    isLoadingCrm,
    setIsLoadingCrm,
    isInvoiceDrawerOpen,
    setIsInvoiceDrawerOpen,
    selectedProofMessageId,
    setSelectedProofMessageId,
    isAttachingProof,
    setIsAttachingProof,
    isSendingInvoice,
    setIsSendingInvoice,
    isMarkingInvoicePaid,
    setIsMarkingInvoicePaid,
    invoiceActionError,
    setInvoiceActionError,
    invoiceActionSuccess,
    setInvoiceActionSuccess,
    proofFeedback,
    setProofFeedback,
    isProofShortcutModalOpen,
    setIsProofShortcutModalOpen,
    isQuickReplyModalOpen,
    setIsQuickReplyModalOpen,
    isShortcutHelpOpen,
    setIsShortcutHelpOpen,
    tags,
    setTags,
    crmInvoices,
    setCrmInvoices,
    crmActivity,
    setCrmActivity,
    metaTotal,
    setMetaTotal,
    typingConversationId,
    setTypingConversationId
  };
}

export type InboxWorkspaceState = ReturnType<typeof useInboxWorkspaceState>;
