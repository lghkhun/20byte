"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { ChatWindow } from "@/components/inbox/ChatWindow";
import { AttachProofShortcutModal } from "@/components/inbox/AttachProofShortcutModal";
import { ConversationListPanel } from "@/components/inbox/ConversationListPanel";
import { CrmContextPanel } from "@/components/inbox/CrmContextPanel";
import { QuickReplyModal } from "@/components/inbox/QuickReplyModal";
import { ShortcutHelpModal } from "@/components/inbox/ShortcutHelpModal";
import { useInboxSelectedConversationPersistence } from "@/components/inbox/workspace/useInboxSelectedConversationPersistence";
import { useInboxWorkspaceController } from "@/components/inbox/workspace/useInboxWorkspaceController";
import { MobileCrmOverlay } from "@/components/inbox/workspace/MobileCrmOverlay";
import { useInboxWorkspacePreferences } from "@/components/inbox/workspace/useInboxWorkspacePreferences";
import { InvoiceDrawer } from "@/components/invoices/InvoiceDrawer";
import { Button } from "@/components/ui/button";
import { EmptyStatePanel, ErrorStatePanel } from "@/components/ui/state-panels";
import { PanelRightClose, PanelRightOpen } from "lucide-react";
import { notifySuccess, notifyWarning, notifyInfo } from "@/lib/ui/notify";
import type { MessageItem } from "@/components/inbox/types";

