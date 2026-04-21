"use client";

import { useRef } from "react";

import { CrmContextPanel } from "@/components/inbox/CrmContextPanel";
import type { CrmActivityItem, CrmInvoiceItem } from "@/components/inbox/crm/types";
import type { ConversationItem, MessageItem } from "@/components/inbox/types";
import { useModalAccessibility } from "@/lib/a11y/useModalAccessibility";

type MobileCrmOverlayProps = {
  open: boolean;
  onClose: () => void;
  conversation: ConversationItem | null;
  messages: MessageItem[];
  activeOrgRole: string | null;
  isLoadingConversation: boolean;
  isAssigning: boolean;
  assignError: string | null;
  invoices: CrmInvoiceItem[];
  activity: CrmActivityItem[];
  isLoadingCrm: boolean;
  crmError: string | null;
  onOpenInvoiceDrawer: () => void;
  onSendInvoice: (invoiceId: string) => Promise<void>;
  onMarkInvoicePaid: (invoiceId: string, milestoneType?: "FULL" | "DP" | "FINAL") => Promise<void>;
  onRefreshConversation: () => Promise<void>;
  isSendingInvoice: boolean;
  isMarkingInvoicePaid: boolean;
  invoiceActionError: string | null;
  invoiceActionSuccess: string | null;
};

export function MobileCrmOverlay(props: MobileCrmOverlayProps) {
  const {
    open,
    onClose,
    conversation,
    messages,
    activeOrgRole,
    isLoadingConversation,
    isAssigning,
    assignError,
    invoices,
    activity,
    isLoadingCrm,
    crmError,
    onOpenInvoiceDrawer,
    onSendInvoice,
    onMarkInvoicePaid,
    onRefreshConversation,
    isSendingInvoice,
    isMarkingInvoicePaid,
    invoiceActionError,
    invoiceActionSuccess
  } = props;

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  useModalAccessibility({
    open,
    onClose,
    containerRef: scrollRef,
    initialFocusRef: closeButtonRef
  });

  if (!open) {
    return null;
  }

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-40 2xl:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="CRM context panel"
    >
      {/* Dimmed background — tap to close */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* Bottom sheet */}
      <div className="absolute inset-x-0 bottom-0 flex max-h-[88dvh] flex-col overflow-hidden rounded-t-[28px] border-t border-border/60 bg-background shadow-2xl dark:bg-zinc-900">
        {/* Drag handle */}
        <div className="flex shrink-0 justify-center pb-1 pt-3">
          <div className="h-1 w-10 rounded-full bg-border/70" />
        </div>

        {/* Header */}
        <div className="flex shrink-0 items-center justify-between px-5 pb-3">
          <div>
            <h3 className="text-[15px] font-bold text-foreground">CRM</h3>
            {conversation?.customerDisplayName ? (
              <p className="max-w-[200px] truncate text-[12px] text-muted-foreground">
                {conversation.customerDisplayName}
              </p>
            ) : null}
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-muted/60 text-muted-foreground transition hover:bg-muted hover:text-foreground active:scale-95"
            aria-label="Tutup panel CRM"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Divider */}
        <div className="h-px shrink-0 bg-border/50" />

        {/* Scrollable content — no anchor tabs, just scroll freely */}
        <div
          ref={scrollRef}
          className="inbox-scroll flex-1 overflow-y-auto overscroll-contain"
        >
          <CrmContextPanel
            conversation={conversation}
            messages={messages}
            activeOrgRole={activeOrgRole}
            isLoading={isLoadingConversation}
            isAssigning={isAssigning}
            assignError={assignError}
            invoices={invoices}
            activity={activity}
            isLoadingCrm={isLoadingCrm}
            crmError={crmError}
            onOpenInvoiceDrawer={onOpenInvoiceDrawer}
            onSendInvoice={onSendInvoice}
            onMarkInvoicePaid={onMarkInvoicePaid}
            onRefreshConversation={onRefreshConversation}
            isSendingInvoice={isSendingInvoice}
            isMarkingInvoicePaid={isMarkingInvoicePaid}
            invoiceActionError={invoiceActionError}
            invoiceActionSuccess={invoiceActionSuccess}
          />
          {/* Bottom spacer for comfortable scrolling above nav bar */}
          <div className="h-10 w-full" />
        </div>
      </div>
    </div>
  );
}
