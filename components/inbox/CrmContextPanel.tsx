"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { ChevronDown, FileText, ImageIcon, Link2, NotebookPen, Workflow } from "lucide-react";

import { ActivityTimelineSection } from "@/components/inbox/crm/ActivityTimelineSection";
import { IndicatorLegend } from "@/components/inbox/IndicatorLegend";
import { InvoicesSection } from "@/components/inbox/crm/InvoicesSection";
import type { CrmActivityItem, CrmInvoiceItem, CrmTimelineItem } from "@/components/inbox/crm/types";
import { normalizeRuntimeUrl } from "@/components/inbox/bubble/utils";
import type { ConversationItem, MessageItem } from "@/components/inbox/types";
import { useModalAccessibility } from "@/lib/a11y/useModalAccessibility";
import { useLocalImageCache } from "@/lib/client/localImageCache";
import { BUSINESS_CATEGORY_OPTIONS, LEAD_STATUS_OPTIONS, formatLeadSettingLabel } from "@/lib/crm/leadSettingsConfig";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type CustomerLeadSettings = {
  leadStatus: string;
  businessCategory: string | null;
  crmStageId: string | null;
  notes: string | null;
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

function resolveSafeMediaUrl(value: string | null | undefined): string | null {
  if (!value || !value.trim()) {
    return null;
  }

  const normalized = value.trim();
  try {
    const parsed = new URL(normalized, typeof window !== "undefined" ? window.location.origin : "http://localhost");
    const hostname = parsed.hostname.toLowerCase();
    if (hostname === "example.com" || hostname.endsWith(".example.com")) {
      return null;
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
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
}: CrmContextPanelProps) {
  const [noteContent, setNoteContent] = useState("");
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [assignMembers, setAssignMembers] = useState<Array<{ userId: string; name: string | null; email: string; role: string }>>([]);
  const [selectedAssignee, setSelectedAssignee] = useState("");
  const [isSavingAssignment, setIsSavingAssignment] = useState(false);
  const [assignModalError, setAssignModalError] = useState<string | null>(null);
  const [leadSettings, setLeadSettings] = useState<CustomerLeadSettings>({
    leadStatus: "NEW_LEAD",
    businessCategory: null,
    crmStageId: null,
    notes: null
  });
  const [newBusinessCategory, setNewBusinessCategory] = useState("");
  const [customBusinessCategories, setCustomBusinessCategories] = useState<string[]>([]);
  const [activeMediaTab, setActiveMediaTab] = useState<"media" | "documents" | "links">("media");
  const [previewMediaUrl, setPreviewMediaUrl] = useState<string | null>(null);
  const [previewMediaType, setPreviewMediaType] = useState<"IMAGE" | "VIDEO" | "DOCUMENT" | "LINK" | null>(null);
  const [previewMediaTitle, setPreviewMediaTitle] = useState<string>("");
  const [pipelineId, setPipelineId] = useState<string | null>(null);
  const [pipelineStages, setPipelineStages] = useState<PipelineStageOption[]>([]);
  const [isLoadingLeadSettings, setIsLoadingLeadSettings] = useState(false);
  const [leadSettingsError, setLeadSettingsError] = useState<string | null>(null);
  const [isSavingLeadSettings, setIsSavingLeadSettings] = useState(false);
  const assignModalContainerRef = useRef<HTMLDivElement | null>(null);
  const assignModalCloseButtonRef = useRef<HTMLButtonElement | null>(null);
  const cachedCustomerAvatarUrl = useLocalImageCache(conversation?.customerAvatarUrl, {
    cacheKey: `crm-avatar:${conversation?.id ?? "none"}`,
    ttlMs: 24 * 60 * 60 * 1000,
    maxBytes: 180 * 1024
  });

  useModalAccessibility({
    open: isAssignModalOpen,
    onClose: () => setIsAssignModalOpen(false),
    containerRef: assignModalContainerRef,
    initialFocusRef: assignModalCloseButtonRef
  });

  const canOperateInvoice = activeOrgRole === "OWNER" || activeOrgRole === "ADMIN" || activeOrgRole === "CS";
  const activityTimestamp = conversation?.lastMessageAt ?? conversation?.updatedAt ?? null;
  const avatarPresenceActive =
    conversation?.status === "OPEN" &&
    Boolean(activityTimestamp) &&
    new Date(activityTimestamp ?? 0).getTime() >= Date.now() - 5 * 60 * 1000;
  const isLatestMessageProofReady =
    conversation?.lastMessageDirection === "INBOUND" &&
    (conversation.lastMessageType === "IMAGE" || conversation.lastMessageType === "DOCUMENT");
  const leadStatusOptions = LEAD_STATUS_OPTIONS;
  const businessCategoryOptions = BUSINESS_CATEGORY_OPTIONS;
  const businessCategorySelectOptions = useMemo(() => {
    const options = [...businessCategoryOptions, ...customBusinessCategories];
    if (leadSettings.businessCategory) {
      options.push(leadSettings.businessCategory);
    }
    return Array.from(new Set(options));
  }, [businessCategoryOptions, customBusinessCategories, leadSettings.businessCategory]);

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
              businessCategory?: string | null;
              crmStageId?: string | null;
              remarks?: string | null;
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
            businessCategory: customer.businessCategory ?? null,
            crmStageId: customer.crmStageId ?? conversation.crmStageId ?? null,
            notes: customer.remarks ?? null
          });
          setNoteContent(customer.remarks ?? "");
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

    for (const event of activity) {
      items.push({ id: `crm-${event.id}`, label: event.label, time: event.time });
    }

    return items.sort((left, right) => new Date(right.time ?? 0).getTime() - new Date(left.time ?? 0).getTime());
  }, [activity, conversation]);

  const mediaItems = useMemo(() => {
    return messages
      .filter((message) => ["IMAGE", "VIDEO", "DOCUMENT"].includes(message.type))
      .map((message) => ({
        ...message,
        safeMediaUrl: resolveSafeMediaUrl(message.mediaUrl)
      }))
      .filter((message) => Boolean(message.safeMediaUrl));
  }, [messages]);
  const mediaOnlyItems = useMemo(() => mediaItems.filter((item) => item.type === "IMAGE" || item.type === "VIDEO"), [mediaItems]);
  const documentItems = useMemo(() => mediaItems.filter((item) => item.type === "DOCUMENT"), [mediaItems]);

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

  async function handleSaveNotes() {
    if (!conversation || isSavingNotes) {
      return;
    }

    setIsSavingNotes(true);
    setLeadSettingsError(null);
    try {
      const response = await fetch(`/api/customers/${encodeURIComponent(conversation.customerId)}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          remarks: noteContent.trim() || null
        })
      });
      const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
      if (!response.ok) {
        setLeadSettingsError(payload?.error?.message ?? "Failed to save notes.");
        return;
      }

      setLeadSettings((current) => ({ ...current, notes: noteContent.trim() || null }));
      await onRefreshConversation();
    } catch {
      setLeadSettingsError("Network error while saving notes.");
    } finally {
      setIsSavingNotes(false);
    }
  }

  function handleAddBusinessCategory() {
    const value = newBusinessCategory.trim();
    if (!value) {
      return;
    }

    setCustomBusinessCategories((current) => (current.includes(value) ? current : [...current, value]));
    setLeadSettings((current) => ({ ...current, businessCategory: value }));
    setNewBusinessCategory("");
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
      <section id="crm-profile" className="rounded-[24px] border border-border/80 bg-card/95 shadow-sm">
        <div className="flex items-start gap-3 px-4 py-4">
          {conversation.customerAvatarUrl ? (
            <div className="relative h-16 w-16 overflow-hidden rounded-full border border-border/70">
              <Image src={cachedCustomerAvatarUrl ?? conversation.customerAvatarUrl} alt={conversation.customerDisplayName ?? conversation.customerPhoneE164} fill unoptimized className="object-cover" />
              <span
                className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-card ${
                  avatarPresenceActive ? "bg-emerald-500" : "bg-slate-300"
                }`}
                title={avatarPresenceActive ? "Active recently" : "No recent activity"}
              />
            </div>
          ) : (
            <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
              {(conversation.customerDisplayName?.trim() || conversation.customerPhoneE164).slice(0, 2).toUpperCase()}
              <span
                className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-card ${
                  avatarPresenceActive ? "bg-emerald-500" : "bg-slate-300"
                }`}
                title={avatarPresenceActive ? "Active recently" : "No recent activity"}
              />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-semibold text-foreground">{conversation.customerDisplayName?.trim() || conversation.customerPhoneE164}</h2>
            <p className="truncate text-sm text-muted-foreground">{conversation.customerPhoneE164}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full border px-2 py-0.5 text-[11px] ${conversation.status === "OPEN" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600" : "border-amber-500/30 bg-amber-500/10 text-amber-600"}`}
                title={conversation.status === "OPEN" ? "Conversation is open" : "Conversation is closed"}
              >
                {conversation.status}
              </span>
              {isLatestMessageProofReady ? (
                <span
                  className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-600"
                  title="Latest inbound media/document can be used as payment proof"
                >
                  Proof ready
                </span>
              ) : null}
              {conversation.crmStageName ? (
                <span
                  className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[11px] text-primary"
                  title="Current pipeline stage"
                >
                  {conversation.crmStageName}
                </span>
              ) : null}
            </div>
          </div>
          <IndicatorLegend compact />
        </div>
        <div className="border-t border-border/70 px-4 py-4">
          <div className="space-y-2 text-sm">
            <div className="grid gap-2 text-xs text-muted-foreground">
              <p>Unread: {conversation.unreadCount}</p>
              <p>Last Activity: {formatDateTime(conversation.lastMessageAt)}</p>
              <p>Assigned Member: {conversation.assignedToMemberId || "Unassigned"}</p>
            </div>
            <div className="pt-3">
              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={onOpenInvoiceDrawer} size="sm" variant="outline" className="h-8 shadow-sm">
                  Create Invoice
                </Button>
                <Button type="button" onClick={() => void openAssignModal()} disabled={isAssigning} size="sm" variant="outline" className="h-8 shadow-sm">
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
            </div>
            <div>
              <p className="mb-1 text-xs text-muted-foreground">Business Category</p>
              <select
                value={leadSettings.businessCategory ?? ""}
                onChange={(event) => setLeadSettings((current) => ({ ...current, businessCategory: event.target.value || null }))}
                className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
              >
                <option value="">Set category</option>
                {businessCategorySelectOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <div className="mt-2 flex gap-2">
                <Input
                  value={newBusinessCategory}
                  onChange={(event) => setNewBusinessCategory(event.target.value)}
                  placeholder="Add new category"
                  className="h-10 rounded-xl"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="h-10 rounded-xl border border-border/80 bg-background"
                  onClick={handleAddBusinessCategory}
                  disabled={!newBusinessCategory.trim()}
                >
                  Add
                </Button>
              </div>
            </div>
            <Button type="submit" disabled={isSavingLeadSettings || isLoadingLeadSettings} className="h-10 w-full rounded-xl shadow-md shadow-primary/20">
              {isSavingLeadSettings ? "Saving..." : "Save Lead Settings"}
            </Button>
          </form>
          {isLoadingLeadSettings ? <p className="text-xs text-muted-foreground">Loading lead settings...</p> : null}
          {leadSettingsError ? <p className="text-xs text-destructive">{leadSettingsError}</p> : null}
          {crmError ? <p className="text-xs text-destructive">{crmError}</p> : null}
        </div>
      </AccordionCard>

      <AccordionCard id="crm-notes" title="Catatan Internal" icon={NotebookPen}>
        <div className="space-y-3">
          <textarea
            value={noteContent}
            onChange={(event) => setNoteContent(event.target.value)}
            placeholder="Catatan khusus pelanggan ini... (Tidak terkirim)"
            className="min-h-[112px] w-full rounded-2xl border border-amber-200 bg-amber-50/40 px-3 py-3 text-sm text-foreground outline-none transition focus:border-amber-300 focus:ring-2 focus:ring-amber-200/60"
          />
          <div className="flex justify-end">
            <Button type="button" disabled={isSavingNotes} size="sm" className="h-9 rounded-lg shadow-sm" variant="outline" onClick={() => void handleSaveNotes()}>
              {isSavingNotes ? "Saving..." : "Simpan Catatan"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Terhubung langsung ke field Notes pada data customer.</p>
          {crmError ? <p className="text-xs text-destructive">{crmError}</p> : null}
        </div>
      </AccordionCard>

      <AccordionCard id="crm-media" title="Media, Dokumen & Tautan" icon={ImageIcon}>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2 rounded-xl border border-border/70 bg-background/40 p-1">
            <button
              type="button"
              className={`h-8 rounded-lg text-xs font-medium transition ${activeMediaTab === "media" ? "bg-primary/12 text-primary" : "text-muted-foreground hover:bg-accent"}`}
              onClick={() => setActiveMediaTab("media")}
            >
              Media
            </button>
            <button
              type="button"
              className={`h-8 rounded-lg text-xs font-medium transition ${activeMediaTab === "documents" ? "bg-primary/12 text-primary" : "text-muted-foreground hover:bg-accent"}`}
              onClick={() => setActiveMediaTab("documents")}
            >
              Dokumen
            </button>
            <button
              type="button"
              className={`h-8 rounded-lg text-xs font-medium transition ${activeMediaTab === "links" ? "bg-primary/12 text-primary" : "text-muted-foreground hover:bg-accent"}`}
              onClick={() => setActiveMediaTab("links")}
            >
              Tautan
            </button>
          </div>

          {activeMediaTab === "media" ? (
            mediaOnlyItems.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/80 bg-background/50 px-4 py-6 text-center text-xs text-muted-foreground">Tidak ada media.</div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {mediaOnlyItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="group overflow-hidden rounded-xl border border-border/80 bg-background text-left hover:bg-accent/30"
                    onClick={() => {
                      setPreviewMediaUrl(item.safeMediaUrl ?? null);
                      setPreviewMediaType(item.type === "VIDEO" ? "VIDEO" : "IMAGE");
                      setPreviewMediaTitle(item.fileName ?? `${item.type} attachment`);
                    }}
                  >
                    <div className="relative aspect-[4/3] bg-muted/40">
                      {item.type === "IMAGE" ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.safeMediaUrl ?? ""} alt={item.fileName ?? "media"} className="h-full w-full object-cover transition group-hover:scale-[1.02]" />
                      ) : (
                        <video src={item.safeMediaUrl ?? ""} className="h-full w-full object-cover" muted />
                      )}
                    </div>
                    <div className="p-2">
                      <p className="truncate text-xs font-medium text-foreground">{item.fileName ?? `${item.type} attachment`}</p>
                      <p className="text-[11px] text-muted-foreground">{formatDateTime(item.createdAt)}</p>
                    </div>
                  </button>
                ))}
              </div>
            )
          ) : null}

          {activeMediaTab === "documents" ? (
            documentItems.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/80 bg-background/50 px-4 py-6 text-center text-xs text-muted-foreground">Tidak ada dokumen.</div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {documentItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="rounded-xl border border-border/80 bg-background p-3 text-left hover:bg-accent/30"
                    onClick={() => {
                      setPreviewMediaUrl(item.safeMediaUrl ?? null);
                      setPreviewMediaType("DOCUMENT");
                      setPreviewMediaTitle(item.fileName ?? "Document");
                    }}
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted/70 text-muted-foreground">
                      <FileText className="h-4 w-4" />
                    </div>
                    <p className="mt-2 line-clamp-2 text-xs font-medium text-foreground">{item.fileName ?? "Document"}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">{formatDateTime(item.createdAt)}</p>
                  </button>
                ))}
              </div>
            )
          ) : null}

          {activeMediaTab === "links" ? (
            links.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/80 bg-background/50 px-4 py-6 text-center text-xs text-muted-foreground">Tidak ada tautan.</div>
            ) : (
              <div className="grid grid-cols-1 gap-2">
                {links.map((link) => (
                  <button
                    key={link}
                    type="button"
                    className="rounded-xl border border-border/80 bg-background px-3 py-3 text-left hover:bg-accent/30"
                    onClick={() => {
                      setPreviewMediaUrl(link);
                      setPreviewMediaType("LINK");
                      setPreviewMediaTitle(link);
                    }}
                  >
                    <div className="flex items-start gap-2">
                      <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-lg bg-muted/70 text-muted-foreground">
                        <Link2 className="h-4 w-4" />
                      </div>
                      <span className="break-all text-xs text-primary underline underline-offset-2">{link}</span>
                    </div>
                  </button>
                ))}
              </div>
            )
          ) : null}
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

      {previewMediaUrl && previewMediaType ? (
        <div className="fixed inset-0 z-[75] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Preview media">
          <div className="w-full max-w-4xl rounded-2xl border border-border/80 bg-card p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="truncate text-sm font-medium text-foreground">{previewMediaTitle}</p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setPreviewMediaUrl(null);
                  setPreviewMediaType(null);
                }}
              >
                Close
              </Button>
            </div>
            <div className="rounded-xl border border-border/70 bg-background/50 p-3">
              {previewMediaType === "IMAGE" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previewMediaUrl} alt={previewMediaTitle} className="mx-auto max-h-[70vh] w-auto max-w-full rounded-lg object-contain" />
              ) : null}
              {previewMediaType === "VIDEO" ? (
                <video src={previewMediaUrl} controls className="mx-auto max-h-[70vh] w-auto max-w-full rounded-lg" />
              ) : null}
              {previewMediaType === "DOCUMENT" ? (
                <iframe src={previewMediaUrl} className="h-[70vh] w-full rounded-lg border border-border/70" title={previewMediaTitle} />
              ) : null}
              {previewMediaType === "LINK" ? (
                <div className="space-y-3 p-2">
                  <p className="break-all text-sm text-foreground">{previewMediaUrl}</p>
                  <a href={previewMediaUrl} target="_blank" rel="noreferrer" className="inline-flex rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-primary hover:bg-accent">
                    Open link
                  </a>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

    </aside>
  );
}
