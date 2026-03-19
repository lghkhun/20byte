"use client";

import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { ChevronDown, FileText, ImageIcon, Link2, NotebookPen, PanelsTopLeft, Workflow } from "lucide-react";

import { ActivityTimelineSection } from "@/components/inbox/crm/ActivityTimelineSection";
import { InvoicesSection } from "@/components/inbox/crm/InvoicesSection";
import type { CrmActivityItem, CrmInvoiceItem, CrmTimelineItem } from "@/components/inbox/crm/types";
import { normalizeRuntimeUrl } from "@/components/inbox/bubble/utils";
import type { ConversationItem, MessageItem } from "@/components/inbox/types";
import { useModalAccessibility } from "@/lib/a11y/useModalAccessibility";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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

type PipelineStage = {
  id: string;
  name: string;
  color: string;
  position: number;
};

type PipelineItem = {
  id: string;
  name: string;
  isDefault: boolean;
  stages: PipelineStage[];
};

type PipelineBoardCard = {
  id: string;
  customerName: string;
  customerPhoneE164: string;
  unreadCount: number;
  lastMessagePreview: string | null;
};

type PipelineBoardColumn = {
  stageId: string;
  stageName: string;
  stageColor: string;
  cardCount: number;
  cards: PipelineBoardCard[];
};

type PipelineBoard = {
  pipeline: PipelineItem;
  columns: PipelineBoardColumn[];
};

