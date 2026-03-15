"use client";

import { useCallback } from "react";

import type { AssignConversationResponse, SendMessageResponse, UpdateConversationStatusResponse } from "@/components/inbox/workspace/types";

import { useInboxWorkspaceCrmInvoiceActions } from "./useInboxWorkspaceCrmInvoiceActions";
import type { InboxWorkspaceLoaders } from "./useInboxWorkspaceLoaders";
import { useInboxWorkspaceShortcuts } from "./useInboxWorkspaceShortcuts";
import type { InboxWorkspaceState } from "./useInboxWorkspaceState";

export function useInboxWorkspaceActions(state: InboxWorkspaceState, loaders: InboxWorkspaceLoaders) {
  const {
    orgId,
    selectedConversationId,
    selectedConversation,
    isUpdatingConversationStatus,
    isAssigning,
    conversations,
    setMessageError,
    setAssignError,
    setIsAssigning,
    setIsUpdatingConversationStatus,
    setSelectedConversationId,
    setIsQuickReplyModalOpen,
    setIsShortcutHelpOpen
  } = state;

  const { loadConversation, loadConversations, loadMessages } = loaders;

  const sendTextMessage = useCallback(
    async (text: string) => {
      if (!orgId || !selectedConversationId) {
        return;
      }

      setMessageError(null);
      const response = await fetch("/api/inbox/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: selectedConversationId, type: "TEXT", text })
      });

      const payload = (await response.json().catch(() => null)) as SendMessageResponse | null;
      if (!response.ok) {
        setMessageError(payload?.error?.message ?? "Failed to send message.");
        await loadMessages(selectedConversationId);
        await loadConversations();
        return;
      }

      await loadMessages(selectedConversationId);
      await loadConversations();
    },
    [loadConversations, loadMessages, orgId, selectedConversationId, setMessageError]
  );

  const createConversation = useCallback(
    async (input: { phoneE164: string; customerDisplayName?: string }) => {
      if (!orgId) {
        return;
      }

      const response = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phoneE164: input.phoneE164,
          customerDisplayName: input.customerDisplayName
        })
      });

      const payload = (await response.json().catch(() => null)) as
        | {
            data?: { conversation?: { id?: string } };
            error?: { message?: string };
          }
        | null;

      if (!response.ok) {
        throw new Error(payload?.error?.message ?? "Failed to create conversation.");
      }

      await loadConversations();
      const createdConversationId = payload?.data?.conversation?.id;
      if (createdConversationId) {
        setSelectedConversationId(createdConversationId);
        await loadConversation(createdConversationId);
      }
    },
    [loadConversation, loadConversations, orgId, setSelectedConversationId]
  );

  const sendTemplateMessage = useCallback(
    async (input: { templateName: string; templateCategory: "MARKETING" | "UTILITY" | "AUTHENTICATION" | "SERVICE"; templateLanguageCode: string }) => {
      if (!orgId || !selectedConversationId) {
        return;
      }

      setMessageError(null);
      const response = await fetch("/api/inbox/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: selectedConversationId,
          type: "TEMPLATE",
          templateName: input.templateName,
          templateCategory: input.templateCategory,
          templateLanguageCode: input.templateLanguageCode,
          templateComponents: []
        })
      });

      const payload = (await response.json().catch(() => null)) as SendMessageResponse | null;
      if (!response.ok) {
        setMessageError(payload?.error?.message ?? "Failed to send template message.");
        await loadMessages(selectedConversationId);
        await loadConversations();
        return;
      }

      await loadMessages(selectedConversationId);
      await loadConversations();
    },
    [loadConversations, loadMessages, orgId, selectedConversationId, setMessageError]
  );

  const sendAttachmentMessage = useCallback(
    async (attachment: { file: File; fileName: string; mimeType: string; size: number }) => {
      if (!orgId || !selectedConversationId) {
        return;
      }

      setMessageError(null);
      const body = new FormData();
      body.set("conversationId", selectedConversationId);
      body.set("type", attachment.mimeType.startsWith("image/") ? "IMAGE" : attachment.mimeType.startsWith("video/") ? "VIDEO" : attachment.mimeType.startsWith("audio/") ? "AUDIO" : "DOCUMENT");
      body.set("file", attachment.file, attachment.fileName);

      const response = await fetch("/api/inbox/send", {
        method: "POST",
        body
      });

      const payload = (await response.json().catch(() => null)) as SendMessageResponse | null;
      if (!response.ok) {
        setMessageError(payload?.error?.message ?? "Failed to process attachment.");
        await loadMessages(selectedConversationId);
        await loadConversations();
        return;
      }

      await loadMessages(selectedConversationId);
      await loadConversations();
    },
    [loadConversations, loadMessages, orgId, selectedConversationId, setMessageError]
  );

  const toggleSelectedConversationStatus = useCallback(async () => {
    if (!orgId || !selectedConversationId || !selectedConversation || isUpdatingConversationStatus) {
      return;
    }

    setAssignError(null);
    setIsUpdatingConversationStatus(true);
    try {
      const nextStatus = selectedConversation.status === "OPEN" ? "CLOSED" : "OPEN";
      const response = await fetch("/api/conversations/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: selectedConversationId, status: nextStatus })
      });

      const payload = (await response.json().catch(() => null)) as UpdateConversationStatusResponse | null;
      if (!response.ok) {
        setAssignError(payload?.error?.message ?? "Failed to update conversation status.");
        return;
      }

      await loadConversations();
    } catch {
      setAssignError("Network error while updating conversation status.");
    } finally {
      setIsUpdatingConversationStatus(false);
    }
  }, [
    isUpdatingConversationStatus,
    loadConversations,
    orgId,
    selectedConversation,
    selectedConversationId,
    setAssignError,
    setIsUpdatingConversationStatus
  ]);

  const retryOutboundMessage = useCallback(
    async (messageId: string) => {
      if (!orgId || !selectedConversationId) {
        return;
      }

      setMessageError(null);
      const response = await fetch("/api/inbox/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId })
      });

      const payload = (await response.json().catch(() => null)) as SendMessageResponse | null;
      if (!response.ok) {
        setMessageError(payload?.error?.message ?? "Failed to retry outbound message.");
        return;
      }

      await loadMessages(selectedConversationId);
      await loadConversations();
    },
    [loadConversations, loadMessages, orgId, selectedConversationId, setMessageError]
  );

  const assignSelectedConversationToMe = useCallback(async () => {
    if (!orgId || !selectedConversationId || isAssigning) {
      return;
    }

    setAssignError(null);
    setIsAssigning(true);
    try {
      const response = await fetch("/api/conversations/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: selectedConversationId })
      });

      const payload = (await response.json().catch(() => null)) as AssignConversationResponse | null;
      if (!response.ok) {
        setAssignError(payload?.error?.message ?? "Failed to assign conversation.");
        return;
      }

      await loadConversations();
    } catch {
      setAssignError("Network error while assigning conversation.");
    } finally {
      setIsAssigning(false);
    }
  }, [isAssigning, loadConversations, orgId, selectedConversationId, setAssignError, setIsAssigning]);

  const goToNextUnassignedConversation = useCallback(() => {
    const unassigned = conversations.filter((conversation) => !conversation.assignedToMemberId);
    if (unassigned.length === 0) {
      return;
    }

    const currentIndex = unassigned.findIndex((conversation) => conversation.id === selectedConversationId);
    const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % unassigned.length : 0;
    const nextConversation = unassigned[nextIndex];
    if (!nextConversation) {
      return;
    }

    setSelectedConversationId(nextConversation.id);
    void loadConversation(nextConversation.id);
  }, [conversations, loadConversation, selectedConversationId, setSelectedConversationId]);

  const crmInvoiceActions = useInboxWorkspaceCrmInvoiceActions(state, loaders, sendTextMessage);

  useInboxWorkspaceShortcuts({
    selectedConversationId,
    setIsQuickReplyModalOpen,
    setIsShortcutHelpOpen,
    goToNextUnassignedConversation,
    assignSelectedConversationToMe,
    openInvoiceDrawer: crmInvoiceActions.openInvoiceDrawer,
    openAttachProofShortcut: crmInvoiceActions.openAttachProofShortcut
  });

  return {
    sendTextMessage,
    createConversation,
    sendTemplateMessage,
    sendAttachmentMessage,
    toggleSelectedConversationStatus,
    retryOutboundMessage,
    assignSelectedConversationToMe,
    createTagForCustomer: crmInvoiceActions.createTagForCustomer,
    assignTagForCustomer: crmInvoiceActions.assignTagForCustomer,
    createCustomerNoteEntry: crmInvoiceActions.createCustomerNoteEntry,
    updateCustomerNoteEntry: crmInvoiceActions.updateCustomerNoteEntry,
    deleteCustomerNoteEntry: crmInvoiceActions.deleteCustomerNoteEntry,
    attachSelectedMessageAsProof: crmInvoiceActions.attachSelectedMessageAsProof,
    openInvoiceDrawer: crmInvoiceActions.openInvoiceDrawer,
    sendInvoiceFromPanel: crmInvoiceActions.sendInvoiceFromPanel,
    markInvoicePaidFromPanel: crmInvoiceActions.markInvoicePaidFromPanel,
    sendQuickReply: crmInvoiceActions.sendQuickReply
  };
}

export type InboxWorkspaceActions = ReturnType<typeof useInboxWorkspaceActions>;
