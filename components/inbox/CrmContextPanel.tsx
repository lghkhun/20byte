"use client";

import { type FormEvent, useMemo, useState } from "react";

import { ActivityTimelineSection } from "@/components/inbox/crm/ActivityTimelineSection";
import { InvoicesSection } from "@/components/inbox/crm/InvoicesSection";
import type { CrmActivityItem, CrmInvoiceItem, CrmTimelineItem } from "@/components/inbox/crm/types";
import type { ConversationItem } from "@/components/inbox/types";

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

type CrmContextPanelProps = {
  conversation: ConversationItem | null;
  activeOrgRole: string | null;
  isLoading: boolean;
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
  selectedProofMessageId: string | null;
  isAttachingProof: boolean;
  proofFeedback: string | null;
  onAttachProof: (invoiceId: string, milestoneType?: "FULL" | "DP" | "FINAL") => Promise<void>;
  onOpenInvoiceDrawer: () => void;
  onAssignToMe: () => void;
  onSendInvoice: (invoiceId: string) => Promise<void>;
  onMarkInvoicePaid: (invoiceId: string, milestoneType?: "FULL" | "DP" | "FINAL") => Promise<void>;
  isSendingInvoice: boolean;
  isMarkingInvoicePaid: boolean;
  invoiceActionError: string | null;
  invoiceActionSuccess: string | null;
};

