"use client";

import { useCallback } from "react";

import type { MessageItem } from "@/components/inbox/types";
import type { AssignConversationResponse, DeleteConversationResponse, SendMessageResponse, UpdateConversationStatusResponse } from "@/components/inbox/workspace/types";
import { recordInboxTelemetry } from "@/components/inbox/workspace/controller/inboxTelemetry";
import { notifySuccess } from "@/lib/ui/notify";

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
    setConversations,
    setMessageError,
    setAssignError,
    setIsAssigning,
    setIsUpdatingConversationStatus,
    setSelectedConversationId,
    setSelectedConversation,
    setMessages,
    setSelectedProofMessageId,
    setTags,
    setCrmInvoices,
    setCrmActivity,
    setIsConversationManuallyCleared,
    setIsQuickReplyModalOpen,
    setIsShortcutHelpOpen
  } = state;

  const { loadConversation, loadConversations, loadMessages } = loaders;
  const loadConversationsBackground = useCallback(() => loadConversations({ background: true }), [loadConversations]);
  const reconcileAfterSend = useCallback(async (conversationId?: string | null, options?: { refreshMessages?: boolean }) => {
    const targetConversationId = (conversationId ?? selectedConversationId)?.trim() ?? "";
    if (!targetConversationId) {
      return;
    }
    const shouldRefreshMessages = options?.refreshMessages ?? true;
    if (shouldRefreshMessages) {
      await Promise.all([
        loadMessages(targetConversationId, { background: true }),
        loadConversationsBackground()
      ]);
      return;
    }
    await loadConversationsBackground();
  }, [loadConversationsBackground, loadMessages, selectedConversationId]);

  const appendOptimisticOutboundMessage = useCallback(
    (input: {
      conversationId: string;
      type: MessageItem["type"];
      text: string | null;
      replyToMessageId?: string | null;
      replyToWaMessageId?: string | null;
      replyPreviewText?: string | null;
      templateName?: string | null;
      templateCategory?: MessageItem["templateCategory"];
      templateLanguageCode?: string | null;
    }) => {
      const timestamp = new Date().toISOString();
      const optimisticMessageId = `optimistic:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`;
      const optimisticMessage: MessageItem = {
        id: optimisticMessageId,
        waMessageId: null,
        replyToMessageId: input.replyToMessageId ?? null,
        replyToWaMessageId: input.replyToWaMessageId ?? null,
        replyPreviewText: input.replyPreviewText ?? null,
        replyPreviewSenderName: null,
        senderWaJid: null,
        senderPhoneE164: null,
        senderDisplayName: null,
        direction: "OUTBOUND",
        type: input.type,
        text: input.text,
        mediaId: null,
        mediaUrl: null,
        mimeType: null,
        fileName: null,
        fileSize: null,
        templateName: input.templateName ?? null,
        templateCategory: input.templateCategory ?? null,
        templateLanguageCode: input.templateLanguageCode ?? null,
        isAutomated: false,
        sendStatus: "PENDING",
        deliveryStatus: null,
        sendError: null,
        retryable: false,
        sendAttemptCount: 0,
        deliveredAt: null,
        readAt: null,
        createdAt: timestamp
      };

      setMessages((previousRows) => [...previousRows, optimisticMessage]);
      setConversations((previousRows) => {
        const target = previousRows.find((row) => row.id === input.conversationId);
        if (!target) {
          return previousRows;
        }

        const previewText = input.text?.trim() || (input.type === "TEMPLATE" ? `Template: ${input.templateName ?? "Template"}` : "Pesan terkirim");
        const nextTarget = {
          ...target,
          status: "OPEN" as const,
          lastMessagePreview: previewText,
          lastMessageType: input.type,
          lastMessageDirection: "OUTBOUND" as const,
          lastMessageAt: timestamp,
          updatedAt: timestamp
        };

        const nextRows = previousRows.filter((row) => row.id !== input.conversationId);
        nextRows.unshift(nextTarget);
        return nextRows;
      });
      setSelectedConversation((current) => {
        if (!current || current.id !== input.conversationId) {
          return current;
        }

        const previewText = input.text?.trim() || (input.type === "TEMPLATE" ? `Template: ${input.templateName ?? "Template"}` : "Pesan terkirim");
        return {
          ...current,
          status: "OPEN",
          lastMessagePreview: previewText,
          lastMessageType: input.type,
          lastMessageDirection: "OUTBOUND",
          lastMessageAt: timestamp,
          updatedAt: timestamp
        };
      });

      return optimisticMessageId;
    },
    [setConversations, setMessages, setSelectedConversation]
  );

  const removeOptimisticMessage = useCallback((optimisticMessageId: string) => {
    setMessages((previousRows) => previousRows.filter((row) => row.id !== optimisticMessageId));
  }, [setMessages]);

  const resolveOptimisticMessage = useCallback(
    (input: {
      optimisticMessageId: string;
      serverMessageId?: string | null;
      sendStatus?: MessageItem["sendStatus"];
      deliveryStatus?: MessageItem["deliveryStatus"];
      sendError?: string | null;
      retryable?: boolean;
      sendAttemptCount?: number;
    }) => {
      setMessages((previousRows) =>
        previousRows.map((row) => {
          if (row.id !== input.optimisticMessageId) {
            return row;
          }

          return {
            ...row,
            id: input.serverMessageId?.trim() || row.id,
            sendStatus: input.sendStatus ?? row.sendStatus,
            deliveryStatus: input.deliveryStatus ?? row.deliveryStatus,
            sendError: input.sendError ?? row.sendError,
            retryable: input.retryable ?? row.retryable,
            sendAttemptCount: input.sendAttemptCount ?? row.sendAttemptCount
          };
        })
      );
    },
    [setMessages]
  );

  const selectConversation = useCallback(
    (conversationId: string) => {
      setIsConversationManuallyCleared(false);
      setSelectedConversationId(conversationId);
      const conversationSnapshot = conversations.find((item) => item.id === conversationId);
      if (conversationSnapshot) {
        setSelectedConversation({
          ...conversationSnapshot,
          unreadCount: 0
        });
      }
      void loadConversation(conversationId);
    },
    [conversations, loadConversation, setIsConversationManuallyCleared, setSelectedConversation, setSelectedConversationId]
  );

  const clearSelectedConversation = useCallback(() => {
    setIsConversationManuallyCleared(true);
    setSelectedConversationId(null);
    setSelectedConversation(null);
    setMessages([]);
    setSelectedProofMessageId(null);
    setTags([]);
    setCrmInvoices([]);
    setCrmActivity([]);
  }, [
    setCrmActivity,
    setCrmInvoices,
    setIsConversationManuallyCleared,
    setMessages,
    setSelectedConversation,
    setSelectedConversationId,
    setSelectedProofMessageId,
    setTags
  ]);

  const sendTextMessage = useCallback(
    async (text: string, options?: { replyToMessageId?: string | null; replyPreviewText?: string | null; scheduleAt?: string | null }) => {
      if (!orgId || !selectedConversationId) {
        return;
      }

      const conversationId = selectedConversationId;
      const scheduleAt = options?.scheduleAt?.trim() ?? "";
      const startedAt = performance.now();
      setMessageError(null);
      const optimisticMessageId = scheduleAt
        ? null
        : appendOptimisticOutboundMessage({
            conversationId,
            type: "TEXT",
            text,
            replyToMessageId: options?.replyToMessageId ?? null,
            replyPreviewText: options?.replyPreviewText ?? null
          });
      const response = await fetch("/api/inbox/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId,
          type: "TEXT",
          text,
          replyToMessageId: options?.replyToMessageId ?? undefined,
          scheduleAt: scheduleAt || undefined
        })
      });

      const payload = (await response.json().catch(() => null)) as SendMessageResponse | null;
      if (!response.ok) {
        const errorMessage = payload?.error?.message ?? "Gagal mengirim pesan.";
        recordInboxTelemetry("send_latency_ms", Number((performance.now() - startedAt).toFixed(1)), {
          orgId,
          conversationId
        });
        if (optimisticMessageId) {
          removeOptimisticMessage(optimisticMessageId);
        }
        setMessageError(errorMessage);
        await reconcileAfterSend(conversationId, { refreshMessages: true });
        throw new Error(errorMessage);
      }

      if (scheduleAt) {
        recordInboxTelemetry("send_latency_ms", Number((performance.now() - startedAt).toFixed(1)), {
          orgId,
          conversationId
        });
        const dueAt = payload?.data?.schedule?.dueAt;
        notifySuccess(
          dueAt
            ? `Pesan dijadwalkan untuk ${new Date(dueAt).toLocaleString("id-ID", {
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit"
              })}.`
            : "Pesan berhasil dijadwalkan."
        );
        await reconcileAfterSend(conversationId, { refreshMessages: false });
        return { scheduledDueAt: dueAt ?? scheduleAt };
      }

      if (!optimisticMessageId) {
        return;
      }

      resolveOptimisticMessage({
        optimisticMessageId,
        serverMessageId: payload?.data?.message?.id ?? payload?.data?.message?.messageId ?? null,
        sendStatus: payload?.data?.message?.sendStatus ?? "SENT",
        deliveryStatus: payload?.data?.message?.deliveryStatus ?? "SENT",
        sendError: payload?.data?.message?.sendError ?? null,
        retryable: false
      });
      recordInboxTelemetry("send_latency_ms", Number((performance.now() - startedAt).toFixed(1)), {
        orgId,
        conversationId
      });
      await reconcileAfterSend(conversationId, { refreshMessages: false });
      return {};
    },
    [appendOptimisticOutboundMessage, orgId, reconcileAfterSend, removeOptimisticMessage, resolveOptimisticMessage, selectedConversationId, setMessageError]
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
        throw new Error(payload?.error?.message ?? "Gagal membuat percakapan.");
      }

      await loadConversations();
      const createdConversationId = payload?.data?.conversation?.id;
      if (createdConversationId) {
        setIsConversationManuallyCleared(false);
        setSelectedConversationId(createdConversationId);
        await loadConversation(createdConversationId);
      }
    },
    [loadConversation, loadConversations, orgId, setIsConversationManuallyCleared, setSelectedConversationId]
  );

  const sendTemplateMessage = useCallback(
    async (input: { templateName: string; templateCategory: "MARKETING" | "UTILITY" | "AUTHENTICATION" | "SERVICE"; templateLanguageCode: string }) => {
      if (!orgId || !selectedConversationId) {
        return;
      }

      const conversationId = selectedConversationId;
      const startedAt = performance.now();
      setMessageError(null);
      const optimisticMessageId = appendOptimisticOutboundMessage({
        conversationId,
        type: "TEMPLATE",
        text: `Template: ${input.templateName}`,
        templateName: input.templateName,
        templateCategory: input.templateCategory,
        templateLanguageCode: input.templateLanguageCode
      });
      const response = await fetch("/api/inbox/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId,
          type: "TEMPLATE",
          templateName: input.templateName,
          templateCategory: input.templateCategory,
          templateLanguageCode: input.templateLanguageCode,
          templateComponents: []
        })
      });

      const payload = (await response.json().catch(() => null)) as SendMessageResponse | null;
      if (!response.ok) {
        recordInboxTelemetry("send_latency_ms", Number((performance.now() - startedAt).toFixed(1)), {
          orgId,
          conversationId
        });
        removeOptimisticMessage(optimisticMessageId);
        setMessageError(payload?.error?.message ?? "Gagal mengirim template pesan.");
        await reconcileAfterSend(conversationId, { refreshMessages: true });
        return;
      }

      resolveOptimisticMessage({
        optimisticMessageId,
        serverMessageId: payload?.data?.message?.id ?? payload?.data?.message?.messageId ?? null,
        sendStatus: payload?.data?.message?.sendStatus ?? "SENT",
        deliveryStatus: payload?.data?.message?.deliveryStatus ?? "SENT",
        sendError: payload?.data?.message?.sendError ?? null,
        retryable: false
      });
      recordInboxTelemetry("send_latency_ms", Number((performance.now() - startedAt).toFixed(1)), {
        orgId,
        conversationId
      });
      await reconcileAfterSend(conversationId, { refreshMessages: false });
    },
    [appendOptimisticOutboundMessage, orgId, reconcileAfterSend, removeOptimisticMessage, resolveOptimisticMessage, selectedConversationId, setMessageError]
  );

  const sendAttachmentMessage = useCallback(
    async (
      attachment: { file: File; fileName: string; mimeType: string; size: number },
      options?: { replyToMessageId?: string | null; text?: string | null }
    ) => {
      if (!orgId || !selectedConversationId) {
        return;
      }

      const conversationId = selectedConversationId;
      const startedAt = performance.now();
      setMessageError(null);
      const body = new FormData();
      body.set("conversationId", conversationId);
      body.set("type", attachment.mimeType.startsWith("image/") ? "IMAGE" : attachment.mimeType.startsWith("video/") ? "VIDEO" : attachment.mimeType.startsWith("audio/") ? "AUDIO" : "DOCUMENT");
      if (options?.replyToMessageId) {
        body.set("replyToMessageId", options.replyToMessageId);
      }
      if (options?.text?.trim()) {
        body.set("text", options.text.trim());
      }
      body.set("file", attachment.file, attachment.fileName);

      const response = await fetch("/api/inbox/send", {
        method: "POST",
        body
      });

      const payload = (await response.json().catch(() => null)) as SendMessageResponse | null;
      if (!response.ok) {
        recordInboxTelemetry("send_latency_ms", Number((performance.now() - startedAt).toFixed(1)), {
          orgId,
          conversationId
        });
        setMessageError(payload?.error?.message ?? "Gagal memproses lampiran.");
        await reconcileAfterSend(conversationId, { refreshMessages: true });
        return;
      }

      recordInboxTelemetry("send_latency_ms", Number((performance.now() - startedAt).toFixed(1)), {
        orgId,
        conversationId
      });
      await reconcileAfterSend(conversationId, { refreshMessages: false });
    },
    [orgId, reconcileAfterSend, selectedConversationId, setMessageError]
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
        setAssignError(payload?.error?.message ?? "Gagal memperbarui status percakapan.");
        return;
      }

      await loadConversationsBackground();
    } catch {
      setAssignError("Terjadi masalah jaringan saat memperbarui status percakapan.");
    } finally {
      setIsUpdatingConversationStatus(false);
    }
  }, [
    isUpdatingConversationStatus,
    loadConversationsBackground,
    orgId,
    selectedConversation,
    selectedConversationId,
    setAssignError,
    setIsUpdatingConversationStatus
  ]);

  const deleteSelectedConversation = useCallback(async () => {
    if (!orgId || !selectedConversationId) {
      return;
    }

    setAssignError(null);
    try {
      const response = await fetch(`/api/conversations/${encodeURIComponent(selectedConversationId)}?orgId=${encodeURIComponent(orgId)}`, {
        method: "DELETE"
      });

      const payload = (await response.json().catch(() => null)) as DeleteConversationResponse | null;
      if (!response.ok) {
        setAssignError(payload?.error?.message ?? "Gagal menghapus percakapan.");
        return;
      }

      await loadConversationsBackground();
    } catch {
      setAssignError("Terjadi masalah jaringan saat menghapus percakapan.");
    }
  }, [loadConversationsBackground, orgId, selectedConversationId, setAssignError]);

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
        setMessageError(payload?.error?.message ?? "Gagal mengirim ulang pesan outbound.");
        return;
      }

      await reconcileAfterSend();
    },
    [orgId, reconcileAfterSend, selectedConversationId, setMessageError]
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
        setAssignError(payload?.error?.message ?? "Gagal meng-assign percakapan.");
        return;
      }

      await loadConversationsBackground();
    } catch {
      setAssignError("Terjadi masalah jaringan saat meng-assign percakapan.");
    } finally {
      setIsAssigning(false);
    }
  }, [isAssigning, loadConversationsBackground, orgId, selectedConversationId, setAssignError, setIsAssigning]);

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

    selectConversation(nextConversation.id);
  }, [conversations, selectConversation, selectedConversationId]);

  const crmInvoiceActions = useInboxWorkspaceCrmInvoiceActions(state, loaders, sendTextMessage);

  useInboxWorkspaceShortcuts({
    selectedConversationId,
    clearSelectedConversation,
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
    selectConversation,
    clearSelectedConversation,
    sendTemplateMessage,
    sendAttachmentMessage,
    toggleSelectedConversationStatus,
    deleteSelectedConversation,
    retryOutboundMessage,
    assignSelectedConversationToMe,
    createTagForCustomer: crmInvoiceActions.createTagForCustomer,
    assignTagForCustomer: crmInvoiceActions.assignTagForCustomer,
    attachSelectedMessageAsProof: crmInvoiceActions.attachSelectedMessageAsProof,
    openInvoiceDrawer: crmInvoiceActions.openInvoiceDrawer,
    sendInvoiceFromPanel: crmInvoiceActions.sendInvoiceFromPanel,
    markInvoicePaidFromPanel: crmInvoiceActions.markInvoicePaidFromPanel,
    sendQuickReply: crmInvoiceActions.sendQuickReply
  };
}

export type InboxWorkspaceActions = ReturnType<typeof useInboxWorkspaceActions>;
