"use client";

import { useEffect, useRef, useState } from "react";

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
  const { density } = useInboxWorkspacePreferences();
  const {
    orgId,
    error,
    isLoadingList,
    conversations,
    selectedConversationId,
    setSelectedConversationId,
    filter,
    statusFilter,
    setFilter,
    setStatusFilter,
    loadConversation,
    loadConversations,
    selectedConversation,
    isUpdatingConversationStatus,
    messages,
    isLoadingMessages,
    messageError,
    sendTextMessage,
    createConversation,
    sendAttachmentMessage,
    toggleSelectedConversationStatus,
    retryOutboundMessage,
    setSelectedProofMessageId,
    setProofFeedback,
    activeOrgRole,
    isLoadingConversation,
    isAssigning,
    assignError,
    tags,
    notes,
    crmInvoices,
    crmActivity,
    isLoadingCrm,
    crmError,
    createTagForCustomer,
    assignTagForCustomer,
    createCustomerNoteEntry,
    updateCustomerNoteEntry,
    deleteCustomerNoteEntry,
    selectedProofMessageId,
    isAttachingProof,
    proofFeedback,
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
    setIsInvoiceDrawerOpen
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
  const [crmPanelWidth, setCrmPanelWidth] = useState(340);
  const [isResizingCrm, setIsResizingCrm] = useState(false);
  const resizeOriginRef = useRef<{ startX: number; startWidth: number } | null>(null);
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
        setCrmPanelWidth(Math.min(520, Math.max(300, nextWidth)));
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
      const nextWidth = Math.min(520, Math.max(300, resizeOriginRef.current.startWidth + delta));
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

  const gridLayoutClass = isDesktopCrmOpen
    ? "grid h-full min-h-0 gap-3 lg:grid-cols-[340px_minmax(0,1fr)_minmax(300px,var(--crm-panel-width))]"
    : "grid h-full min-h-0 gap-3 lg:grid-cols-[340px_minmax(0,1fr)]";

  return (
    <section className="flex h-full min-h-0 flex-1 overflow-hidden">
      {!orgId ? (
        <EmptyStatePanel
          title="No Business Found"
          message="No business is linked to this account yet."
        />
      ) : null}

      {orgId && error && !isLoadingList ? (
        <ErrorStatePanel title="Inbox Load Error" message={error} />
      ) : null}

      {orgId ? (
        <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
          <div className="mb-3 flex items-center gap-2 rounded-xl border border-border/80 bg-card/85 p-1.5 shadow-sm lg:hidden">
            <Button
              type="button"
              variant={mobilePane === "list" ? "secondary" : "ghost"}
              size="sm"
              className="h-8 flex-1 rounded-lg"
              onClick={() => setMobilePane("list")}
            >
              Conversations
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
              className={`flex h-full min-h-0 max-h-full flex-col overflow-hidden rounded-[24px] border border-border/70 bg-card/95 shadow-sm shadow-black/5 ${
                mobilePane === "chat" ? "hidden lg:block" : ""
              } ${mobilePane === "list" ? "inbox-fade-slide" : ""}`}
            >
              <ConversationListPanel
                density={density}
                conversations={conversations}
                selectedConversationId={selectedConversationId}
                filter={filter}
                status={statusFilter}
                isLoading={isLoadingList}
                error={error}
                onFilterChange={(nextFilter) => setFilter(nextFilter)}
                onStatusChange={(nextStatus) => setStatusFilter(nextStatus)}
                onSelectConversation={(conversationId) => {
                  setSelectedConversationId(conversationId);
                  setMobilePane("chat");
                  void loadConversation(conversationId);
                }}
                onRefresh={() => {
                  void loadConversations();
                }}
                onCreateConversation={createConversation}
              />
            </div>

            <div className={`min-h-0 min-w-0 max-h-full overflow-hidden ${mobilePane === "list" ? "hidden lg:block" : ""} ${mobilePane === "chat" ? "inbox-fade-slide" : ""}`}>
              <div className="mb-2 flex items-center justify-between gap-2 lg:hidden">
                <Button type="button" variant="ghost" size="sm" className="h-8" onClick={() => setMobilePane("list")}>
                  Back to conversations
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
                isConversationSelected={Boolean(selectedConversationId)}
                error={messageError}
                onSendText={sendTextMessage}
                onSendAttachment={sendAttachmentMessage}
                isCrmPanelOpen={isDesktopCrmOpen}
                onToggleCrmPanel={() => setIsDesktopCrmOpen((current) => !current)}
                onToggleConversationStatus={toggleSelectedConversationStatus}
                onRetryOutboundMessage={retryOutboundMessage}
                onSelectProofMessage={(messageId) => {
                  setSelectedProofMessageId(messageId);
                  setProofFeedback(null);
                }}
              />
            </div>

            {isDesktopCrmOpen ? (
              <div data-panel="crm-panel" className="relative hidden h-full min-h-0 max-h-full overflow-hidden lg:block">
                <button
                  type="button"
                  className="absolute -left-1 top-0 z-10 h-full w-2 cursor-col-resize rounded-full bg-transparent"
                  aria-label="Resize CRM panel"
                  onMouseDown={(event) => {
                    resizeOriginRef.current = { startX: event.clientX, startWidth: crmPanelWidth };
                    setIsResizingCrm(true);
                  }}
                />
                <div className="flex h-full min-h-0 max-h-full flex-col overflow-hidden rounded-[24px] border border-border/70 bg-card/95 p-3 shadow-sm shadow-black/5">
                  <div className="inbox-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
                  <CrmContextPanel
                    conversation={selectedConversation}
                    messages={messages}
                    activeOrgRole={activeOrgRole}
                    isLoading={isLoadingConversation}
                    isAssigning={isAssigning}
                    assignError={assignError}
                    tags={tags}
                    notes={notes}
                    invoices={crmInvoices}
                    activity={crmActivity}
                    isLoadingCrm={isLoadingCrm}
                    crmError={crmError}
                    onCreateTag={createTagForCustomer}
                    onAssignTag={assignTagForCustomer}
                    onCreateNote={createCustomerNoteEntry}
                    onUpdateNote={updateCustomerNoteEntry}
                    onDeleteNote={deleteCustomerNoteEntry}
                    selectedProofMessageId={selectedProofMessageId}
                    isAttachingProof={isAttachingProof}
                    proofFeedback={proofFeedback}
                    onAttachProof={attachSelectedMessageAsProof}
                    onOpenInvoiceDrawer={openInvoiceDrawer}
                    onSendInvoice={sendInvoiceFromPanel}
                    onMarkInvoicePaid={markInvoicePaidFromPanel}
                    onRefreshConversation={async () => {
                      if (selectedConversationId) {
                        await loadConversation(selectedConversationId);
                        await loadConversations();
                      }
                    }}
                    isSendingInvoice={isSendingInvoice}
                    isMarkingInvoicePaid={isMarkingInvoicePaid}
                    invoiceActionError={invoiceActionError}
                    invoiceActionSuccess={invoiceActionSuccess}
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
            tags={tags}
            notes={notes}
            invoices={crmInvoices}
            activity={crmActivity}
            isLoadingCrm={isLoadingCrm}
            crmError={crmError}
            onCreateTag={createTagForCustomer}
            onAssignTag={assignTagForCustomer}
            onCreateNote={createCustomerNoteEntry}
            onUpdateNote={updateCustomerNoteEntry}
            onDeleteNote={deleteCustomerNoteEntry}
            selectedProofMessageId={selectedProofMessageId}
            isAttachingProof={isAttachingProof}
            proofFeedback={proofFeedback}
            onAttachProof={attachSelectedMessageAsProof}
            onOpenInvoiceDrawer={openInvoiceDrawer}
            onSendInvoice={sendInvoiceFromPanel}
            onMarkInvoicePaid={markInvoicePaidFromPanel}
            onRefreshConversation={async () => {
              if (selectedConversationId) {
                await loadConversation(selectedConversationId);
                await loadConversations();
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