export function InboxWorkspace() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { density } = useInboxWorkspacePreferences();
  const {
    orgId,
    hasLoadedOrganizations,
    error,
    isLoadingList,
    isLoadingMoreConversations,
    hasMoreConversations,
    conversations,
    selectedConversationId,
    selectConversation,
    clearSelectedConversation,
    filter,
    statusFilter,
    setFilter,
    setStatusFilter,
    conversationSearchQuery,
    setConversationSearchQuery,
    loadConversation,
    loadConversations,
    loadMoreConversations,
    selectedConversation,
    isUpdatingConversationStatus,
    messages,
    isLoadingMessages,
    isLoadingOlderMessages,
    hasMoreMessages,
    loadOlderMessages,
    messageError,
    sendTextMessage,
    createConversation,
    sendAttachmentMessage,
    toggleSelectedConversationStatus,
    deleteSelectedConversation,
    retryOutboundMessage,
    setSelectedProofMessageId,
    setProofFeedback,
    activeOrgRole,
    isLoadingConversation,
    isAssigning,
    assignError,
    crmInvoices,
    crmActivity,
    typingConversationId,
    isLoadingCrm,
    crmError,
    isAttachingProof,
    attachSelectedMessageAsProof,
    openInvoiceDrawer,
    sendInvoiceFromPanel,
    markInvoicePaidFromPanel,
    isSendingInvoice,
    isMarkingInvoicePaid,
    invoiceActionError,
    invoiceActionSuccess,
    isQuickReplyModalOpen,
    setIsQuickReplyModalOpen,
    sendQuickReply,
    isShortcutHelpOpen,
    setIsShortcutHelpOpen,
    isProofShortcutModalOpen,
    setIsProofShortcutModalOpen,
    isInvoiceDrawerOpen,
    setIsInvoiceDrawerOpen,
    realtimeConnectionState
  } = useInboxWorkspaceController();

  useInboxSelectedConversationPersistence({
    orgId,
    selectedConversationId,
    conversations
  });

  const [mobilePane, setMobilePane] = useState<"list" | "chat">("list");
  const [isMobileCrmOpen, setIsMobileCrmOpen] = useState(false);
  const [isDesktopCrmOpen, setIsDesktopCrmOpen] = useState(true);
  const [crmPanelWidth, setCrmPanelWidth] = useState(320);
  const [isResizingCrm, setIsResizingCrm] = useState(false);
  const resizeOriginRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const handledDeepLinkConversationIdRef = useRef<string | null>(null);
  useEffect(() => {
    const deepLinkedConversationId = searchParams.get("conversationId")?.trim() ?? "";
    if (!orgId || !deepLinkedConversationId) {
      return;
    }

    if (handledDeepLinkConversationIdRef.current === deepLinkedConversationId) {
      return;
    }

    handledDeepLinkConversationIdRef.current = deepLinkedConversationId;
    selectConversation(deepLinkedConversationId);

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete("conversationId");
    const nextQueryString = nextParams.toString();
    router.replace(nextQueryString ? `${pathname}?${nextQueryString}` : pathname);
  }, [orgId, pathname, router, searchParams, selectConversation]);

  useEffect(() => {
    if (selectedConversationId) {
      setMobilePane("chat");
      return;
    }

    setMobilePane("list");
  }, [selectedConversationId]);
  useEffect(() => {
    if (mobilePane !== "chat") {
      setIsMobileCrmOpen(false);
    }
  }, [mobilePane]);

  useEffect(() => {
    const saved = window.localStorage.getItem("inbox.crm.width");
    if (saved) {
      const nextWidth = Number(saved);
      if (Number.isFinite(nextWidth)) {
        setCrmPanelWidth(Math.min(480, Math.max(260, nextWidth)));
      }
    }
  }, []);

  useEffect(() => {
    if (!isResizingCrm) {
      return;
    }

    function handleMove(event: MouseEvent) {
      if (!resizeOriginRef.current) {
        return;
      }

      const delta = resizeOriginRef.current.startX - event.clientX;
      const nextWidth = Math.min(480, Math.max(260, resizeOriginRef.current.startWidth + delta));
      setCrmPanelWidth(nextWidth);
    }

    function handleUp() {
      setIsResizingCrm(false);
      resizeOriginRef.current = null;
    }

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [isResizingCrm]);

  useEffect(() => {
    window.localStorage.setItem("inbox.crm.width", String(crmPanelWidth));
  }, [crmPanelWidth]);

  const prevRealtimeStateRef = useRef(realtimeConnectionState);
  useEffect(() => {
    if (prevRealtimeStateRef.current !== realtimeConnectionState) {
      if (realtimeConnectionState === "connected") {
        notifySuccess("Realtime tersambung", { description: "Pesan inbox kini sinkron secara langsung." });
      } else if (
        realtimeConnectionState === "connecting" ||
        realtimeConnectionState === "suspended" ||
        realtimeConnectionState === "failed" ||
        realtimeConnectionState === "disconnected"
      ) {
        if (prevRealtimeStateRef.current === "connected") {
          notifyWarning("Koneksi realtime terputus", { description: "Sedang mencoba menyambungkan kembali..." });
        }
      } else if (realtimeConnectionState === "fallback") {
        notifyInfo("Mode fallback aktif", { description: "Koneksi realtime lambat, menggunakan polling berkala." });
      }
      prevRealtimeStateRef.current = realtimeConnectionState;
    }
  }, [realtimeConnectionState]);

  const isCrmVisible = isDesktopCrmOpen && Boolean(selectedConversationId);
  const gridLayoutClass = isCrmVisible
    ? "grid h-full min-h-0 gap-2 lg:gap-3 lg:grid-cols-[var(--inbox-list-panel-width,340px)_minmax(0,1fr)_minmax(260px,var(--crm-panel-width))]"
    : "grid h-full min-h-0 gap-2 lg:gap-3 lg:grid-cols-[var(--inbox-list-panel-width,340px)_minmax(0,1fr)]";

  async function ensureConversationForPhone(phoneE164: string, customerDisplayName?: string): Promise<string> {
    const response = await fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orgId: orgId ?? undefined,
        phoneE164,
        customerDisplayName
      })
    });

    const payload = (await response.json().catch(() => null)) as
      | {
          data?: { conversation?: { id?: string } };
          error?: { message?: string };
        }
      | null;
    if (!response.ok) {
      throw new Error(payload?.error?.message ?? "Gagal membuat/memuat percakapan.");
    }

    const conversationId = payload?.data?.conversation?.id?.trim() ?? "";
    if (!conversationId) {
      throw new Error("Conversation id tidak ditemukan.");
    }
    return conversationId;
  }

  async function handleReplyPrivatelyFromMessage(message: MessageItem): Promise<void> {
    const targetPhone = message.senderPhoneE164?.trim() ?? "";
    if (!targetPhone) {
      notifyWarning("Nomor pengirim tidak tersedia untuk balas pribadi.");
      return;
    }

    try {
      const conversationId = await ensureConversationForPhone(targetPhone, message.senderDisplayName ?? undefined);
      selectConversation(conversationId);
      notifySuccess("Chat pribadi dibuka.");
    } catch (error) {
      notifyWarning(error instanceof Error ? error.message : "Gagal membuka chat pribadi.");
    }
  }

  async function handleForwardMessageToTarget(input: {
    message: MessageItem;
    targetPhoneE164: string;
    targetDisplayName?: string;
    suppressToast?: boolean;
  }): Promise<void> {
    const targetPhone = input.targetPhoneE164.trim();
    if (!targetPhone) {
      throw new Error("Nomor tujuan wajib diisi.");
    }

    const conversationId = await ensureConversationForPhone(targetPhone, input.targetDisplayName);
    const isForwardableMediaType =
      input.message.type === "IMAGE" ||
      input.message.type === "VIDEO" ||
      input.message.type === "AUDIO" ||
      input.message.type === "DOCUMENT";
    const trimmedText = input.message.text?.trim() ?? "";
    const mediaCaption = trimmedText ? `FWD: ${trimmedText}` : undefined;
    const fallbackFileNameByType =
      input.message.type === "IMAGE"
        ? "forwarded-image.jpg"
        : input.message.type === "VIDEO"
          ? "forwarded-video.mp4"
          : input.message.type === "AUDIO"
            ? "forwarded-audio.ogg"
            : "forwarded-document.bin";
    const forwardedFileName = input.message.fileName?.trim() || fallbackFileNameByType;

    if (isForwardableMediaType && (input.message.mediaUrl || input.message.mediaId)) {
      let mediaForwardSucceeded = false;
      let mediaForwardError: Error | null = null;

      if (input.message.mediaUrl) {
        try {
          const sourceMediaResponse = await fetch(input.message.mediaUrl);
          if (!sourceMediaResponse.ok) {
            throw new Error(`Source media fetch failed (${sourceMediaResponse.status})`);
          }

          const sourceBlob = await sourceMediaResponse.blob();
          const sourceFile = new File([sourceBlob], forwardedFileName, {
            type: sourceBlob.type || input.message.mimeType || "application/octet-stream"
          });

          const formData = new FormData();
          formData.append("conversationId", conversationId);
          formData.append("type", input.message.type);
          if (mediaCaption) {
            formData.append("text", mediaCaption);
          }
          formData.append("file", sourceFile);

          const multipartResponse = await fetch("/api/inbox/send", {
            method: "POST",
            body: formData
          });
          const multipartPayload = (await multipartResponse.json().catch(() => null)) as { error?: { message?: string } } | null;
          if (!multipartResponse.ok) {
            throw new Error(multipartPayload?.error?.message ?? "Gagal meneruskan media.");
          }

          mediaForwardSucceeded = true;
        } catch (error) {
          mediaForwardError = error instanceof Error ? error : new Error("Failed to forward media binary.");
        }
      }

      if (!mediaForwardSucceeded && input.message.mediaId && input.message.mediaUrl) {
        const response = await fetch("/api/inbox/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversationId,
            type: input.message.type,
            text: mediaCaption,
            mediaId: input.message.mediaId,
            mediaUrl: input.message.mediaUrl,
            mimeType: input.message.mimeType,
            fileName: forwardedFileName,
            fileSize: input.message.fileSize
          })
        });
        const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
        if (!response.ok) {
          throw new Error(payload?.error?.message ?? mediaForwardError?.message ?? "Gagal meneruskan media.");
        }

        mediaForwardSucceeded = true;
      }

      if (mediaForwardSucceeded) {
        if (!input.suppressToast) {
          notifySuccess("Media berhasil diteruskan.");
        }
        void loadConversations({ background: true });
        return;
      }
    }

    const fallbackText =
      input.message.type === "IMAGE"
        ? "[Forwarded image]"
        : input.message.type === "VIDEO"
          ? "[Forwarded video]"
          : input.message.type === "AUDIO"
            ? "[Forwarded audio]"
            : input.message.type === "DOCUMENT"
              ? `[Forwarded document] ${input.message.fileName ?? ""}`.trim()
              : `[Forwarded ${input.message.type.toLowerCase()}]`;
    const originalText = input.message.text?.trim() || input.message.replyPreviewText?.trim() || fallbackText;
    const forwardText =
      input.message.mediaUrl && !input.message.text
        ? `${originalText}\n${input.message.mediaUrl}`
        : originalText;

    const response = await fetch("/api/inbox/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conversationId,
        type: "TEXT",
        text: `FWD: ${forwardText}`
      })
    });
    const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
    if (!response.ok) {
      throw new Error(payload?.error?.message ?? "Gagal meneruskan pesan.");
    }

    if (!input.suppressToast) {
      notifySuccess("Pesan berhasil diteruskan.");
    }
    void loadConversations({ background: true });
  }

  async function handleCreateNoteFromMessage(message: MessageItem): Promise<void> {
    const customerId = selectedConversation?.customerId?.trim() ?? "";
    if (!customerId) {
      notifyWarning("Customer belum tersedia untuk menyimpan catatan.");
      return;
    }

    const senderLabel = message.senderDisplayName?.trim() || message.senderPhoneE164?.trim() || "Unknown";
    const textBody = message.text?.trim() || message.replyPreviewText?.trim() || `[${message.type}]`;
    const noteContent = `[Chat ${new Date(message.createdAt).toLocaleString("id-ID")}]\n${senderLabel}: ${textBody}`;

    try {
      const getResponse = await fetch(`/api/customers/${encodeURIComponent(customerId)}?orgId=${encodeURIComponent(orgId ?? "")}`);
      const getPayload = (await getResponse.json().catch(() => null)) as
        | {
            data?: {
              customer?: {
                remarks?: string | null;
              };
            };
            error?: { message?: string };
          }
        | null;
      if (!getResponse.ok) {
        throw new Error(getPayload?.error?.message ?? "Gagal memuat catatan customer.");
      }

      const previousRemarks = getPayload?.data?.customer?.remarks?.trim() ?? "";
      const mergedRemarks = previousRemarks ? `${previousRemarks}\n\n${noteContent}` : noteContent;

      const putResponse = await fetch(`/api/customers/${encodeURIComponent(customerId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId: orgId ?? undefined,
          remarks: mergedRemarks
        })
      });
      const putPayload = (await putResponse.json().catch(() => null)) as { error?: { message?: string } } | null;
      if (!putResponse.ok) {
        throw new Error(putPayload?.error?.message ?? "Gagal menyimpan catatan.");
      }
      notifySuccess("Catatan berhasil ditambahkan ke CRM.");
      setIsDesktopCrmOpen(true);
      if (selectedConversationId) {
        void loadConversation(selectedConversationId, { background: true });
      }
    } catch (error) {
      notifyWarning(error instanceof Error ? error.message : "Gagal menyimpan catatan.");
    }
  }

  return (
    <section className="flex h-full min-h-0 flex-1 overflow-hidden">
      {!orgId && hasLoadedOrganizations && !error ? (
        <EmptyStatePanel
          title="Bisnis Belum Tersedia"
          message="Belum ada bisnis yang terhubung ke akun ini."
        />
      ) : null}

      {orgId && error && !isLoadingList ? (
        <ErrorStatePanel title="Gagal Memuat Inbox" message={error} />
      ) : null}

      {orgId ? (
        <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
          <div className="mb-2 flex items-center gap-2 rounded-xl border border-border/80 bg-card/85 p-1.5 shadow-sm lg:hidden">
            <Button
              type="button"
              variant={mobilePane === "list" ? "secondary" : "ghost"}
              size="sm"
              className="h-8 flex-1 rounded-lg"
              onClick={() => setMobilePane("list")}
            >
              Percakapan
            </Button>
            <Button
              type="button"
              variant={mobilePane === "chat" ? "secondary" : "ghost"}
              size="sm"
              className="h-8 flex-1 rounded-lg"
              onClick={() => setMobilePane("chat")}
            >
              Chat
            </Button>
          </div>

          <div className={`${gridLayoutClass} max-h-full flex-1 overflow-hidden`} style={{ ["--crm-panel-width" as string]: `${crmPanelWidth}px` }}>
            <div
              className={`inbox-scroll flex h-full min-h-0 max-h-full flex-col overflow-y-auto overscroll-contain rounded-[24px] border border-border/70 bg-card/95 shadow-sm shadow-black/5 ${
                mobilePane === "chat" ? "hidden lg:block" : ""
              } ${mobilePane === "list" ? "inbox-fade-slide" : ""}`}
            >
              <ConversationListPanel
                density={density}
                conversations={conversations}
                selectedConversationId={selectedConversationId}
                filter={filter}
                status={statusFilter}
                searchQuery={conversationSearchQuery}
                isLoading={isLoadingList}
                isLoadingMore={isLoadingMoreConversations}
                hasMore={hasMoreConversations}
                error={error}
                onFilterChange={(nextFilter) => setFilter(nextFilter)}
                onStatusChange={(nextStatus) => setStatusFilter(nextStatus)}
                onSearchQueryChange={(nextQuery) => setConversationSearchQuery(nextQuery)}
                onSelectConversation={(conversationId) => {
                  selectConversation(conversationId);
                  setMobilePane("chat");
                }}
                onRefresh={() => {
                  void loadConversations();
                }}
                onLoadMore={() => {
                  void loadMoreConversations();
                }}
                onCreateConversation={createConversation}
              />
            </div>

            <div className={`inbox-scroll min-h-0 min-w-0 max-h-full overflow-y-auto overscroll-contain ${mobilePane === "list" ? "hidden lg:block" : ""} ${mobilePane === "chat" ? "inbox-fade-slide" : ""}`}>
              <div className="mb-2 flex items-center justify-between gap-2 lg:hidden">
                <Button type="button" variant="ghost" size="sm" className="h-8" onClick={() => setMobilePane("list")}>
                  Kembali ke percakapan
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="h-8 gap-1.5"
                  onClick={() => setIsMobileCrmOpen((current) => !current)}
                >
                  {isMobileCrmOpen ? <PanelRightClose className="h-3.5 w-3.5" /> : <PanelRightOpen className="h-3.5 w-3.5" />}
                  CRM
                </Button>
              </div>
              <ChatWindow
                density={density}
                conversation={selectedConversation}
                isUpdatingConversationStatus={isUpdatingConversationStatus}
                messages={messages}
                isLoading={isLoadingMessages}
                isLoadingOlderMessages={isLoadingOlderMessages}
                hasMoreMessages={hasMoreMessages}
                isConversationSelected={Boolean(selectedConversationId)}
                isCustomerTyping={Boolean(selectedConversationId && typingConversationId === selectedConversationId)}
                error={messageError}
                onSendText={sendTextMessage}
                onSendAttachment={sendAttachmentMessage}
                isCrmPanelOpen={isDesktopCrmOpen}
                onToggleCrmPanel={() => setIsDesktopCrmOpen((current) => !current)}
                onToggleConversationStatus={toggleSelectedConversationStatus}
                onDeleteConversation={deleteSelectedConversation}
                onRetryOutboundMessage={retryOutboundMessage}
                onLoadOlderMessages={loadOlderMessages}
                onSelectProofMessage={(messageId) => {
                  setSelectedProofMessageId(messageId);
                  setProofFeedback(null);
                  setIsProofShortcutModalOpen(true);
                }}
                onReplyPrivatelyFromMessage={handleReplyPrivatelyFromMessage}
                onForwardMessageToTarget={handleForwardMessageToTarget}
                onCreateNoteFromMessage={handleCreateNoteFromMessage}
                onUnselectConversation={() => {
                  clearSelectedConversation();
                }}
              />
            </div>

            {isCrmVisible ? (
              <div data-panel="crm-panel" className="inbox-scroll relative hidden h-full min-h-0 max-h-full overflow-y-auto overscroll-contain lg:block">
                <button
                  type="button"
                  className="absolute -left-1 top-0 z-10 h-full w-2 cursor-col-resize rounded-full bg-transparent"
                  aria-label="Resize CRM panel"
                  onMouseDown={(event) => {
                    resizeOriginRef.current = { startX: event.clientX, startWidth: crmPanelWidth };
                    setIsResizingCrm(true);
                  }}
                />
                <div className="flex h-full min-h-0 max-h-full flex-col overflow-hidden">
                  <div className="inbox-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain">
                  <CrmContextPanel
                    conversation={selectedConversation}
                    messages={messages}
                    activeOrgRole={activeOrgRole}
                    isLoading={isLoadingConversation}
                    isAssigning={isAssigning}
                    assignError={assignError}
                    invoices={crmInvoices}
                    activity={crmActivity}
                    isLoadingCrm={isLoadingCrm}
                    crmError={crmError}
                    onOpenInvoiceDrawer={openInvoiceDrawer}
                    onSendInvoice={sendInvoiceFromPanel}
                    onMarkInvoicePaid={markInvoicePaidFromPanel}
                    onRefreshConversation={async () => {
                      if (selectedConversationId) {
                        await loadConversation(selectedConversationId);
                        await loadConversations({ background: true });
                      }
                    }}
                    isSendingInvoice={isSendingInvoice}
                    isMarkingInvoicePaid={isMarkingInvoicePaid}
                    invoiceActionError={invoiceActionError}
                    invoiceActionSuccess={invoiceActionSuccess}
                    onUnselectConversation={clearSelectedConversation}
                    onDeleteConversation={deleteSelectedConversation}
                  />
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <MobileCrmOverlay
            open={isMobileCrmOpen}
            onClose={() => setIsMobileCrmOpen(false)}
            conversation={selectedConversation}
            messages={messages}
            activeOrgRole={activeOrgRole}
            isLoadingConversation={isLoadingConversation}
            isAssigning={isAssigning}
            assignError={assignError}
            invoices={crmInvoices}
            activity={crmActivity}
            isLoadingCrm={isLoadingCrm}
            crmError={crmError}
            onOpenInvoiceDrawer={openInvoiceDrawer}
            onSendInvoice={sendInvoiceFromPanel}
            onMarkInvoicePaid={markInvoicePaidFromPanel}
            onRefreshConversation={async () => {
              if (selectedConversationId) {
                await loadConversation(selectedConversationId);
                await loadConversations({ background: true });
              }
            }}
            isSendingInvoice={isSendingInvoice}
            isMarkingInvoicePaid={isMarkingInvoicePaid}
            invoiceActionError={invoiceActionError}
            invoiceActionSuccess={invoiceActionSuccess}
          />
        </div>
      ) : null}

      <QuickReplyModal
        open={isQuickReplyModalOpen}
        onClose={() => setIsQuickReplyModalOpen(false)}
        onPick={sendQuickReply}
      />

      <ShortcutHelpModal
        open={isShortcutHelpOpen}
        onClose={() => setIsShortcutHelpOpen(false)}
      />

      <AttachProofShortcutModal
        open={isProofShortcutModalOpen}
        isSubmitting={isAttachingProof}
        invoices={crmInvoices}
        onClose={() => setIsProofShortcutModalOpen(false)}
        onSubmit={async (invoiceId, milestoneType) => {
          await attachSelectedMessageAsProof(invoiceId, milestoneType);
          setIsProofShortcutModalOpen(false);
        }}
      />

      <InvoiceDrawer
        open={isInvoiceDrawerOpen}
        customerId={selectedConversation?.customerId ?? null}
        conversationId={selectedConversation?.id ?? null}
        orgId={selectedConversation?.orgId ?? orgId}
        customerDisplayName={selectedConversation?.customerDisplayName ?? null}
        customerPhoneE164={selectedConversation?.customerPhoneE164 ?? null}
        onClose={() => setIsInvoiceDrawerOpen(false)}
      />
    </section>
  );
}
