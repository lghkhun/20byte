"use client";

import { useRef } from "react";

import { CrmContextPanel } from "@/components/inbox/CrmContextPanel";
import type { CrmActivityItem, CrmInvoiceItem } from "@/components/inbox/crm/types";
import type { ConversationItem, MessageItem } from "@/components/inbox/types";
import { useModalAccessibility } from "@/lib/a11y/useModalAccessibility";
import { Button } from "@/components/ui/button";

type CustomerTagItem = {
  id: string;
  name: string;
  color: string;
  isAssigned: boolean;
};

type CustomerNoteItem = {
  id: string;
  content: string;
  authorUserId: string;
  createdAt: string;
};

type MobileCrmOverlayProps = {
  open: boolean;
  onClose: () => void;
  conversation: ConversationItem | null;
  messages: MessageItem[];
  activeOrgRole: string | null;
  isLoadingConversation: boolean;
  isAssigning: boolean;
  assignError: string | null;
  tags: CustomerTagItem[];
  notes: CustomerNoteItem[];
  invoices: CrmInvoiceItem[];
  activity: CrmActivityItem[];
  isLoadingCrm: boolean;
  crmError: string | null;
  onCreateTag: (name: string, color: string) => Promise<void>;
  onAssignTag: (tagId: string) => Promise<void>;
  onCreateNote: (content: string) => Promise<void>;
  onUpdateNote: (noteId: string, content: string) => Promise<void>;
  onDeleteNote: (noteId: string) => Promise<void>;
  selectedProofMessageId: string | null;
  isAttachingProof: boolean;
  proofFeedback: string | null;
  onAttachProof: (invoiceId: string, milestoneType?: "FULL" | "DP" | "FINAL") => Promise<void>;
  onOpenInvoiceDrawer: () => void;
  onSendInvoice: (invoiceId: string) => Promise<void>;
  onMarkInvoicePaid: (invoiceId: string, milestoneType?: "FULL" | "DP" | "FINAL") => Promise<void>;
  onRefreshConversation: () => Promise<void>;
  isSendingInvoice: boolean;
  isMarkingInvoicePaid: boolean;
  invoiceActionError: string | null;
  invoiceActionSuccess: string | null;
};

const MOBILE_CRM_ANCHORS = [
  ["Profile", "crm-profile"],
  ["Pipeline", "crm-pipeline"],
  ["Proof", "crm-proof"],
  ["Tags", "crm-tags"],
  ["Notes", "crm-notes"],
  ["Media", "crm-media"],
  ["Invoices", "crm-invoices"],
  ["Timeline", "crm-timeline"]
] as const;

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
    tags,
    notes,
    invoices,
    activity,
    isLoadingCrm,
    crmError,
    onCreateTag,
    onAssignTag,
    onCreateNote,
    onUpdateNote,
    onDeleteNote,
    selectedProofMessageId,
    isAttachingProof,
    proofFeedback,
    onAttachProof,
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

  const scrollToAnchor = (anchorId: string) => {
    const container = scrollRef.current;
    if (!container) return;
    const target = container.querySelector<HTMLElement>(`#${anchorId}`);
    if (!target) return;
    container.scrollTo({ top: Math.max(0, target.offsetTop - 92), behavior: "smooth" });
  };

  return (
    <div className="fixed inset-0 z-40 bg-black/55 p-3 backdrop-blur-sm 2xl:hidden" role="dialog" aria-modal="true" aria-label="CRM context panel">
      <div
        ref={scrollRef}
        className="inbox-scroll inbox-slide-up relative h-full overflow-auto rounded-3xl border border-border/80 bg-card p-4 shadow-xl"
      >
        <div className="sticky top-0 z-[2] -mx-4 -mt-4 space-y-2 border-b border-border bg-card/95 px-4 pb-2 pt-4 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">CRM Context</h3>
            <Button ref={closeButtonRef} type="button" variant="ghost" size="sm" className="h-8" onClick={onClose}>
              Close
            </Button>
          </div>
          <div className="inbox-scroll flex gap-1 overflow-x-auto pb-1">
            {MOBILE_CRM_ANCHORS.map(([label, anchorId]) => (
              <Button
                key={anchorId}
                type="button"
                variant="secondary"
                size="sm"
                className="h-7 shrink-0 rounded-full px-2.5 text-[11px]"
                onClick={() => scrollToAnchor(anchorId)}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>

        <CrmContextPanel
          conversation={conversation}
          messages={messages}
          activeOrgRole={activeOrgRole}
          isLoading={isLoadingConversation}
          isAssigning={isAssigning}
          assignError={assignError}
          tags={tags}
          notes={notes}
          invoices={invoices}
          activity={activity}
          isLoadingCrm={isLoadingCrm}
          crmError={crmError}
          onCreateTag={onCreateTag}
          onAssignTag={onAssignTag}
          onCreateNote={onCreateNote}
          onUpdateNote={onUpdateNote}
          onDeleteNote={onDeleteNote}
          selectedProofMessageId={selectedProofMessageId}
          isAttachingProof={isAttachingProof}
          proofFeedback={proofFeedback}
          onAttachProof={onAttachProof}
          onOpenInvoiceDrawer={onOpenInvoiceDrawer}
          onSendInvoice={onSendInvoice}
          onMarkInvoicePaid={onMarkInvoicePaid}
          onRefreshConversation={onRefreshConversation}
          isSendingInvoice={isSendingInvoice}
          isMarkingInvoicePaid={isMarkingInvoicePaid}
          invoiceActionError={invoiceActionError}
          invoiceActionSuccess={invoiceActionSuccess}
        />
      </div>
    </div>
  );
}
