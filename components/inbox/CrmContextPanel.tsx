"use client";

import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { ChevronDown, FileText, ImageIcon, Link2, NotebookPen, Workflow } from "lucide-react";

import { ActivityTimelineSection } from "@/components/inbox/crm/ActivityTimelineSection";
import { InvoicesSection } from "@/components/inbox/crm/InvoicesSection";
import type { CrmActivityItem, CrmInvoiceItem, CrmTimelineItem } from "@/components/inbox/crm/types";
import { normalizeRuntimeUrl } from "@/components/inbox/bubble/utils";
import type { ConversationItem, MessageItem } from "@/components/inbox/types";
import { useModalAccessibility } from "@/lib/a11y/useModalAccessibility";
import { BUSINESS_CATEGORY_OPTIONS, FOLLOW_UP_OPTIONS, LEAD_STATUS_OPTIONS, formatLeadSettingLabel } from "@/lib/crm/leadSettingsConfig";
import { Badge } from "@/components/ui/badge";
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

type CustomerLeadSettings = {
  leadStatus: string;
  followUpStatus: string | null;
  businessCategory: string | null;
  crmStageId: string | null;
};

type PipelineStageOption = {
  stageId: string;
  stageName: string;
  stageColor: string;
  position: number;
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

function formatLabel(value: string): string {
  return formatLeadSettingLabel(value);
}

function renderLeadToneBadge(value: string, kind: "status" | "followup" | "hotness") {
  if (kind === "hotness") {
    const normalized = value.toUpperCase();
    if (normalized === "HOT") return <Badge className="rounded-full bg-orange-500 text-white hover:bg-orange-500">Hot</Badge>;
    if (normalized === "WARM") return <Badge className="rounded-full bg-amber-400 text-white hover:bg-amber-400">Warm</Badge>;
    return <Badge className="rounded-full bg-blue-600 text-white hover:bg-blue-600">Cold</Badge>;
  }

  if (kind === "followup") {
    const normalized = value.toUpperCase();
    if (normalized === "CHAT") return <Badge className="rounded-full bg-amber-400 text-white hover:bg-amber-400">Chat</Badge>;
    if (normalized === "CALL") return <Badge className="rounded-full bg-violet-500 text-white hover:bg-violet-500">Call</Badge>;
    if (normalized === "MEETING") return <Badge className="rounded-full bg-orange-500 text-white hover:bg-orange-500">Meeting</Badge>;
    if (normalized === "PENAWARAN") return <Badge className="rounded-full bg-cyan-500 text-white hover:bg-cyan-500">Penawaran</Badge>;
    if (normalized === "DEALING") return <Badge className="rounded-full bg-emerald-600 text-white hover:bg-emerald-600">Dealing</Badge>;
    if (normalized === "BLUEPRINT") return <Badge className="rounded-full bg-pink-500 text-white hover:bg-pink-500">Blueprint</Badge>;
    return <Badge className="rounded-full bg-blue-500 text-white hover:bg-blue-500">Wait Respon</Badge>;
  }

  const normalized = value.toUpperCase();
  if (normalized === "PROSPECT") return <Badge className="rounded-full bg-red-500 text-white hover:bg-red-500">Prospect</Badge>;
  if (normalized === "ACTIVE_CLIENT") return <Badge className="rounded-full bg-lime-500 text-white hover:bg-lime-500">Active Client</Badge>;
  if (normalized === "UNQUALIFIED") return <Badge className="rounded-full bg-slate-600 text-white hover:bg-slate-600">Unqualified</Badge>;
  if (normalized === "REMARKETING") return <Badge className="rounded-full bg-fuchsia-500 text-white hover:bg-fuchsia-500">Remarketing</Badge>;
  if (normalized === "OLD_CLIENT") return <Badge className="rounded-full bg-amber-700 text-white hover:bg-amber-700">Old Client</Badge>;
  if (normalized === "PARTNERSHIP") return <Badge className="rounded-full bg-rose-300 text-slate-800 hover:bg-rose-300">Partnership</Badge>;
  if (normalized === "OTHER") return <Badge className="rounded-full bg-zinc-500 text-white hover:bg-zinc-500">Other</Badge>;
  return <Badge className="rounded-full bg-blue-400 text-white hover:bg-blue-400">New Lead</Badge>;
}

const PIPELINE_STAGE_COLOR_CLASS: Record<string, string> = {
  emerald: "bg-emerald-500 text-white hover:bg-emerald-500",
  amber: "bg-amber-500 text-white hover:bg-amber-500",
  sky: "bg-sky-500 text-white hover:bg-sky-500",
  violet: "bg-violet-500 text-white hover:bg-violet-500",
  rose: "bg-rose-500 text-white hover:bg-rose-500",
  slate: "bg-slate-600 text-white hover:bg-slate-600"
};

function renderPipelineStageBadge(name: string, color: string) {
  const tone = PIPELINE_STAGE_COLOR_CLASS[color] ?? "bg-slate-500 text-white hover:bg-slate-500";
  return <Badge className={`rounded-full ${tone}`}>{name}</Badge>;
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
  const [leadSettings, setLeadSettings] = useState<CustomerLeadSettings>({
    leadStatus: "NEW_LEAD",
    followUpStatus: "WAIT_RESPON",
    businessCategory: null,
    crmStageId: null
  });
  const [pipelineId, setPipelineId] = useState<string | null>(null);
  const [pipelineStages, setPipelineStages] = useState<PipelineStageOption[]>([]);
  const [isLoadingLeadSettings, setIsLoadingLeadSettings] = useState(false);
  const [leadSettingsError, setLeadSettingsError] = useState<string | null>(null);
  const [isSavingLeadSettings, setIsSavingLeadSettings] = useState(false);
  const [isSavingTags, setIsSavingTags] = useState(false);
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
  const leadStatusOptions = LEAD_STATUS_OPTIONS;
  const followUpOptions = FOLLOW_UP_OPTIONS;
  const businessCategoryOptions = BUSINESS_CATEGORY_OPTIONS;

  useEffect(() => {
    let ignore = false;

    async function loadLeadSettings() {
      if (!conversation) {
        return;
      }

      setIsLoadingLeadSettings(true);
      setLeadSettingsError(null);
      try {
        const response = await fetch(`/api/customers/${encodeURIComponent(conversation.customerId)}`, { cache: "no-store" });
        const payload = (await response.json().catch(() => null)) as {
          data?: {
            customer?: {
              leadStatus?: string;
              followUpStatus?: string | null;
              businessCategory?: string | null;
              crmStageId?: string | null;
            };
          };
          error?: { message?: string };
        } | null;
        if (!response.ok) {
          if (!ignore) {
            setLeadSettingsError(payload?.error?.message ?? "Failed to load lead settings.");
          }
          return;
        }

        const customer = payload?.data?.customer;
        if (!ignore && customer) {
          setLeadSettings({
            leadStatus: customer.leadStatus ?? "NEW_LEAD",
            followUpStatus: customer.followUpStatus ?? "WAIT_RESPON",
            businessCategory: customer.businessCategory ?? null,
            crmStageId: customer.crmStageId ?? conversation.crmStageId ?? null
          });
        }
      } catch {
        if (!ignore) {
          setLeadSettingsError("Network error while loading lead settings.");
        }
      } finally {
        if (!ignore) {
          setIsLoadingLeadSettings(false);
        }
      }
    }

    void loadLeadSettings();
    return () => {
      ignore = true;
    };
  }, [conversation]);

  useEffect(() => {
    let ignore = false;

    async function loadPipelineStages() {
      if (!conversation) {
        setPipelineId(null);
        setPipelineStages([]);
        return;
      }

      try {
        const query = conversation.crmPipelineId
          ? `?pipelineId=${encodeURIComponent(conversation.crmPipelineId)}&status=OPEN`
          : "?status=OPEN";
        const response = await fetch(`/api/crm/pipelines/board${query}`, { cache: "no-store" });
        const payload = (await response.json().catch(() => null)) as
          | {
              data?: {
                board?: {
                  pipeline?: { id: string } | null;
                  columns?: Array<{ stageId: string; stageName: string; stageColor: string; position: number }>;
                };
              };
              error?: { message?: string };
            }
          | null;
        if (!response.ok) {
          if (!ignore) {
            setLeadSettingsError(payload?.error?.message ?? "Failed to load pipeline stages.");
          }
          return;
        }

        const board = payload?.data?.board;
        if (!ignore) {
          setPipelineId(board?.pipeline?.id ?? conversation.crmPipelineId ?? null);
          setPipelineStages(
            (board?.columns ?? [])
              .map((item) => ({
                stageId: item.stageId,
                stageName: item.stageName,
                stageColor: item.stageColor,
                position: item.position
              }))
              .sort((a, b) => a.position - b.position)
          );
        }
      } catch {
        if (!ignore) {
          setLeadSettingsError("Network error while loading pipeline stages.");
        }
      }
    }

    void loadPipelineStages();
    return () => {
      ignore = true;
    };
  }, [conversation]);

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

  async function handleSaveLeadSettings() {
    if (!conversation || isSavingLeadSettings) {
      return;
    }

    setIsSavingLeadSettings(true);
    setLeadSettingsError(null);
    try {
      const response = await fetch(`/api/customers/${encodeURIComponent(conversation.customerId)}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          leadStatus: leadSettings.leadStatus,
          followUpStatus: leadSettings.followUpStatus,
          businessCategory: leadSettings.businessCategory
        })
      });
      const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
      if (!response.ok) {
        setLeadSettingsError(payload?.error?.message ?? "Failed to save lead settings.");
        return;
      }

      if (leadSettings.crmStageId && pipelineId) {
        const stageResponse = await fetch(`/api/conversations/${encodeURIComponent(conversation.id)}/pipeline`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            pipelineId,
            stageId: leadSettings.crmStageId
          })
        });
        const stagePayload = (await stageResponse.json().catch(() => null)) as { error?: { message?: string } } | null;
        if (!stageResponse.ok) {
          setLeadSettingsError(stagePayload?.error?.message ?? "Failed to update pipeline stage.");
          return;
        }
      }

      await onRefreshConversation();
    } catch {
      setLeadSettingsError("Network error while saving lead settings.");
    } finally {
      setIsSavingLeadSettings(false);
    }
  }

  async function handleToggleTag(tagId: string) {
    if (!conversation || isSavingTags) {
      return;
    }

    setIsSavingTags(true);
    setLeadSettingsError(null);
    try {
      const currentlyAssignedIds = tags.filter((item) => item.isAssigned).map((item) => item.id);
      const nextTagIds = currentlyAssignedIds.includes(tagId)
        ? currentlyAssignedIds.filter((id) => id !== tagId)
        : Array.from(new Set([...currentlyAssignedIds, tagId]));

      const response = await fetch(`/api/customers/${encodeURIComponent(conversation.customerId)}/tags`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          tagIds: nextTagIds
        })
      });
      const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
      if (!response.ok) {
        setLeadSettingsError(payload?.error?.message ?? "Failed to update tags.");
        return;
      }

      await onRefreshConversation();
    } catch {
      setLeadSettingsError("Network error while updating tags.");
    } finally {
      setIsSavingTags(false);
    }
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
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Pilih percakapan untuk melihat profile customer, lead settings, catatan internal, media, dan invoice terkait.</p>
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

      <AccordionCard id="crm-lead-settings" title="Lead Settings" icon={Workflow} defaultOpen>
        <div className="space-y-3">
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              void handleSaveLeadSettings();
            }}
          >
            <div>
              <p className="mb-1 text-xs text-muted-foreground">Status Lead</p>
              <select
                value={leadSettings.leadStatus}
                onChange={(event) => setLeadSettings((current) => ({ ...current, leadStatus: event.target.value }))}
                className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
              >
                {leadStatusOptions.map((option) => (
                  <option key={option} value={option}>
                    {formatLabel(option)}
                  </option>
                ))}
              </select>
              <div className="mt-2">
                {renderLeadToneBadge(leadSettings.leadStatus, "status")}
              </div>
            </div>
            <div>
              <p className="mb-1 text-xs text-muted-foreground">Follow-up</p>
              <select
                value={leadSettings.followUpStatus ?? "WAIT_RESPON"}
                onChange={(event) => setLeadSettings((current) => ({ ...current, followUpStatus: event.target.value }))}
                className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
              >
                {followUpOptions.map((option) => (
                  <option key={option} value={option}>
                    {formatLabel(option)}
                  </option>
                ))}
              </select>
              <div className="mt-2">
                {renderLeadToneBadge(leadSettings.followUpStatus ?? "WAIT_RESPON", "followup")}
              </div>
            </div>
            <div>
              <p className="mb-1 text-xs text-muted-foreground">Pipeline Stage</p>
              <select
                value={leadSettings.crmStageId ?? ""}
                onChange={(event) =>
                  setLeadSettings((current) => ({
                    ...current,
                    crmStageId: event.target.value || null
                  }))
                }
                className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
              >
                <option value="">Unassigned</option>
                {pipelineStages.map((stage) => (
                  <option key={stage.stageId} value={stage.stageId}>
                    {stage.stageName}
                  </option>
                ))}
              </select>
              <div className="mt-2">
                {leadSettings.crmStageId ? (
                  (() => {
                    const selectedStage = pipelineStages.find((stage) => stage.stageId === leadSettings.crmStageId);
                    if (!selectedStage) {
                      return <Badge variant="outline">Stage selected</Badge>;
                    }
                    return renderPipelineStageBadge(selectedStage.stageName, selectedStage.stageColor);
                  })()
                ) : (
                  <Badge variant="outline" className="rounded-full">
                    Unassigned
                  </Badge>
                )}
              </div>
            </div>
            <div>
              <p className="mb-1 text-xs text-muted-foreground">Business Category</p>
              <Input
                list="crm-business-category-options"
                value={leadSettings.businessCategory ?? ""}
                onChange={(event) => setLeadSettings((current) => ({ ...current, businessCategory: event.target.value.trim() || null }))}
                placeholder="Set category"
                className="h-11 rounded-xl"
              />
              <datalist id="crm-business-category-options">
                {businessCategoryOptions.map((option) => (
                  <option key={option} value={option} />
                ))}
              </datalist>
              {leadSettings.businessCategory ? (
                <div className="mt-2">
                  <Badge className="max-w-[220px] truncate rounded-full bg-violet-200 text-violet-700 hover:bg-violet-200" title={leadSettings.businessCategory}>
                    {leadSettings.businessCategory}
                  </Badge>
                </div>
              ) : null}
            </div>
            <div>
              <p className="mb-1 text-xs text-muted-foreground">Tags</p>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => void handleToggleTag(tag.id)}
                    disabled={isSavingTags}
                    className={
                      tag.isAssigned
                        ? "rounded-full border border-blue-500 bg-blue-500 px-2.5 py-1 text-[11px] text-white"
                        : "rounded-full border border-border px-2.5 py-1 text-[11px] text-foreground hover:bg-accent"
                    }
                  >
                    {tag.name}
                  </button>
                ))}
                {!isLoadingCrm && tags.length === 0 ? <p className="text-xs text-muted-foreground">Belum ada tag.</p> : null}
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Create New Tag</p>
              <form className="flex gap-2" onSubmit={handleCreateTag}>
                <Input value={tagName} onChange={(event) => setTagName(event.target.value)} placeholder="New tag" className="h-10 rounded-xl" />
                <Button type="submit" disabled={isSubmittingTag} size="sm" variant="secondary" className="h-10 rounded-xl border border-border/80 bg-background">
                  {isSubmittingTag ? "..." : "Add"}
                </Button>
              </form>
              <div className="flex flex-wrap gap-2">
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
            </div>
            <Button type="submit" disabled={isSavingLeadSettings || isLoadingLeadSettings} className="h-10 w-full rounded-xl">
              {isSavingLeadSettings ? "Saving..." : "Save Lead Settings"}
            </Button>
          </form>
          {isLoadingLeadSettings ? <p className="text-xs text-muted-foreground">Loading lead settings...</p> : null}
          {leadSettingsError ? <p className="text-xs text-destructive">{leadSettingsError}</p> : null}
          {crmError ? <p className="text-xs text-destructive">{crmError}</p> : null}
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
