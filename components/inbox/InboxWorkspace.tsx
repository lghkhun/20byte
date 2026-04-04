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
    setSelectedConversationId,
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
    conversations,
    setSelectedConversationId,
    loadConversation
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

  const isCrmVisible = isDesktopCrmOpen && Boolean(selectedConversationId);
  const gridLayoutClass = isCrmVisible
    ? "grid h-full min-h-0 gap-2 lg:gap-3 lg:grid-cols-[var(--inbox-list-panel-width,340px)_minmax(0,1fr)_minmax(260px,var(--crm-panel-width))]"
    : "grid h-full min-h-0 gap-2 lg:gap-3 lg:grid-cols-[var(--inbox-list-panel-width,340px)_minmax(0,1fr)]";

  const realtimeBanner =
    realtimeConnectionState === "connected"
      ? null
      : realtimeConnectionState === "fallback"
        ? {
            text: "Realtime terputus, saat ini memakai fallback polling.",
            className: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
          }
        : realtimeConnectionState === "connecting" || realtimeConnectionState === "initialized"
          ? {
              text: "Menyambungkan realtime inbox...",
              className: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300"
            }
          : {
              text: "Koneksi realtime bermasalah, mencoba reconnect otomatis.",
              className: "border-destructive/30 bg-destructive/10 text-destructive"
            };

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
          {realtimeBanner ? (
            <div className={`mb-2 rounded-xl border px-3 py-2 text-sm ${realtimeBanner.className}`}>{realtimeBanner.text}</div>
          ) : null}

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