type CrmContextPanelProps = {
  conversation: ConversationItem | null;
  messages: MessageItem[];
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

function stageColorClass(color: string): string {
  const map: Record<string, string> = {
    emerald: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700",
    amber: "border-amber-500/30 bg-amber-500/10 text-amber-700",
    sky: "border-sky-500/30 bg-sky-500/10 text-sky-700",
    violet: "border-violet-500/30 bg-violet-500/10 text-violet-700",
    rose: "border-rose-500/30 bg-rose-500/10 text-rose-700",
    slate: "border-slate-500/30 bg-slate-500/10 text-slate-700"
  };
  return map[color] ?? "border-border bg-muted/40 text-foreground";
}

function AccordionCard({
  id,
  title,
  icon: Icon,
  defaultOpen = true,
  children,
  action
}: {
  id: string;
  title: string;
  icon: typeof Workflow;
  defaultOpen?: boolean;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <details id={id} className="group rounded-[20px] border border-border/80 bg-card/95 shadow-sm" open={defaultOpen}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted/70 text-muted-foreground">
            <Icon className="h-4 w-4" />
          </div>
          <p className="text-sm font-semibold text-foreground">{title}</p>
        </div>
        <div className="flex items-center gap-2">
          {action}
          <ChevronDown className="h-4 w-4 text-muted-foreground transition group-open:rotate-180" />
        </div>
      </summary>
      <div className="border-t border-border/70 px-4 py-4">{children}</div>
    </details>
  );
}

export function CrmContextPanel({
  conversation,
  messages,
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
}: CrmContextPanelProps) {
  const [tagName, setTagName] = useState("");
  const [tagColor, setTagColor] = useState("emerald");
  const [noteContent, setNoteContent] = useState("");
  const [proofInvoiceId, setProofInvoiceId] = useState("");
  const [proofMilestoneType, setProofMilestoneType] = useState<"" | "FULL" | "DP" | "FINAL">("");
  const [isSubmittingTag, setIsSubmittingTag] = useState(false);
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [assignMembers, setAssignMembers] = useState<Array<{ userId: string; name: string | null; email: string; role: string }>>([]);
  const [selectedAssignee, setSelectedAssignee] = useState("");
  const [isSavingAssignment, setIsSavingAssignment] = useState(false);
  const [assignModalError, setAssignModalError] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState<CustomerNoteItem | null>(null);
  const [editingNoteContent, setEditingNoteContent] = useState("");
  const [isSavingEditedNote, setIsSavingEditedNote] = useState(false);
  const [pipelines, setPipelines] = useState<PipelineItem[]>([]);
  const [isLoadingPipelines, setIsLoadingPipelines] = useState(false);
  const [pipelineError, setPipelineError] = useState<string | null>(null);
  const [selectedPipelineId, setSelectedPipelineId] = useState("");
  const [selectedStageId, setSelectedStageId] = useState("");
  const [isSavingPipeline, setIsSavingPipeline] = useState(false);
  const [pipelineBoard, setPipelineBoard] = useState<PipelineBoard | null>(null);
  const [isLoadingPipelineBoard, setIsLoadingPipelineBoard] = useState(false);
  const [movingStageId, setMovingStageId] = useState<string | null>(null);
  const assignModalContainerRef = useRef<HTMLDivElement | null>(null);
  const assignModalCloseButtonRef = useRef<HTMLButtonElement | null>(null);
  const editNoteModalContainerRef = useRef<HTMLDivElement | null>(null);
  const editNoteModalCloseButtonRef = useRef<HTMLButtonElement | null>(null);

  useModalAccessibility({
    open: isAssignModalOpen,
    onClose: () => setIsAssignModalOpen(false),
    containerRef: assignModalContainerRef,
    initialFocusRef: assignModalCloseButtonRef
  });

  useModalAccessibility({
    open: Boolean(editingNote),
    onClose: () => setEditingNote(null),
    containerRef: editNoteModalContainerRef,
    initialFocusRef: editNoteModalCloseButtonRef
  });
  const canOperateInvoice = activeOrgRole === "OWNER" || activeOrgRole === "ADMIN" || activeOrgRole === "CS";
  const labelColorPresets = ["emerald", "amber", "sky", "violet", "rose", "slate"];

  useEffect(() => {
    let ignore = false;

    async function loadPipelines() {
      if (!conversation) {
        setPipelines([]);
        return;
      }

      setIsLoadingPipelines(true);
      setPipelineError(null);
      try {
        const response = await fetch("/api/crm/pipelines", { cache: "no-store" });
        const payload = (await response.json().catch(() => null)) as { data?: { pipelines?: PipelineItem[] }; error?: { message?: string } } | null;
        if (!response.ok) {
          if (!ignore) {
            setPipelineError(payload?.error?.message ?? "Failed to load CRM pipelines.");
          }
          return;
        }

        if (!ignore) {
          const nextPipelines = payload?.data?.pipelines ?? [];
          setPipelines(nextPipelines);
          const activePipelineId = conversation.crmPipelineId ?? nextPipelines.find((item) => item.isDefault)?.id ?? nextPipelines[0]?.id ?? "";
          const activePipeline = nextPipelines.find((item) => item.id === activePipelineId);
          setSelectedPipelineId(activePipelineId);
          setSelectedStageId(conversation.crmStageId ?? activePipeline?.stages[0]?.id ?? "");
        }
      } catch {
        if (!ignore) {
          setPipelineError("Network error while loading CRM pipelines.");
        }
      } finally {
        if (!ignore) {
          setIsLoadingPipelines(false);
        }
      }
    }

    void loadPipelines();
    return () => {
      ignore = true;
    };
  }, [conversation]);

  useEffect(() => {
    let ignore = false;

    async function loadBoard() {
      if (!selectedPipelineId) {
        setPipelineBoard(null);
        return;
      }

      setIsLoadingPipelineBoard(true);
      setPipelineError(null);
      try {
        const response = await fetch(`/api/crm/pipelines/board?pipelineId=${encodeURIComponent(selectedPipelineId)}&status=OPEN`, {
          cache: "no-store"
        });
        const payload = (await response.json().catch(() => null)) as { data?: { board?: PipelineBoard }; error?: { message?: string } } | null;
        if (!response.ok) {
          if (!ignore) {
            setPipelineError(payload?.error?.message ?? "Failed to load pipeline kanban.");
          }
          return;
        }

        if (!ignore) {
          setPipelineBoard(payload?.data?.board ?? null);
        }
      } catch {
        if (!ignore) {
          setPipelineError("Network error while loading pipeline kanban.");
        }
      } finally {
        if (!ignore) {
          setIsLoadingPipelineBoard(false);
        }
      }
    }

    void loadBoard();
    return () => {
      ignore = true;
    };
  }, [selectedPipelineId]);

  const activePipeline = useMemo(
    () => pipelines.find((pipeline) => pipeline.id === selectedPipelineId) ?? null,
    [pipelines, selectedPipelineId]
  );

  const timelineItems = useMemo(() => {
    if (!conversation) {
      return [] as CrmTimelineItem[];
    }

    const items: CrmTimelineItem[] = [
      {
        id: `assignment-${conversation.id}`,
        label: conversation.assignedToMemberId ? "Conversation assigned" : "Conversation unassigned",
        time: conversation.updatedAt
      }
    ];

    if (conversation.lastMessageAt) {
      items.push({
        id: `message-${conversation.id}`,
        label: "Latest message activity",
        time: conversation.lastMessageAt
      });
    }

    for (const note of notes) {
      items.push({ id: `note-${note.id}`, label: "Internal note added", time: note.createdAt });
    }

    for (const event of activity) {
      items.push({ id: `crm-${event.id}`, label: event.label, time: event.time });
    }

    return items.sort((left, right) => new Date(right.time ?? 0).getTime() - new Date(left.time ?? 0).getTime());
  }, [activity, conversation, notes]);

  const mediaItems = useMemo(
    () => messages.filter((message) => ["IMAGE", "VIDEO", "DOCUMENT"].includes(message.type) && Boolean(message.mediaUrl)),
    [messages]
  );

  const links = useMemo(() => {
    const regex = /(https?:\/\/[^\s]+)/gi;
    return Array.from(
      new Set(
        messages.flatMap((message) => {
          if (!message.text) {
            return [];
          }
          return (message.text.match(regex) ?? []).map((link) => normalizeRuntimeUrl(link));
        })
      )
    );
  }, [messages]);

  async function handleCreateTag(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!tagName.trim() || isSubmittingTag) {
      return;
    }

    setIsSubmittingTag(true);
    try {
      await onCreateTag(tagName.trim(), tagColor.trim() || "emerald");
      setTagName("");
    } finally {
      setIsSubmittingTag(false);
    }
  }

  async function handleCreateNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!noteContent.trim() || isSubmittingNote) {
      return;
    }

    setIsSubmittingNote(true);
    try {
      await onCreateNote(noteContent.trim());
      setNoteContent("");
    } finally {
      setIsSubmittingNote(false);
    }
  }

  async function openAssignModal() {
    if (!conversation) {
      return;
    }

    setIsAssignModalOpen(true);
    setAssignModalError(null);
    try {
      const response = await fetch(`/api/orgs/members?orgId=${encodeURIComponent(conversation.orgId)}`);
      const payload = (await response.json().catch(() => null)) as
        | {
            data?: {
              members?: Array<{ userId: string; name: string | null; email: string; role: string }>;
            };
            error?: { message?: string };
          }
        | null;
      if (!response.ok) {
        setAssignModalError(payload?.error?.message ?? "Failed to load business members.");
        return;
      }

      const members = payload?.data?.members ?? [];
      setAssignMembers(members);
      setSelectedAssignee(members[0]?.userId ?? "");
    } catch {
      setAssignModalError("Network error while loading business members.");
    }
  }

  async function handleSaveAssignment() {
    if (!conversation || !selectedAssignee || isSavingAssignment) {
      return;
    }

    setIsSavingAssignment(true);
    setAssignModalError(null);
    try {
      const response = await fetch("/api/conversations/assign", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          conversationId: conversation.id,
          assigneeUserId: selectedAssignee
        })
      });
      const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
      if (!response.ok) {
        setAssignModalError(payload?.error?.message ?? "Failed to assign conversation.");
        return;
      }

      await onRefreshConversation();
      setIsAssignModalOpen(false);
    } catch {
      setAssignModalError("Network error while assigning conversation.");
    } finally {
      setIsSavingAssignment(false);
    }
  }

  async function handleSavePipeline() {
    if (!conversation || !selectedPipelineId || !selectedStageId || isSavingPipeline) {
      return;
    }

    setIsSavingPipeline(true);
    setPipelineError(null);
    try {
      const response = await fetch(`/api/conversations/${encodeURIComponent(conversation.id)}/pipeline`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          pipelineId: selectedPipelineId,
          stageId: selectedStageId
        })
      });
      const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
      if (!response.ok) {
        setPipelineError(payload?.error?.message ?? "Failed to update pipeline stage.");
        return;
      }

      await onRefreshConversation();
      const boardResponse = await fetch(`/api/crm/pipelines/board?pipelineId=${encodeURIComponent(selectedPipelineId)}&status=OPEN`, {
        cache: "no-store"
      });
      const boardPayload = (await boardResponse.json().catch(() => null)) as { data?: { board?: PipelineBoard } } | null;
      if (boardResponse.ok) {
        setPipelineBoard(boardPayload?.data?.board ?? null);
      }
    } catch {
      setPipelineError("Network error while saving pipeline.");
    } finally {
      setIsSavingPipeline(false);
    }
  }

  async function moveConversationToStage(stageId: string) {
    if (!conversation || !selectedPipelineId || !stageId || movingStageId) {
      return;
    }

    setMovingStageId(stageId);
    setSelectedStageId(stageId);
    await handleSavePipeline();
    setMovingStageId(null);
  }

  if (isLoading) {
    return (
      <aside className="inbox-scroll h-full min-h-0 overflow-y-auto overscroll-contain rounded-[20px] border border-border/80 bg-card/95 p-4 shadow-sm">
        <p className="text-sm text-muted-foreground">Loading CRM context...</p>
      </aside>
    );
  }

  if (!conversation) {
    return (
      <aside className="inbox-scroll h-full min-h-0 overflow-y-auto overscroll-contain rounded-[24px] border border-border/80 bg-card/95 p-5 shadow-sm">
        <div className="rounded-[20px] border border-dashed border-border/80 bg-background/60 p-5">
          <h2 className="text-base font-semibold text-foreground">CRM Context</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Pilih percakapan untuk melihat profile customer, pipeline, catatan internal, media, dan invoice terkait.</p>
        </div>
      </aside>
    );
  }

  return (
    <aside className="inbox-scroll h-full min-h-0 space-y-3 overflow-y-auto overscroll-contain pb-3">
      <section className="rounded-[24px] border border-border/80 bg-card/95 shadow-sm">
        <div className="flex items-start gap-3 px-4 py-4">
          {conversation.customerAvatarUrl ? (
            <div className="relative h-16 w-16 overflow-hidden rounded-full border border-border/70">
              <Image src={conversation.customerAvatarUrl} alt={conversation.customerDisplayName ?? conversation.customerPhoneE164} fill unoptimized className="object-cover" />
            </div>
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
              {(conversation.customerDisplayName?.trim() || conversation.customerPhoneE164).slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-semibold text-foreground">{conversation.customerDisplayName?.trim() || conversation.customerPhoneE164}</h2>
            <p className="truncate text-sm text-muted-foreground">{conversation.customerPhoneE164}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className={`rounded-full border px-2 py-0.5 text-[11px] ${conversation.status === "OPEN" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600" : "border-amber-500/30 bg-amber-500/10 text-amber-600"}`}>{conversation.status}</span>
              {conversation.crmStageName ? <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[11px] text-primary">{conversation.crmStageName}</span> : null}
            </div>
          </div>
        </div>
        <div className="border-t border-border/70 px-4 py-4">
          <div className="space-y-2 text-sm">
            <div className="grid gap-2 text-xs text-muted-foreground">
              <p>Unread: {conversation.unreadCount}</p>
              <p>Last Activity: {formatDateTime(conversation.lastMessageAt)}</p>
              <p>Assigned Member: {conversation.assignedToMemberId || "Unassigned"}</p>
            </div>
            <div className="pt-2">
              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={onOpenInvoiceDrawer} size="sm" variant="secondary" className="h-8 rounded-lg border border-primary/30 bg-primary/10 text-primary">
                  Create Invoice
                </Button>
                <Button type="button" onClick={() => void openAssignModal()} disabled={isAssigning} size="sm" variant="secondary" className="h-8 rounded-lg border border-border/80 bg-background">
                  {isAssigning ? "Assigning..." : "Assign to"}
                </Button>
              </div>
              {assignError ? <p className="mt-2 text-xs text-destructive">{assignError}</p> : null}
            </div>
          </div>
        </div>
      </section>

      <AccordionCard id="crm-pipeline" title="Pipeline & Peluang" icon={PanelsTopLeft} defaultOpen>
        <div className="space-y-3">
          <select
            value={selectedPipelineId}
            onChange={(event) => {
              const nextPipelineId = event.target.value;
              const nextPipeline = pipelines.find((item) => item.id === nextPipelineId);
              setSelectedPipelineId(nextPipelineId);
              setSelectedStageId(nextPipeline?.stages[0]?.id ?? "");
            }}
            className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
          >
            <option value="">-- Pilih Pipeline --</option>
            {pipelines.map((pipeline) => (
              <option key={pipeline.id} value={pipeline.id}>
                {pipeline.name}
              </option>
            ))}
          </select>
          <select value={selectedStageId} onChange={(event) => setSelectedStageId(event.target.value)} className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm">
            <option value="">-- Pilih Stage --</option>
            {(activePipeline?.stages ?? []).map((stage) => (
              <option key={stage.id} value={stage.id}>
                {stage.name}
              </option>
            ))}
          </select>
          <Button type="button" onClick={() => void handleSavePipeline()} disabled={!selectedPipelineId || !selectedStageId || isSavingPipeline} className="h-10 w-full rounded-xl">
            {isSavingPipeline ? "Saving..." : "Simpan Pipeline"}
          </Button>
          <div className="rounded-xl border border-border/70 bg-background/50 p-2">
            <div className="mb-2 flex items-center justify-between px-1">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Kanban (Open)</p>
              {pipelineBoard ? <p className="text-[11px] text-muted-foreground">{pipelineBoard.pipeline.name}</p> : null}
            </div>
            <div className="inbox-scroll flex gap-2 overflow-x-auto pb-1">
              {(pipelineBoard?.columns ?? activePipeline?.stages.map((stage) => ({
                stageId: stage.id,
                stageName: stage.name,
                stageColor: stage.color,
                cardCount: 0,
                cards: []
              })) ?? []
              ).map((column) => {
                const isCurrentStage = selectedStageId === column.stageId;
                const currentCard = column.cards.find((card) => card.id === conversation.id) ?? null;
                return (
                  <article key={column.stageId} className={`w-56 shrink-0 rounded-xl border p-2 ${isCurrentStage ? "border-primary/40 bg-primary/5" : "border-border/70 bg-card/80"}`}>
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="truncate text-xs font-semibold text-foreground">{column.stageName}</p>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] ${stageColorClass(column.stageColor)}`}>{column.cardCount}</span>
                    </div>
                    {currentCard ? (
                      <div className="rounded-lg border border-primary/30 bg-primary/10 p-2">
                        <p className="truncate text-xs font-semibold text-foreground">{currentCard.customerName}</p>
                        <p className="truncate text-[11px] text-muted-foreground">{currentCard.customerPhoneE164}</p>
                      </div>
                    ) : (
                      <p className="line-clamp-2 rounded-lg border border-dashed border-border/70 px-2 py-2 text-[11px] text-muted-foreground">
                        {column.cards[0]?.customerName ? `${column.cards[0].customerName}: ${column.cards[0].lastMessagePreview ?? "tanpa preview"}` : "Belum ada kartu pada stage ini."}
                      </p>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant={isCurrentStage ? "default" : "secondary"}
                      className="mt-2 h-7 w-full rounded-lg text-[11px]"
                      disabled={isSavingPipeline || movingStageId === column.stageId}
                      onClick={() => void moveConversationToStage(column.stageId)}
                    >
                      {movingStageId === column.stageId ? "Memindahkan..." : isCurrentStage ? "Stage Aktif" : "Pindah ke sini"}
                    </Button>
                  </article>
                );
              })}
            </div>
            {isLoadingPipelineBoard ? <p className="mt-2 text-[11px] text-muted-foreground">Loading kanban...</p> : null}
          </div>
          {isLoadingPipelines ? <p className="text-xs text-muted-foreground">Loading pipelines...</p> : null}
          {pipelineError ? <p className="text-xs text-destructive">{pipelineError}</p> : null}
        </div>
      </AccordionCard>

      <AccordionCard id="crm-notes" title="Catatan Internal" icon={NotebookPen}>
        <form className="space-y-3" onSubmit={handleCreateNote}>
          <textarea
            value={noteContent}
            onChange={(event) => setNoteContent(event.target.value)}
            placeholder="Catatan khusus pelanggan ini... (Tidak terkirim)"
            className="min-h-[112px] w-full rounded-2xl border border-amber-200 bg-amber-50/40 px-3 py-3 text-sm text-foreground outline-none transition focus:border-amber-300 focus:ring-2 focus:ring-amber-200/60"
          />
          <div className="flex justify-end">
            <Button type="submit" disabled={isSubmittingNote || !noteContent.trim()} size="sm" className="h-9 rounded-lg">
              {isSubmittingNote ? "Saving..." : "Simpan Catatan"}
            </Button>
          </div>
        </form>
        <div className="mt-4 space-y-2">
          {isLoadingCrm ? <p className="text-xs text-muted-foreground">Loading notes...</p> : null}
          {!isLoadingCrm && notes.length === 0 ? <p className="text-xs text-muted-foreground">Belum ada catatan internal.</p> : null}
          {!isLoadingCrm &&
            notes.map((note) => (
              <article key={note.id} className="rounded-xl border border-border/80 bg-background/70 p-3">
                <p className="text-sm text-foreground">{note.content}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">{formatDateTime(note.createdAt)}</p>
                <div className="mt-2 flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="h-7 rounded-lg border border-border/80 bg-background px-2 text-[11px]"
                    onClick={() => {
                      setEditingNote(note);
                      setEditingNoteContent(note.content);
                    }}
                  >
                    Open
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="h-7 rounded-lg border border-destructive/30 bg-destructive/10 px-2 text-[11px] text-destructive"
                    onClick={() => void onDeleteNote(note.id)}
                  >
                    Delete
                  </Button>
                </div>
              </article>
            ))}
          {crmError ? <p className="text-xs text-destructive">{crmError}</p> : null}
        </div>
      </AccordionCard>

      <AccordionCard id="crm-tags" title="Labels" icon={Workflow} defaultOpen={false}>
        <form className="flex gap-2" onSubmit={handleCreateTag}>
          <Input value={tagName} onChange={(event) => setTagName(event.target.value)} placeholder="New label" className="h-10 rounded-xl" />
          <Button type="submit" disabled={isSubmittingTag} size="sm" variant="secondary" className="h-10 rounded-xl border border-border/80 bg-background">
            {isSubmittingTag ? "..." : "Add"}
          </Button>
        </form>
        <div className="mt-3 flex flex-wrap gap-2">
          {labelColorPresets.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setTagColor(preset)}
            className={tagColor === preset ? "rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] capitalize text-primary" : "rounded-full border border-border px-2.5 py-1 text-[11px] capitalize text-muted-foreground"}
            >
              {preset}
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {tags.map((tag) => (
            <button
              key={tag.id}
              type="button"
              onClick={() => void onAssignTag(tag.id)}
              disabled={tag.isAssigned}
              className={tag.isAssigned ? "rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-[11px] text-emerald-600" : "rounded-full border border-border px-2.5 py-1 text-[11px] text-foreground hover:bg-accent"}
            >
              {tag.name}
            </button>
          ))}
          {!isLoadingCrm && tags.length === 0 ? <p className="text-xs text-muted-foreground">Belum ada label.</p> : null}
        </div>
      </AccordionCard>

      <AccordionCard id="crm-media" title="Media, Dokumen & Tautan" icon={ImageIcon}>
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Media & Dokumen</p>
            {mediaItems.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/80 bg-background/50 px-4 py-6 text-center text-xs text-muted-foreground">Tidak ada riwayat media</div>
            ) : (
              <div className="grid gap-2">
                {mediaItems.slice(0, 12).map((item) => (
                  <a key={item.id} href={item.mediaUrl ?? "#"} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-xl border border-border/80 bg-background/70 px-3 py-3 hover:bg-accent/40">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted/70 text-muted-foreground">
                      {item.type === "DOCUMENT" ? <FileText className="h-4 w-4" /> : <ImageIcon className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{item.fileName ?? `${item.type} attachment`}</p>
                      <p className="text-xs text-muted-foreground">{formatDateTime(item.createdAt)}</p>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Tautan</p>
            {links.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/80 bg-background/50 px-4 py-6 text-center text-xs text-muted-foreground">Tidak ada tautan di percakapan ini</div>
            ) : (
              <div className="space-y-2">
                {links.map((link) => (
                  <a key={link} href={link} target="_blank" rel="noreferrer" className="flex items-start gap-3 rounded-xl border border-border/80 bg-background/70 px-3 py-3 hover:bg-accent/40">
                    <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-muted/70 text-muted-foreground">
                      <Link2 className="h-4 w-4" />
                    </div>
                    <span className="break-all text-sm text-primary underline underline-offset-2">{link}</span>
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </AccordionCard>

      <AccordionCard id="crm-proof" title="Attach Payment Proof" icon={FileText} defaultOpen={false}>
        <p className="text-xs text-muted-foreground">Selected message: {selectedProofMessageId ?? "None (use \"Use as payment proof\" in chat bubble)"}</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <Input value={proofInvoiceId} onChange={(event) => setProofInvoiceId(event.target.value)} placeholder="Invoice ID" className="h-10 rounded-xl" />
          <select value={proofMilestoneType} onChange={(event) => setProofMilestoneType(event.target.value as "" | "FULL" | "DP" | "FINAL")} className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm">
            <option value="">No milestone</option>
            <option value="FULL">FULL</option>
            <option value="DP">DP</option>
            <option value="FINAL">FINAL</option>
          </select>
        </div>
        <Button
          type="button"
          disabled={isAttachingProof || !selectedProofMessageId || !proofInvoiceId.trim()}
          onClick={() => void onAttachProof(proofInvoiceId.trim(), proofMilestoneType || undefined)}
          size="sm"
          className="mt-3 h-9 w-full rounded-xl"
        >
          {isAttachingProof ? "Attaching..." : "Attach proof"}
        </Button>
        {proofFeedback ? <p className="mt-2 text-xs text-muted-foreground">{proofFeedback}</p> : null}
      </AccordionCard>

      <div id="crm-invoices">
        <AccordionCard id="crm-invoices-panel" title="Invoices" icon={FileText} defaultOpen={false}>
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
        </AccordionCard>
      </div>

      <div id="crm-timeline">
        <AccordionCard id="crm-timeline-panel" title="Timeline" icon={Workflow} defaultOpen={false}>
          <ActivityTimelineSection timelineItems={timelineItems} formatDateTime={formatDateTime} />
        </AccordionCard>
      </div>

      {isAssignModalOpen ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Assign conversation"
        >
          <div ref={assignModalContainerRef} className="w-full max-w-lg rounded-[28px] border border-border/80 bg-card p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">Assign conversation</h3>
              <Button ref={assignModalCloseButtonRef} type="button" variant="ghost" onClick={() => setIsAssignModalOpen(false)}>
                Close
              </Button>
            </div>
            <select value={selectedAssignee} onChange={(event) => setSelectedAssignee(event.target.value)} className="mt-4 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm">
              {assignMembers.map((member) => (
                <option key={member.userId} value={member.userId}>
                  {(member.name?.trim() || member.email)} • {member.role}
                </option>
              ))}
            </select>
            {assignModalError ? <p className="mt-3 text-sm text-destructive">{assignModalError}</p> : null}
            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setIsAssignModalOpen(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={() => void handleSaveAssignment()} disabled={!selectedAssignee || isSavingAssignment}>
                {isSavingAssignment ? "Saving..." : "Assign"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {editingNote ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Detail catatan"
        >
          <div ref={editNoteModalContainerRef} className="w-full max-w-2xl rounded-[28px] border border-border/80 bg-card p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-foreground">Detail catatan</h3>
                <p className="text-sm text-muted-foreground">{formatDateTime(editingNote.createdAt)}</p>
              </div>
              <Button ref={editNoteModalCloseButtonRef} type="button" variant="ghost" onClick={() => setEditingNote(null)}>
                Close
              </Button>
            </div>
            <textarea
              value={editingNoteContent}
              onChange={(event) => setEditingNoteContent(event.target.value)}
              className="mt-4 min-h-[220px] w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:border-primary"
              placeholder="Tulis detail catatan untuk seluruh tim CS..."
            />
            <div className="mt-5 flex justify-between gap-2">
              <Button
                type="button"
                variant="secondary"
                className="border border-destructive/30 bg-destructive/10 text-destructive"
                onClick={async () => {
                  await onDeleteNote(editingNote.id);
                  setEditingNote(null);
                }}
              >
                Delete
              </Button>
              <div className="flex gap-2">
                <Button type="button" variant="ghost" onClick={() => setEditingNote(null)}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={isSavingEditedNote || !editingNoteContent.trim()}
                  onClick={async () => {
                    setIsSavingEditedNote(true);
                    try {
                      await onUpdateNote(editingNote.id, editingNoteContent.trim());
                      setEditingNote(null);
                    } finally {
                      setIsSavingEditedNote(false);
                    }
                  }}
                >
                  {isSavingEditedNote ? "Saving..." : "Save note"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </aside>
  );
}
