"use client";

import { useCallback } from "react";

import type {
  AttachProofResponse,
  CreateNoteResponse,
  CreateTagResponse,
  CustomerTagsResponse
} from "@/components/inbox/workspace/types";

import type { InboxWorkspaceLoaders } from "./useInboxWorkspaceLoaders";
import type { InboxWorkspaceState } from "./useInboxWorkspaceState";

type SendTextMessage = (text: string) => Promise<void>;

export function useInboxWorkspaceCrmInvoiceActions(
  state: InboxWorkspaceState,
  loaders: InboxWorkspaceLoaders,
  sendTextMessage: SendTextMessage
) {
  const {
    orgId,
    selectedConversation,
    selectedConversationId,
    selectedProofMessageId,
    isAttachingProof,
    isSendingInvoice,
    isMarkingInvoicePaid,
    setCrmError,
    setProofFeedback,
    setIsAttachingProof,
    setSelectedProofMessageId,
    setInvoiceActionError,
    setInvoiceActionSuccess,
    setIsSendingInvoice,
    setIsMarkingInvoicePaid,
    setIsInvoiceDrawerOpen,
    setIsProofShortcutModalOpen,
    setIsQuickReplyModalOpen
  } = state;

  const { loadConversation, loadConversationCrmContext, loadCustomerCrmContext } = loaders;

  const createTagForCustomer = useCallback(
    async (name: string, color: string) => {
      if (!orgId || !selectedConversation) {
        return;
      }

      setCrmError(null);
      const createResponse = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId, name, color })
      });

      const createPayload = (await createResponse.json().catch(() => null)) as CreateTagResponse | null;
      if (!createResponse.ok) {
        setCrmError(createPayload?.error?.message ?? "Failed to create tag.");
        return;
      }

      const createdTagId = createPayload?.data?.tag?.id;
      if (createdTagId) {
        const assignResponse = await fetch(`/api/customers/${encodeURIComponent(selectedConversation.customerId)}/tags`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orgId, tagId: createdTagId })
        });

        if (!assignResponse.ok) {
          const assignPayload = (await assignResponse.json().catch(() => null)) as CustomerTagsResponse | null;
          setCrmError(assignPayload?.error?.message ?? "Tag created but assignment failed.");
        }
      }

      await loadCustomerCrmContext(selectedConversation.customerId);
    },
    [loadCustomerCrmContext, orgId, selectedConversation, setCrmError]
  );

  const assignTagForCustomer = useCallback(
    async (tagId: string) => {
      if (!orgId || !selectedConversation) {
        return;
      }

      setCrmError(null);
      const response = await fetch(`/api/customers/${encodeURIComponent(selectedConversation.customerId)}/tags`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId, tagId })
      });

      const payload = (await response.json().catch(() => null)) as CustomerTagsResponse | null;
      if (!response.ok) {
        setCrmError(payload?.error?.message ?? "Failed to assign tag.");
        return;
      }

      await loadCustomerCrmContext(selectedConversation.customerId);
    },
    [loadCustomerCrmContext, orgId, selectedConversation, setCrmError]
  );

  const createCustomerNoteEntry = useCallback(
    async (content: string) => {
      if (!orgId || !selectedConversation) {
        return;
      }

      setCrmError(null);
      const response = await fetch(`/api/customers/${encodeURIComponent(selectedConversation.customerId)}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId, content })
      });

      const payload = (await response.json().catch(() => null)) as CreateNoteResponse | null;
      if (!response.ok) {
        setCrmError(payload?.error?.message ?? "Failed to create note.");
        return;
      }

      await loadCustomerCrmContext(selectedConversation.customerId);
    },
    [loadCustomerCrmContext, orgId, selectedConversation, setCrmError]
  );

  const attachSelectedMessageAsProof = useCallback(
    async (invoiceId: string, milestoneType?: "FULL" | "DP" | "FINAL") => {
      if (!orgId || !selectedProofMessageId || isAttachingProof) {
        return;
      }

      setProofFeedback(null);
      setIsAttachingProof(true);
      try {
        const response = await fetch(`/api/invoices/${encodeURIComponent(invoiceId)}/proofs`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orgId, messageId: selectedProofMessageId, milestoneType })
        });

        const payload = (await response.json().catch(() => null)) as AttachProofResponse | null;
        if (!response.ok) {
          setProofFeedback(payload?.error?.message ?? "Failed to attach proof.");
          return;
        }

        setProofFeedback("Payment proof attached successfully.");
        setSelectedProofMessageId(null);
        if (selectedConversationId) {
          await loadConversationCrmContext(selectedConversationId);
        }
      } catch {
        setProofFeedback("Network error while attaching proof.");
      } finally {
        setIsAttachingProof(false);
      }
    },
    [
      isAttachingProof,
      loadConversationCrmContext,
      orgId,
      selectedConversationId,
      selectedProofMessageId,
      setIsAttachingProof,
      setProofFeedback,
      setSelectedProofMessageId
    ]
  );

  const sendInvoiceFromPanel = useCallback(
    async (invoiceId: string) => {
      if (!orgId || !invoiceId || isSendingInvoice) {
        return;
      }

      setInvoiceActionError(null);
      setInvoiceActionSuccess(null);
      setIsSendingInvoice(true);
      try {
        const response = await fetch(`/api/invoices/${encodeURIComponent(invoiceId)}/send`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orgId })
        });
        const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
        if (!response.ok) {
          setInvoiceActionError(payload?.error?.message ?? "Failed to send invoice.");
          return;
        }

        setInvoiceActionSuccess("Invoice sent successfully.");
        if (selectedConversationId) {
          await loadConversation(selectedConversationId);
        }
      } catch {
        setInvoiceActionError("Network error while sending invoice.");
      } finally {
        setIsSendingInvoice(false);
      }
    },
    [
      isSendingInvoice,
      loadConversation,
      orgId,
      selectedConversationId,
      setInvoiceActionError,
      setInvoiceActionSuccess,
      setIsSendingInvoice
    ]
  );

  const markInvoicePaidFromPanel = useCallback(
    async (invoiceId: string, milestoneType?: "FULL" | "DP" | "FINAL") => {
      if (!orgId || !invoiceId || isMarkingInvoicePaid) {
        return;
      }

      setInvoiceActionError(null);
      setInvoiceActionSuccess(null);
      setIsMarkingInvoicePaid(true);
      try {
        const response = await fetch(`/api/invoices/${encodeURIComponent(invoiceId)}/mark-paid`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orgId, milestoneType })
        });
        const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
        if (!response.ok) {
          setInvoiceActionError(payload?.error?.message ?? "Failed to mark invoice paid.");
          return;
        }

        setInvoiceActionSuccess("Invoice payment updated.");
        if (selectedConversationId) {
          await loadConversation(selectedConversationId);
        }
      } catch {
        setInvoiceActionError("Network error while marking invoice paid.");
      } finally {
        setIsMarkingInvoicePaid(false);
      }
    },
    [
      isMarkingInvoicePaid,
      loadConversation,
      orgId,
      selectedConversationId,
      setInvoiceActionError,
      setInvoiceActionSuccess,
      setIsMarkingInvoicePaid
    ]
  );

  const openInvoiceDrawer = useCallback(() => {
    setIsInvoiceDrawerOpen(true);
  }, [setIsInvoiceDrawerOpen]);

  const openAttachProofShortcut = useCallback(() => {
    if (!selectedProofMessageId) {
      setProofFeedback("Select image/document message first to attach as payment proof.");
      return;
    }

    setIsProofShortcutModalOpen(true);
  }, [selectedProofMessageId, setIsProofShortcutModalOpen, setProofFeedback]);

  const sendQuickReply = useCallback(
    async (text: string) => {
      await sendTextMessage(text);
      setIsQuickReplyModalOpen(false);
    },
    [sendTextMessage, setIsQuickReplyModalOpen]
  );

  return {
    createTagForCustomer,
    assignTagForCustomer,
    createCustomerNoteEntry,
    attachSelectedMessageAsProof,
    sendInvoiceFromPanel,
    markInvoicePaidFromPanel,
    openInvoiceDrawer,
    openAttachProofShortcut,
    sendQuickReply
  };
}

export type InboxWorkspaceCrmInvoiceActions = ReturnType<typeof useInboxWorkspaceCrmInvoiceActions>;