function formatDateTime(value: string | null): string {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

export function CrmContextPanel({
  conversation,
  activeOrgRole,
  isLoading,
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
  selectedProofMessageId,
  isAttachingProof,
  proofFeedback,
  onAttachProof,
  onOpenInvoiceDrawer,
  onAssignToMe,
  onSendInvoice,
  onMarkInvoicePaid,
  isSendingInvoice,
  isMarkingInvoicePaid,
  invoiceActionError,
  invoiceActionSuccess
}: CrmContextPanelProps) {
  const [tagName, setTagName] = useState("");
  const [tagColor, setTagColor] = useState("emerald");
  const [noteContent, setNoteContent] = useState("");
  const [isSubmittingTag, setIsSubmittingTag] = useState(false);
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);
  const [proofInvoiceId, setProofInvoiceId] = useState("");
  const [proofMilestoneType, setProofMilestoneType] = useState<"" | "FULL" | "DP" | "FINAL">("");
  const canOperateInvoice = activeOrgRole === "OWNER" || activeOrgRole === "ADMIN" || activeOrgRole === "CS";

  async function handleCreateTag(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = tagName.trim();
    if (!name || isSubmittingTag) {
      return;
    }

    setIsSubmittingTag(true);
    try {
      await onCreateTag(name, tagColor.trim() || "emerald");
      setTagName("");
    } finally {
      setIsSubmittingTag(false);
    }
  }

  async function handleCreateNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = noteContent.trim();
    if (!content || isSubmittingNote) {
      return;
    }

    setIsSubmittingNote(true);
    try {
      await onCreateNote(content);
      setNoteContent("");
    } finally {
      setIsSubmittingNote(false);
    }
  }

  const timelineItems = useMemo(() => {
    if (!conversation) {
      return [] as CrmTimelineItem[];
    }

    const items: CrmTimelineItem[] = [];
    items.push({
      id: `assignment-${conversation.id}`,
      label: conversation.assignedToMemberId ? "Conversation assigned" : "Conversation unassigned",
      time: conversation.updatedAt
    });

    if (conversation.lastMessageAt) {
      items.push({
        id: `message-${conversation.id}`,
        label: "Latest message activity",
        time: conversation.lastMessageAt
      });
    }

    for (const note of notes) {
      items.push({
        id: `note-${note.id}`,
        label: "Customer note added",
        time: note.createdAt
      });
    }

    for (const event of activity) {
      items.push({
        id: `crm-${event.id}`,
        label: event.label,
        time: event.time
      });
    }

    return items.sort((a, b) => {
      const left = a.time ? new Date(a.time).getTime() : 0;
      const right = b.time ? new Date(b.time).getTime() : 0;
      return right - left;
    });
  }, [activity, conversation, notes]);

  if (isLoading) {
    return (
      <aside className="rounded-2xl border border-border/80 bg-card/85 p-4 shadow-sm">
        <p className="text-sm text-muted-foreground">Loading CRM context...</p>
      </aside>
    );
  }

  if (!conversation) {
    return (
      <aside className="rounded-2xl border border-border/80 bg-card/85 p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-foreground">CRM Context</h2>
        <p className="mt-2 text-sm text-muted-foreground">Select a conversation to view customer profile.</p>
      </aside>
    );
  }

  return (
    <aside className="space-y-3 rounded-2xl border border-border/80 bg-card/85 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">CRM Context</h2>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Customer details, invoice actions, and activity</p>
        </div>
        <span
          className={
            conversation.status === "OPEN"
              ? "rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-500"
              : "rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-500"
          }
        >
          {conversation.status}
        </span>
      </div>

      <section id="crm-profile" className="rounded-xl border border-border/80 bg-background/50 p-3.5">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Customer Profile</p>
        <p className="mt-2 text-sm font-medium text-foreground">
          {conversation.customerDisplayName ?? "Unknown Customer"}
        </p>
        <p className="text-sm text-muted-foreground">{conversation.customerPhoneE164}</p>
        <div className="mt-3 space-y-1 text-xs text-muted-foreground">
          <p>Unread: {conversation.unreadCount}</p>
          <p>Last Activity: {formatDateTime(conversation.lastMessageAt)}</p>
          <p>Assigned Member: {conversation.assignedToMemberId ?? "Unassigned"}</p>
        </div>
      </section>

      <section id="crm-assignment" className="rounded-xl border border-border/80 bg-background/50 p-3.5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Assignment</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onOpenInvoiceDrawer}
              className="rounded-md border border-primary/40 bg-primary/10 px-2 py-1 text-xs font-medium text-primary transition hover:bg-primary/15"
            >
              Create Invoice
            </button>
            <button
              type="button"
              onClick={onAssignToMe}
              disabled={isAssigning}
              className="rounded-md border border-border px-2 py-1 text-xs text-foreground transition hover:bg-accent disabled:opacity-50"
            >
              {isAssigning ? "Assigning..." : "Assign to me"}
            </button>
          </div>
        </div>
        {assignError ? <p className="mt-2 text-xs text-destructive">{assignError}</p> : null}
      </section>

      <section id="crm-proof" className="rounded-xl border border-border/80 bg-background/50 p-3.5">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Attach Payment Proof</p>
        <p className="mt-2 text-xs text-muted-foreground">
          Selected message: {selectedProofMessageId ?? "None (use \"Use as payment proof\" in chat bubble)"}
        </p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <input
            value={proofInvoiceId}
            onChange={(event) => setProofInvoiceId(event.target.value)}
            placeholder="Invoice ID"
            className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
          />
          <select
            value={proofMilestoneType}
            onChange={(event) => setProofMilestoneType(event.target.value as "" | "FULL" | "DP" | "FINAL")}
            className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
          >
            <option value="">No milestone</option>
            <option value="FULL">FULL</option>
            <option value="DP">DP</option>
            <option value="FINAL">FINAL</option>
          </select>
        </div>
        <button
          type="button"
          disabled={isAttachingProof || !selectedProofMessageId || !proofInvoiceId.trim()}
          onClick={() => {
            void onAttachProof(proofInvoiceId.trim(), proofMilestoneType || undefined);
          }}
          className="mt-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-600 transition hover:bg-emerald-500/15 disabled:opacity-50 dark:text-emerald-400"
        >
          {isAttachingProof ? "Attaching..." : "Attach proof"}
        </button>
        {proofFeedback ? <p className="mt-2 text-xs text-muted-foreground">{proofFeedback}</p> : null}
      </section>

      <section id="crm-tags" className="rounded-xl border border-border/80 bg-background/50 p-3.5">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Tags</p>
        <form className="mt-2 flex gap-2" onSubmit={handleCreateTag}>
          <input
            value={tagName}
            onChange={(event) => setTagName(event.target.value)}
            placeholder="New tag"
            className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
          />
          <input
            value={tagColor}
            onChange={(event) => setTagColor(event.target.value)}
            placeholder="Color"
            className="w-24 rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
          />
          <button
            type="submit"
            disabled={isSubmittingTag}
            className="rounded-md border border-border px-2 py-1 text-xs text-foreground transition hover:bg-accent disabled:opacity-50"
          >
            {isSubmittingTag ? "..." : "Add"}
          </button>
        </form>
        {isLoadingCrm ? <p className="mt-2 text-xs text-muted-foreground">Loading tags...</p> : null}
        {!isLoadingCrm && tags.length === 0 ? <p className="mt-2 text-xs text-muted-foreground">No tags yet.</p> : null}
        {!isLoadingCrm && tags.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {tags.map((tag) => (
              <button
                key={tag.id}
                type="button"
                onClick={() => {
                  void onAssignTag(tag.id);
                }}
                disabled={tag.isAssigned}
                className={
                  tag.isAssigned
                    ? "rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-500"
                    : "rounded-full border border-border px-2 py-1 text-[11px] text-foreground transition hover:bg-accent"
                }
              >
                {tag.name}
              </button>
            ))}
          </div>
        ) : null}
      </section>

      <section id="crm-notes" className="rounded-xl border border-border/80 bg-background/50 p-3.5">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Notes</p>
        <form className="mt-2 flex gap-2" onSubmit={handleCreateNote}>
          <input
            value={noteContent}
            onChange={(event) => setNoteContent(event.target.value)}
            placeholder="Add a note..."
            className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
          />
          <button
            type="submit"
            disabled={isSubmittingNote}
            className="rounded-md border border-border px-2 py-1 text-xs text-foreground transition hover:bg-accent disabled:opacity-50"
          >
            {isSubmittingNote ? "..." : "Save"}
          </button>
        </form>
        {isLoadingCrm ? <p className="mt-2 text-xs text-muted-foreground">Loading notes...</p> : null}
        {!isLoadingCrm && notes.length === 0 ? <p className="mt-2 text-xs text-muted-foreground">No notes yet.</p> : null}
        {!isLoadingCrm && notes.length > 0 ? (
          <div className="mt-2 space-y-2">
            {notes.map((note) => (
              <article key={note.id} className="rounded-lg border border-border/80 bg-background/70 p-2">
                <p className="text-xs text-foreground">{note.content}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">{formatDateTime(note.createdAt)}</p>
              </article>
            ))}
          </div>
        ) : null}
        {crmError ? <p className="mt-2 text-xs text-destructive">{crmError}</p> : null}
      </section>

      <div id="crm-invoices">
        <InvoicesSection
          invoices={invoices}
          isLoadingCrm={isLoadingCrm}
          isSendingInvoice={isSendingInvoice}
          isMarkingInvoicePaid={isMarkingInvoicePaid}
          canOperateInvoice={canOperateInvoice}
          activeOrgRole={activeOrgRole}
          invoiceActionError={invoiceActionError}
          invoiceActionSuccess={invoiceActionSuccess}
          onSendInvoice={onSendInvoice}
          onMarkInvoicePaid={onMarkInvoicePaid}
          formatDateTime={formatDateTime}
        />
      </div>

      <div id="crm-timeline">
        <ActivityTimelineSection timelineItems={timelineItems} formatDateTime={formatDateTime} />
      </div>
    </aside>
  );
}
