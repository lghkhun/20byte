"use client";

import { useEffect, useState } from "react";

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
import { Minimize2, PanelRightClose, PanelRightOpen } from "lucide-react";

export function InboxWorkspace() {
  const { density, isCrmPanelVisible, isFocusMode, setIsFocusMode } = useInboxWorkspacePreferences();
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
    sendAttachmentMessage,
    sendTemplateMessage,
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
    selectedProofMessageId,
    isAttachingProof,
    proofFeedback,
    attachSelectedMessageAsProof,
    openInvoiceDrawer,
    assignSelectedConversationToMe,
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

  const gridLayoutClass = "grid gap-4 lg:grid-cols-[380px_minmax(0,1fr)] 2xl:grid-cols-[380px_minmax(0,1fr)_auto]";

  return (
    <section className="min-h-[calc(100vh-6.75rem)] rounded-3xl border border-border/70 bg-gradient-to-br from-background via-background to-accent/20 p-2 shadow-lg shadow-black/5">
      {!orgId ? (
        <EmptyStatePanel
          title="No Organization Found"
          message="Create an organization first to access inbox modules."
        />
      ) : null}

      {orgId && error && !isLoadingList ? (
        <ErrorStatePanel title="Inbox Load Error" message={error} />
      ) : null}

      {orgId ? (
        isFocusMode ? (
          <div className="grid gap-4">
            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={() => setIsFocusMode(false)}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-card/80 px-3 text-xs font-medium text-foreground hover:bg-accent"
                title="Exit focus mode (Ctrl+Shift+F)"
              >
                <Minimize2 className="h-4 w-4" />
                Exit Focus
              </button>
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
              onSendTemplate={sendTemplateMessage}
              onToggleConversationStatus={toggleSelectedConversationStatus}
              onRetryOutboundMessage={retryOutboundMessage}
              onSelectProofMessage={(messageId) => {
                setSelectedProofMessageId(messageId);
                setProofFeedback(null);
              }}
            />
          </div>
        ) : (
        <div>
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

          <div className={gridLayoutClass}>
            <div
              className={`h-[calc(100vh-6.75rem)] overflow-hidden rounded-2xl border border-border/80 bg-card/90 shadow-sm ${
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
              />
            </div>

            <div className={`${mobilePane === "list" ? "hidden lg:block" : ""} ${mobilePane === "chat" ? "inbox-fade-slide" : ""}`}>
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
                onSendTemplate={sendTemplateMessage}
                onToggleConversationStatus={toggleSelectedConversationStatus}
                onRetryOutboundMessage={retryOutboundMessage}
                onSelectProofMessage={(messageId) => {
                  setSelectedProofMessageId(messageId);
                  setProofFeedback(null);
                }}
              />
            </div>

            <div
              className={`hidden h-[calc(100vh-6.75rem)] overflow-hidden transition-all duration-300 ease-out 2xl:block ${
                isCrmPanelVisible ? "w-[360px] opacity-100" : "w-0 opacity-0"
              }`}
              aria-hidden={!isCrmPanelVisible}
            >
              <div
                className={`inbox-scroll h-full overflow-auto rounded-2xl border border-border/80 bg-card/85 p-4 shadow-sm transition-all duration-300 ${
                  isCrmPanelVisible ? "translate-x-0" : "translate-x-4"
                }`}
              >
                <CrmContextPanel
                  conversation={selectedConversation}
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
                  selectedProofMessageId={selectedProofMessageId}
                  isAttachingProof={isAttachingProof}
                  proofFeedback={proofFeedback}
                  onAttachProof={attachSelectedMessageAsProof}
                  onOpenInvoiceDrawer={openInvoiceDrawer}
                  onAssignToMe={() => {
                    void assignSelectedConversationToMe();
                  }}
                  onSendInvoice={sendInvoiceFromPanel}
                  onMarkInvoicePaid={markInvoicePaidFromPanel}
                  isSendingInvoice={isSendingInvoice}
                  isMarkingInvoicePaid={isMarkingInvoicePaid}
                  invoiceActionError={invoiceActionError}
                  invoiceActionSuccess={invoiceActionSuccess}
                />
              </div>
            </div>
          </div>

          <MobileCrmOverlay
            open={isMobileCrmOpen}
            onClose={() => setIsMobileCrmOpen(false)}
            conversation={selectedConversation}
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
            selectedProofMessageId={selectedProofMessageId}
            isAttachingProof={isAttachingProof}
            proofFeedback={proofFeedback}
            onAttachProof={attachSelectedMessageAsProof}
            onOpenInvoiceDrawer={openInvoiceDrawer}
            onAssignToMe={() => {
              void assignSelectedConversationToMe();
            }}
            onSendInvoice={sendInvoiceFromPanel}
            onMarkInvoicePaid={markInvoicePaidFromPanel}
            isSendingInvoice={isSendingInvoice}
            isMarkingInvoicePaid={isMarkingInvoicePaid}
            invoiceActionError={invoiceActionError}
            invoiceActionSuccess={invoiceActionSuccess}
          />
        </div>
        )
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
        orgId={orgId}
        customerId={selectedConversation?.customerId ?? null}
        conversationId={selectedConversation?.id ?? null}
        onClose={() => setIsInvoiceDrawerOpen(false)}
      />
    </section>
  );
}
