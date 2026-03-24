"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowDown, ArrowUp, CalendarDays, ChevronDown, Inbox, Lock, Plus, Search, SlidersHorizontal, UserRound, Users } from "lucide-react";

import { BUSINESS_CATEGORY_OPTIONS, FOLLOW_UP_OPTIONS, LEAD_STATUS_OPTIONS, formatLeadSettingLabel } from "@/lib/crm/leadSettingsConfig";
import { subscribeToOrgMessageEvents } from "@/lib/ably/client";
import { fetchOrganizationsCached } from "@/lib/client/orgsCache";
import { notifyError, notifySuccess } from "@/lib/ui/notify";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle
} from "@/components/ui/drawer";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";

type LeadTag = {
  id: string;
  name: string;
  color: string;
  customerCount?: number;
};

type LeadAssignee = {
  memberId: string;
  userId: string;
  name: string;
  role: string;
};

type LeadRow = {
  id: string;
  displayName: string | null;
  phoneE164: string;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
  firstContactAt: string;
  source: string | null;
  leadStatus: string;
  followUpStatus: string | null;
  followUpAt: string | null;
  businessCategory: string | null;
  detail: string | null;
  projectValueCents: number;
  projectValueMode: "AUTO" | "MANUAL";
  remarks: string | null;
  assignedToMemberId: string | null;
  assignedToName: string | null;
  conversationCount: number;
  latestConversationId: string | null;
  crmStageId: string | null;
  crmStageName: string | null;
  tags: LeadTag[];
};

type PipelineStageOption = {
  stageId: string;
  stageName: string;
  stageColor: string;
  position: number;
};

type LeadChangeLog = {
  id: string;
  action: string;
  actorUserId: string | null;
  actorName: string | null;
  metaJson: string;
  createdAt: string;
};

type CustomersResponse = {
  data?: {
    customers?: LeadRow[];
    tags?: LeadTag[];
    assignees?: LeadAssignee[];
  };
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
  };
  error?: {
    message?: string;
  };
};

type LeadsCacheEntry = {
  leads: LeadRow[];
  assignees: LeadAssignee[];
  totalLeads: number;
  cachedAt: number;
};

type CustomerDetailResponse = {
  data?: {
    customer?: LeadRow;
    changelog?: LeadChangeLog[];
  };
  error?: {
    message?: string;
  };
};

type ApiError = {
  error?: {
    message?: string;
  };
};

type BulkAction = "SET_STATUS" | "SET_FOLLOW_UP" | "ASSIGN" | "DELETE";
type OrgItem = {
  id: string;
  name: string;
  role: string;
};

type FrozenFieldKey =
  | "name"
  | "phone"
  | "leadStatus"
  | "followUpStatus"
  | "businessCategory"
  | "detail"
  | "source"
  | "projectValueCents"
  | "remarks"
  | "assignedToMemberId";

type FrozenFieldState = Record<FrozenFieldKey, boolean>;

type ColumnKey =
  | "createdOn"
  | "name"
  | "whatsapp"
  | "businessCategory"
  | "detail"
  | "source"
  | "pipelineStage"
  | "followUp"
  | "statusLead"
  | "projectValue"
  | "remarks"
  | "assignee";

const FROZEN_FIELDS_STORAGE_KEY = "customers.leads.frozen-fields.v1";
const LEADS_TABLE_CONFIG_STORAGE_KEY = "customers.leads.table-config.v1";
const LEADS_QUERY_CACHE_TTL_MS = 30_000;
const PIPELINE_STAGES_CACHE_TTL_MS = 60_000;
const DEFAULT_COLUMN_ORDER: ColumnKey[] = [
  "createdOn",
  "name",
  "whatsapp",
  "businessCategory",
  "detail",
  "source",
  "pipelineStage",
  "followUp",
  "statusLead",
  "projectValue",
  "remarks",
  "assignee"
];
const DEFAULT_FROZEN_COLUMNS: ColumnKey[] = ["createdOn", "name", "whatsapp"];
const COLUMN_WIDTHS: Record<ColumnKey, number> = {
  createdOn: 176,
  name: 220,
  whatsapp: 170,
  businessCategory: 220,
  detail: 220,
  source: 130,
  pipelineStage: 180,
  followUp: 190,
  statusLead: 150,
  projectValue: 160,
  remarks: 280,
  assignee: 170
};
const SELECT_COLUMN_WIDTH = 44;
const STICKY_COLUMN_BORDER_WIDTH = 1;
const COLUMN_LABELS: Record<ColumnKey, string> = {
  createdOn: "Created On",
  name: "Name",
  whatsapp: "WhatsApp",
  businessCategory: "Business Category",
  detail: "Detail",
  source: "Source",
  pipelineStage: "Pipeline Stage",
  followUp: "Follow-up",
  statusLead: "Status Lead",
  projectValue: "Project Value",
  remarks: "Notes",
  assignee: "Assignee"
};
const INTERACTIVE_COLUMNS: ColumnKey[] = ["whatsapp", "businessCategory", "pipelineStage", "followUp", "statusLead"];
const CUSTOMERS_DATE_TIME_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit"
});
const CUSTOMERS_MONEY_FORMATTER = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0
});

const DEFAULT_FROZEN_FIELDS: FrozenFieldState = {
  name: false,
  phone: true,
  leadStatus: false,
  followUpStatus: false,
  businessCategory: false,
  detail: false,
  source: false,
  projectValueCents: false,
  remarks: false,
  assignedToMemberId: false
};

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return CUSTOMERS_DATE_TIME_FORMATTER.format(date);
}

function formatMoney(cents: number): string {
  return CUSTOMERS_MONEY_FORMATTER.format(Math.max(0, cents) / 100);
}

function formatLabel(value: string | null | undefined): string {
  if (!value) {
    return "-";
  }

  return formatLeadSettingLabel(value);
}

function renderToneBadge(value: string, kind: "status" | "followup" | "source" = "status") {
  const normalized = value.toUpperCase();

  if (kind === "followup") {
    if (normalized === "CHAT") return <Badge className="rounded-full bg-amber-400 text-white hover:bg-amber-400">Chat</Badge>;
    if (normalized === "CALL") return <Badge className="rounded-full bg-violet-500 text-white hover:bg-violet-500">Call</Badge>;
    if (normalized === "MEETING") return <Badge className="rounded-full bg-orange-500 text-white hover:bg-orange-500">Meeting</Badge>;
    if (normalized === "PENAWARAN") return <Badge className="rounded-full bg-cyan-500 text-white hover:bg-cyan-500">Penawaran</Badge>;
    if (normalized === "DEALING") return <Badge className="rounded-full bg-emerald-600 text-white hover:bg-emerald-600">Dealing</Badge>;
    if (normalized === "BLUEPRINT") return <Badge className="rounded-full bg-pink-500 text-white hover:bg-pink-500">Blueprint</Badge>;
    return <Badge className="rounded-full bg-blue-500 text-white hover:bg-blue-500">Wait Response</Badge>;
  }

  if (kind === "source") {
    return (
      <Badge variant="outline" className="rounded-full border-border/70 bg-background">
        <Inbox className="mr-1.5 h-3 w-3" />
        {formatLabel(value)}
      </Badge>
    );
  }

  if (normalized === "PROSPECT") return <Badge className="rounded-full bg-red-500 text-white hover:bg-red-500">Prospect</Badge>;
  if (normalized === "ACTIVE_CLIENT") return <Badge className="rounded-full bg-lime-500 text-white hover:bg-lime-500">Active Client</Badge>;
  if (normalized === "UNQUALIFIED") return <Badge className="rounded-full bg-slate-600 text-white hover:bg-slate-600">Unqualified</Badge>;
  if (normalized === "REMARKETING") return <Badge className="rounded-full bg-fuchsia-500 text-white hover:bg-fuchsia-500">Remarketing</Badge>;
  if (normalized === "OLD_CLIENT") return <Badge className="rounded-full bg-amber-700 text-white hover:bg-amber-700">Old Client</Badge>;
  if (normalized === "PARTNERSHIP") return <Badge className="rounded-full bg-rose-300 text-white hover:bg-rose-300">Partnership</Badge>;
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
  return (
    <Badge className={`rounded-full ${tone}`} title={name}>
      {name}
    </Badge>
  );
}

function readFrozenFieldsFromStorage(): FrozenFieldState {
  if (typeof window === "undefined") {
    return DEFAULT_FROZEN_FIELDS;
  }

  try {
    const raw = window.localStorage.getItem(FROZEN_FIELDS_STORAGE_KEY);
    if (!raw) {
      return DEFAULT_FROZEN_FIELDS;
    }
    const parsed = JSON.parse(raw) as Partial<FrozenFieldState>;
    return {
      ...DEFAULT_FROZEN_FIELDS,
      ...parsed,
      name: false,
      phone: true
    };
  } catch {
    return DEFAULT_FROZEN_FIELDS;
  }
}

function writeFrozenFieldsToStorage(value: FrozenFieldState) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(FROZEN_FIELDS_STORAGE_KEY, JSON.stringify(value));
}

function readTableConfigFromStorage(): { columnOrder: ColumnKey[]; frozenColumns: ColumnKey[] } {
  if (typeof window === "undefined") {
    return {
      columnOrder: DEFAULT_COLUMN_ORDER,
      frozenColumns: DEFAULT_FROZEN_COLUMNS
    };
  }

  try {
    const raw = window.localStorage.getItem(LEADS_TABLE_CONFIG_STORAGE_KEY);
    if (!raw) {
      return {
        columnOrder: DEFAULT_COLUMN_ORDER,
        frozenColumns: DEFAULT_FROZEN_COLUMNS
      };
    }

    const parsed = JSON.parse(raw) as {
      columnOrder?: ColumnKey[];
      frozenColumns?: ColumnKey[];
    };
    const order = Array.isArray(parsed.columnOrder) ? parsed.columnOrder : DEFAULT_COLUMN_ORDER;
    const normalizedOrder = DEFAULT_COLUMN_ORDER.filter((key) => order.includes(key));
    for (const key of DEFAULT_COLUMN_ORDER) {
      if (!normalizedOrder.includes(key)) {
        normalizedOrder.push(key);
      }
    }
    const frozen = Array.isArray(parsed.frozenColumns) ? parsed.frozenColumns.filter((key) => normalizedOrder.includes(key)) : DEFAULT_FROZEN_COLUMNS;
    return {
      columnOrder: normalizedOrder,
      frozenColumns: frozen
    };
  } catch {
    return {
      columnOrder: DEFAULT_COLUMN_ORDER,
      frozenColumns: DEFAULT_FROZEN_COLUMNS
    };
  }
}

function writeTableConfigToStorage(config: { columnOrder: ColumnKey[]; frozenColumns: ColumnKey[] }) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LEADS_TABLE_CONFIG_STORAGE_KEY, JSON.stringify(config));
}

export function CustomersWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const openedDeepLinkLeadIdRef = useRef<string | null>(null);
  const leadsQueryCacheRef = useRef<Map<string, LeadsCacheEntry>>(new Map());
  const hasPrimedDefaultLeadsRef = useRef(false);
  const leadsRef = useRef<LeadRow[]>([]);
  const leadsRequestIdRef = useRef(0);
  const isMountedRef = useRef(true);
  const leadsInFlightRef = useRef<{
    key: string;
    promise: Promise<void>;
  } | null>(null);
  const lastRealtimeRefreshAtRef = useRef(0);
  const leadsAbortControllerRef = useRef<AbortController | null>(null);
  const pipelineStagesCacheRef = useRef<Map<string, { pipelineId: string | null; stages: PipelineStageOption[]; cachedAt: number }>>(new Map());
  const pipelineStagesInFlightRef = useRef<{
    key: string;
    promise: Promise<void>;
  } | null>(null);
  const pipelineStagesAbortControllerRef = useRef<AbortController | null>(null);

  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [orgs, setOrgs] = useState<OrgItem[]>([]);
  const [hasLoadedOrganizations, setHasLoadedOrganizations] = useState(false);
  const [assignees, setAssignees] = useState<LeadAssignee[]>([]);
  const [totalLeads, setTotalLeads] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(30);

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshingLeads, setIsRefreshingLeads] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("__all__");
  const [sourceFilter, setSourceFilter] = useState("__all__");
  const [pipelineStageFilter, setPipelineStageFilter] = useState("__all__");
  const [assigneeFilter, setAssigneeFilter] = useState("__all__");
  const [pipelineId, setPipelineId] = useState<string | null>(null);
  const [pipelineStages, setPipelineStages] = useState<PipelineStageOption[]>([]);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState<BulkAction | "">("");
  const [bulkValue, setBulkValue] = useState("");
  const [isApplyingBulk, setIsApplyingBulk] = useState(false);
  const [isInlineUpdating, setIsInlineUpdating] = useState(false);
  const [tableColumnOrder, setTableColumnOrder] = useState<ColumnKey[]>(DEFAULT_COLUMN_ORDER);
  const [frozenColumns, setFrozenColumns] = useState<ColumnKey[]>(DEFAULT_FROZEN_COLUMNS);
  const [draftTableColumnOrder, setDraftTableColumnOrder] = useState<ColumnKey[]>(DEFAULT_COLUMN_ORDER);
  const [draftFrozenColumns, setDraftFrozenColumns] = useState<ColumnKey[]>(DEFAULT_FROZEN_COLUMNS);
  const [isTableLayoutDialogOpen, setIsTableLayoutDialogOpen] = useState(false);
  const [isAddCategoryDialogOpen, setIsAddCategoryDialogOpen] = useState(false);
  const [addCategoryTargetLeadId, setAddCategoryTargetLeadId] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState("");

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSavingAdd, setIsSavingAdd] = useState(false);
  const [addName, setAddName] = useState("");
  const [addPhone, setAddPhone] = useState("");
  const [addStatus, setAddStatus] = useState("NEW_LEAD");
  const [addSource, setAddSource] = useState("INBOX");
  const [addCategory, setAddCategory] = useState("");
  const [addDetail, setAddDetail] = useState("");
  const [addFollowUp, setAddFollowUp] = useState("WAIT_RESPON");
  const [addFollowUpDate, setAddFollowUpDate] = useState("");
  const [addFollowUpTime, setAddFollowUpTime] = useState("09:00");
  const [addRemarks, setAddRemarks] = useState("");
  const [addAssignee, setAddAssignee] = useState("");
  const [addProjectValue, setAddProjectValue] = useState("");

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [selectedLead, setSelectedLead] = useState<LeadRow | null>(null);
  const [leadChangeLog, setLeadChangeLog] = useState<LeadChangeLog[]>([]);
  const [isLeadSaving, setIsLeadSaving] = useState(false);
  const [isLeadLoading, setIsLeadLoading] = useState(false);

  const [frozenFields, setFrozenFields] = useState<FrozenFieldState>(DEFAULT_FROZEN_FIELDS);
  const [isFrozenDialogOpen, setIsFrozenDialogOpen] = useState(false);

  const totalPages = Math.max(1, Math.ceil(totalLeads / pageSize));

  const visibleLeads = useMemo(() => leads, [leads]);
  const activeBusiness = useMemo(() => orgs[0] ?? null, [orgs]);

  const selectedLeadIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const allPageSelected = visibleLeads.length > 0 && visibleLeads.every((lead) => selectedLeadIdSet.has(lead.id));

  const sources = useMemo(() => {
    const sourceSet = new Set<string>();
    for (const lead of leads) {
      if (lead.source?.trim()) {
        sourceSet.add(lead.source.trim());
      }
    }
    return Array.from(sourceSet).sort((a, b) => a.localeCompare(b));
  }, [leads]);

  const fetchLeads = useCallback(
    async (options?: { force?: boolean }) => {
      if (!isMountedRef.current) {
        return;
      }
      const params = new URLSearchParams({
        page: String(page),
        limit: String(pageSize),
        light: "1"
      });
      if (searchQuery.trim()) params.set("q", searchQuery.trim());
      if (statusFilter !== "__all__") params.set("leadStatus", statusFilter);
      if (sourceFilter !== "__all__") params.set("source", sourceFilter);
      if (assigneeFilter !== "__all__") params.set("assignedToMemberId", assigneeFilter);
      if (pipelineStageFilter === "__none__") {
        params.set("crmStageUnassigned", "1");
      } else if (pipelineStageFilter !== "__all__") {
        params.set("crmStageId", pipelineStageFilter);
      }
      const queryKey = params.toString();
      const orgId = activeBusiness?.id ?? "";
      const requestPath = `/api/customers?${queryKey}${orgId ? `&orgId=${encodeURIComponent(orgId)}` : ""}`;
      const requestKey = `${orgId}::${queryKey}`;
      if (!options?.force && leadsInFlightRef.current?.key === requestKey) {
        await leadsInFlightRef.current.promise;
        return;
      }

      const cached = leadsQueryCacheRef.current.get(requestKey);
      if (cached) {
        setLeads(cached.leads);
        setAssignees(cached.assignees);
        setTotalLeads(cached.totalLeads);
      }
      const isCacheFresh = Boolean(cached && Date.now() - cached.cachedAt < LEADS_QUERY_CACHE_TTL_MS);
      if (isCacheFresh && !options?.force) {
        setIsLoading(false);
        return;
      }

      const requestId = ++leadsRequestIdRef.current;

      if (leadsRef.current.length === 0 && !cached) {
        setIsLoading(true);
      } else {
        setIsRefreshingLeads(true);
      }
      setError(null);

      const fetchPromise = (async () => {
        const abortController = new AbortController();
        leadsAbortControllerRef.current?.abort();
        leadsAbortControllerRef.current = abortController;
        try {
          const response = await fetch(requestPath, { cache: "no-store", signal: abortController.signal });
          const payload = (await response.json().catch(() => null)) as CustomersResponse | null;
          if (!isMountedRef.current || requestId !== leadsRequestIdRef.current) {
            return;
          }
          if (!response.ok) {
            throw new Error(payload?.error?.message ?? "Failed to load leads.");
          }

          const nextLeads = payload?.data?.customers ?? [];
          const nextAssignees = payload?.data?.assignees ?? [];
          const nextTotalLeads = payload?.meta?.total ?? 0;

          leadsQueryCacheRef.current.set(requestKey, {
            leads: nextLeads,
            assignees: nextAssignees,
            totalLeads: nextTotalLeads,
            cachedAt: Date.now()
          });

          setLeads(nextLeads);
          setAssignees(nextAssignees);
          setTotalLeads(nextTotalLeads);
        } catch (loadError) {
          if (loadError instanceof DOMException && loadError.name === "AbortError") {
            return;
          }
          if (!isMountedRef.current || requestId !== leadsRequestIdRef.current) {
            return;
          }
          setError(toErrorMessage(loadError, "Failed to load leads."));
        } finally {
          if (leadsAbortControllerRef.current === abortController) {
            leadsAbortControllerRef.current = null;
          }
          if (leadsInFlightRef.current?.key === requestKey) {
            leadsInFlightRef.current = null;
          }
          if (!isMountedRef.current || requestId !== leadsRequestIdRef.current) {
            return;
          }
          setIsLoading(false);
          setIsRefreshingLeads(false);
        }
      })();
      leadsInFlightRef.current = {
        key: requestKey,
        promise: fetchPromise
      };
      await fetchPromise;
    },
    [activeBusiness?.id, page, pageSize, searchQuery, statusFilter, sourceFilter, assigneeFilter, pipelineStageFilter]
  );

  const primeDefaultLeadsCache = useCallback(async () => {
    if (hasPrimedDefaultLeadsRef.current) {
      return;
    }
    const orgId = activeBusiness?.id ?? "";
    if (!orgId) {
      return;
    }
    hasPrimedDefaultLeadsRef.current = true;

    const params = new URLSearchParams({
      page: "1",
      limit: "30",
      light: "1"
    });
    const queryKey = params.toString();
    const cacheKey = `${orgId}::${queryKey}`;
    if (leadsInFlightRef.current?.key === cacheKey) {
      await leadsInFlightRef.current.promise;
      return;
    }
    const cached = leadsQueryCacheRef.current.get(cacheKey);
    if (cached && Date.now() - cached.cachedAt < LEADS_QUERY_CACHE_TTL_MS) {
      return;
    }

    try {
      const response = await fetch(`/api/customers?${queryKey}&orgId=${encodeURIComponent(orgId)}`, { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as CustomersResponse | null;
      if (!response.ok) {
        return;
      }
      leadsQueryCacheRef.current.set(cacheKey, {
        leads: payload?.data?.customers ?? [],
        assignees: payload?.data?.assignees ?? [],
        totalLeads: payload?.meta?.total ?? 0,
        cachedAt: Date.now()
      });
    } catch {
      // ignore background prefetch error
    }
  }, [activeBusiness?.id]);

  const loadPipelineStages = useCallback(async () => {
    try {
      const orgId = activeBusiness?.id ?? "";
      if (!orgId) {
        setPipelineId(null);
        setPipelineStages([]);
        return;
      }

      const cached = pipelineStagesCacheRef.current.get(orgId);
      if (cached && Date.now() - cached.cachedAt < PIPELINE_STAGES_CACHE_TTL_MS) {
        setPipelineId(cached.pipelineId);
        setPipelineStages(cached.stages);
        return;
      }

      if (pipelineStagesInFlightRef.current?.key === orgId) {
        await pipelineStagesInFlightRef.current.promise;
        return;
      }

      const abortController = new AbortController();
      const requestPromise = (async () => {
      pipelineStagesAbortControllerRef.current?.abort();
      pipelineStagesAbortControllerRef.current = abortController;
      const response = await fetch(`/api/crm/pipelines${orgId ? `?orgId=${encodeURIComponent(orgId)}` : ""}`, {
        cache: "no-store",
        signal: abortController.signal
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            data?: {
              pipelines?: Array<{
                id: string;
                name: string;
                isDefault: boolean;
                stages?: Array<{ id: string; name: string; color: string; position: number }>;
              }>;
            };
            error?: { message?: string };
          }
        | null;
      if (!response.ok) {
        throw new Error(payload?.error?.message ?? "Failed to load CRM pipeline stages.");
      }

      const pipelines = payload?.data?.pipelines ?? [];
      const selectedPipeline = pipelines.find((pipeline) => pipeline.isDefault) ?? pipelines[0] ?? null;
      const nextStages = (selectedPipeline?.stages ?? [])
        .map((stage) => ({
          stageId: stage.id,
          stageName: stage.name,
          stageColor: stage.color,
          position: stage.position
        }))
        .sort((a, b) => a.position - b.position);
      pipelineStagesCacheRef.current.set(orgId, {
        pipelineId: selectedPipeline?.id ?? null,
        stages: nextStages,
        cachedAt: Date.now()
      });
      setPipelineId(selectedPipeline?.id ?? null);
      setPipelineStages(nextStages);
      })().finally(() => {
        if (pipelineStagesAbortControllerRef.current === abortController) {
          pipelineStagesAbortControllerRef.current = null;
        }
        if (pipelineStagesInFlightRef.current?.key === orgId) {
          pipelineStagesInFlightRef.current = null;
        }
      });
      pipelineStagesInFlightRef.current = {
        key: orgId,
        promise: requestPromise
      };
      await requestPromise;
    } catch (pipelineError) {
      if (pipelineError instanceof DOMException && pipelineError.name === "AbortError") {
        return;
      }
      setError(toErrorMessage(pipelineError, "Failed to load CRM pipeline stages."));
    }
  }, [activeBusiness?.id]);

  const loadOrganizations = useCallback(async () => {
    try {
      const organizations = (await fetchOrganizationsCached()) as OrgItem[];
      setOrgs(organizations);
    } finally {
      setHasLoadedOrganizations(true);
    }
  }, []);

  useEffect(() => {
    setFrozenFields(readFrozenFieldsFromStorage());
    const tableConfig = readTableConfigFromStorage();
    setTableColumnOrder(tableConfig.columnOrder);
    setFrozenColumns(tableConfig.frozenColumns);
    void loadOrganizations().catch((loadError) => {
      setError(toErrorMessage(loadError, "Failed to load organizations."));
    });
  }, [loadOrganizations]);

  useEffect(() => {
    if (!hasLoadedOrganizations) {
      return;
    }
    void fetchLeads();
  }, [fetchLeads, hasLoadedOrganizations]);

  useEffect(() => {
    if (!hasLoadedOrganizations) {
      return;
    }
    void loadPipelineStages();
  }, [activeBusiness?.id, hasLoadedOrganizations, loadPipelineStages]);

  useEffect(() => {
    leadsRef.current = leads;
  }, [leads]);

  useEffect(() => {
    if (!hasLoadedOrganizations || !activeBusiness?.id) {
      return;
    }

    let active = true;
    let cleanup: (() => void) | null = null;
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    let fallbackTimer: ReturnType<typeof setInterval> | null = null;

    const scheduleRefresh = () => {
      if (refreshTimer) {
        clearTimeout(refreshTimer);
      }

      refreshTimer = setTimeout(() => {
        if (!active) {
          return;
        }
        if (leadsInFlightRef.current) {
          return;
        }
        if (Date.now() - lastRealtimeRefreshAtRef.current < 900) {
          return;
        }
        lastRealtimeRefreshAtRef.current = Date.now();
        void fetchLeads({ force: true });
      }, 220);
    };

    const startSubscription = async () => {
      try {
        cleanup = await subscribeToOrgMessageEvents({
          orgId: activeBusiness.id,
          onMessageNew: scheduleRefresh,
          onConversationUpdated: scheduleRefresh,
          onAssignmentChanged: scheduleRefresh,
          onInvoiceCreated: scheduleRefresh,
          onInvoiceUpdated: scheduleRefresh,
          onInvoicePaid: scheduleRefresh,
          onProofAttached: scheduleRefresh,
          onCustomerUpdated: scheduleRefresh,
          onStorageUpdated: scheduleRefresh
        });
      } catch (subscriptionError) {
        const message = subscriptionError instanceof Error ? subscriptionError.message : "Unknown realtime subscribe error";
        console.error(`[realtime] customers subscription failed: ${message}`);
      }
    };

    void startSubscription();

    fallbackTimer = setInterval(() => {
      if (!active || leadsInFlightRef.current) {
        return;
      }
      void fetchLeads({ force: true });
    }, 20000);

    return () => {
      active = false;
      if (refreshTimer) {
        clearTimeout(refreshTimer);
      }
      if (fallbackTimer) {
        clearInterval(fallbackTimer);
      }
      if (cleanup) {
        cleanup();
      }
    };
  }, [activeBusiness?.id, fetchLeads, hasLoadedOrganizations]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      leadsAbortControllerRef.current?.abort();
      pipelineStagesAbortControllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (hasPrimedDefaultLeadsRef.current) {
      return;
    }

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let idleId: number | null = null;
    const runPrefetch = () => {
      void primeDefaultLeadsCache();
    };

    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      idleId = window.requestIdleCallback(runPrefetch, { timeout: 1200 });
    } else {
      timeoutId = globalThis.setTimeout(runPrefetch, 600);
    }

    return () => {
      if (idleId !== null && typeof window !== "undefined" && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(idleId);
      }
      if (timeoutId !== null) {
        globalThis.clearTimeout(timeoutId);
      }
    };
  }, [primeDefaultLeadsCache]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearchQuery(searchInput.trim());
      setPage(1);
    }, 250);

    return () => {
      window.clearTimeout(timer);
    };
  }, [searchInput]);

  useEffect(() => {
    if (selectedIds.length === 0) return;
    const validSet = new Set(visibleLeads.map((lead) => lead.id));
    setSelectedIds((current) => current.filter((id) => validSet.has(id)));
  }, [visibleLeads, selectedIds.length]);

  useEffect(() => {
    if (pipelineStageFilter === "__all__" || pipelineStageFilter === "__none__") {
      return;
    }
    const isValidStage = pipelineStages.some((stage) => stage.stageId === pipelineStageFilter);
    if (!isValidStage) {
      setPipelineStageFilter("__all__");
    }
  }, [pipelineStageFilter, pipelineStages]);

  useEffect(() => {
    if (!error) return;
    notifyError(error);
  }, [error]);

  useEffect(() => {
    if (!success) return;
    notifySuccess(success);
  }, [success]);

  const openLeadDrawer = useCallback(async (leadId: string) => {
    setIsDrawerOpen(true);
    setIsLeadLoading(true);
    setError(null);
    setSelectedLeadId(leadId);
    try {
      const response = await fetch(`/api/customers/${encodeURIComponent(leadId)}`, { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as CustomerDetailResponse | null;
      if (!response.ok || !payload?.data?.customer) {
        throw new Error(payload?.error?.message ?? "Failed to load lead detail.");
      }
      setSelectedLead(payload.data.customer);
      setLeadChangeLog(payload.data.changelog ?? []);
    } catch (detailError) {
      setError(toErrorMessage(detailError, "Failed to load lead detail."));
      setIsDrawerOpen(false);
    } finally {
      setIsLeadLoading(false);
    }
  }, []);

  useEffect(() => {
    const deepLinkLeadId = searchParams.get("leadId")?.trim() ?? "";
    if (!deepLinkLeadId) {
      openedDeepLinkLeadIdRef.current = null;
      return;
    }
    if (openedDeepLinkLeadIdRef.current === deepLinkLeadId) {
      return;
    }
    openedDeepLinkLeadIdRef.current = deepLinkLeadId;
    void openLeadDrawer(deepLinkLeadId);
  }, [openLeadDrawer, searchParams]);

  const toggleSelectAllRows = useCallback((checked: boolean) => {
    if (!checked) {
      setSelectedIds([]);
      return;
    }
    setSelectedIds(visibleLeads.map((lead) => lead.id));
  }, [visibleLeads]);

  const toggleRowSelection = useCallback((leadId: string, checked: boolean) => {
    setSelectedIds((current) => {
      if (checked) {
        return Array.from(new Set([...current, leadId]));
      }
      return current.filter((id) => id !== leadId);
    });
  }, []);

  const openOrCreateConversation = useCallback(async (lead: LeadRow) => {
    try {
      if (lead.latestConversationId) {
        router.push(`/inbox?conversationId=${encodeURIComponent(lead.latestConversationId)}`);
        return;
      }

      const response = await fetch("/api/conversations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          phoneE164: lead.phoneE164,
          customerDisplayName: lead.displayName ?? undefined
        })
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            data?: {
              conversation?: {
                id?: string;
              };
            };
            error?: {
              message?: string;
            };
          }
        | null;
      if (!response.ok || !payload?.data?.conversation?.id) {
        throw new Error(payload?.error?.message ?? "Failed to open inbox conversation.");
      }

      router.push(`/inbox?conversationId=${encodeURIComponent(payload.data.conversation.id)}`);
    } catch (openError) {
      setError(toErrorMessage(openError, "Failed to open inbox conversation."));
    }
  }, [router]);

  const moveLeadToPipelineStage = useCallback(async (lead: LeadRow, stageId: string) => {
    if (!pipelineId) {
      setError("Pipeline is not configured yet.");
      return;
    }

    try {
      setIsInlineUpdating(true);
      setError(null);
      let conversationId = lead.latestConversationId;

      if (!conversationId) {
        const createResponse = await fetch("/api/conversations", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            phoneE164: lead.phoneE164,
            customerDisplayName: lead.displayName ?? undefined
          })
        });
        const createPayload = (await createResponse.json().catch(() => null)) as
          | {
              data?: {
                conversation?: {
                  id?: string;
                };
              };
              error?: {
                message?: string;
              };
            }
          | null;
        if (!createResponse.ok || !createPayload?.data?.conversation?.id) {
          throw new Error(createPayload?.error?.message ?? "Failed to create conversation for pipeline move.");
        }
        conversationId = createPayload.data.conversation.id;
      }

      const moveResponse = await fetch(`/api/conversations/${encodeURIComponent(conversationId)}/pipeline`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          pipelineId,
          stageId
        })
      });
      const movePayload = (await moveResponse.json().catch(() => null)) as ApiError | null;
      if (!moveResponse.ok) {
        throw new Error(movePayload?.error?.message ?? "Failed to move lead to selected pipeline stage.");
      }

      setSuccess("Lead moved to selected pipeline stage.");
      await fetchLeads({ force: true });
    } catch (moveError) {
      setError(toErrorMessage(moveError, "Failed to move lead to pipeline stage."));
    } finally {
      setIsInlineUpdating(false);
    }
  }, [fetchLeads, pipelineId]);

  const quickUpdateLead = useCallback(async (leadId: string, payload: Record<string, unknown>, successMessage?: string) => {
    try {
      setIsInlineUpdating(true);
      setError(null);
      const response = await fetch(`/api/customers/${encodeURIComponent(leadId)}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
      const result = (await response.json().catch(() => null)) as ApiError | null;
      if (!response.ok) {
        throw new Error(result?.error?.message ?? "Failed to update lead.");
      }
      if (successMessage) {
        setSuccess(successMessage);
      }
      await fetchLeads({ force: true });
    } catch (updateError) {
      setError(toErrorMessage(updateError, "Failed to update lead."));
    } finally {
      setIsInlineUpdating(false);
    }
  }, [fetchLeads]);

  async function handleCreateCustomCategory() {
    const category = newCategoryName.trim();
    const targetLeadId = addCategoryTargetLeadId;
    if (!category || !targetLeadId) {
      return;
    }

    await quickUpdateLead(targetLeadId, { businessCategory: category }, "Business category updated.");
    setNewCategoryName("");
    setAddCategoryTargetLeadId(null);
    setIsAddCategoryDialogOpen(false);
  }

  async function handleCreateLead() {
    if (!addPhone.trim()) {
      setError("WhatsApp number is required.");
      return;
    }

    try {
      setIsSavingAdd(true);
      setError(null);
      setSuccess(null);
      let followUpAt: string | undefined;
      if (addFollowUpDate.trim()) {
        const candidate = new Date(`${addFollowUpDate}T${addFollowUpTime || "09:00"}:00`);
        if (!Number.isNaN(candidate.getTime())) {
          followUpAt = candidate.toISOString();
        }
      }

      const response = await fetch("/api/customers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: addName,
          phoneE164: addPhone,
          source: addSource,
          leadStatus: addStatus,
          followUpStatus: addFollowUp,
          followUpAt,
          businessCategory: addCategory || undefined,
          detail: addDetail || undefined,
          remarks: addRemarks || undefined,
          assignedToMemberId: addAssignee || undefined,
          projectValueCents: addProjectValue.trim() ? Number(addProjectValue.trim()) * 100 : undefined
        })
      });
      const payload = (await response.json().catch(() => null)) as ApiError | null;
      if (!response.ok) {
        throw new Error(payload?.error?.message ?? "Failed to create lead.");
      }

      setIsAddModalOpen(false);
      setAddName("");
      setAddPhone("");
      setAddStatus("NEW_LEAD");
      setAddSource("INBOX");
      setAddCategory("");
      setAddDetail("");
      setAddFollowUp("WAIT_RESPON");
      setAddFollowUpDate("");
      setAddFollowUpTime("09:00");
      setAddRemarks("");
      setAddAssignee("");
      setAddProjectValue("");
      setSuccess("Lead created.");

      if (page !== 1) {
        setPage(1);
      } else {
        await fetchLeads({ force: true });
      }
    } catch (saveError) {
      setError(toErrorMessage(saveError, "Failed to create lead."));
    } finally {
      setIsSavingAdd(false);
    }
  }

  async function handleBulkApply() {
    if (selectedIds.length === 0 || !bulkAction) {
      return;
    }

    try {
      setIsApplyingBulk(true);
      setError(null);
      setSuccess(null);

      const body: Record<string, unknown> = {
        customerIds: selectedIds,
        action: bulkAction
      };

      if (bulkAction === "SET_STATUS") body.leadStatus = bulkValue;
      if (bulkAction === "SET_FOLLOW_UP") body.followUpStatus = bulkValue;
      if (bulkAction === "ASSIGN") body.assignedToMemberId = bulkValue;

      const response = await fetch("/api/customers/bulk", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      });
      const payload = (await response.json().catch(() => null)) as ApiError | null;
      if (!response.ok) {
        throw new Error(payload?.error?.message ?? "Failed to apply bulk action.");
      }

      setSelectedIds([]);
      setBulkAction("");
      setBulkValue("");
      setSuccess("Bulk action applied.");
      await fetchLeads({ force: true });
    } catch (bulkError) {
      setError(toErrorMessage(bulkError, "Failed to apply bulk action."));
    } finally {
      setIsApplyingBulk(false);
    }
  }

  async function handleLeadSave() {
    if (!selectedLeadId || !selectedLead) {
      return;
    }

    try {
      setIsLeadSaving(true);
      setError(null);
      setSuccess(null);

      const response = await fetch(`/api/customers/${encodeURIComponent(selectedLeadId)}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: selectedLead.displayName,
          phoneE164: selectedLead.phoneE164,
          source: selectedLead.source,
          leadStatus: selectedLead.leadStatus,
          followUpStatus: selectedLead.followUpStatus,
          followUpAt: selectedLead.followUpAt,
          businessCategory: selectedLead.businessCategory,
          detail: selectedLead.detail,
          projectValueCents: selectedLead.projectValueCents,
          remarks: selectedLead.remarks,
          assignedToMemberId: selectedLead.assignedToMemberId
        })
      });
      const payload = (await response.json().catch(() => null)) as ApiError | null;
      if (!response.ok) {
        throw new Error(payload?.error?.message ?? "Failed to save lead.");
      }

      if (selectedLead.crmStageId && pipelineId) {
        let conversationId = selectedLead.latestConversationId;

        if (!conversationId) {
          const createConversationResponse = await fetch("/api/conversations", {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              phoneE164: selectedLead.phoneE164,
              customerDisplayName: selectedLead.displayName ?? undefined
            })
          });
          const createConversationPayload = (await createConversationResponse.json().catch(() => null)) as
            | {
                data?: {
                  conversation?: {
                    id?: string;
                  };
                };
                error?: {
                  message?: string;
                };
              }
            | null;
          if (!createConversationResponse.ok || !createConversationPayload?.data?.conversation?.id) {
            throw new Error(createConversationPayload?.error?.message ?? "Failed to create conversation for pipeline move.");
          }

          conversationId = createConversationPayload.data.conversation.id;
        }

        const moveResponse = await fetch(`/api/conversations/${encodeURIComponent(conversationId)}/pipeline`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            pipelineId,
            stageId: selectedLead.crmStageId
          })
        });
        const movePayload = (await moveResponse.json().catch(() => null)) as ApiError | null;
        if (!moveResponse.ok) {
          throw new Error(movePayload?.error?.message ?? "Failed to move lead to selected pipeline stage.");
        }
      }

      setSuccess("Lead updated.");
      await fetchLeads({ force: true });
      await openLeadDrawer(selectedLeadId);
    } catch (saveError) {
      setError(toErrorMessage(saveError, "Failed to save lead."));
    } finally {
      setIsLeadSaving(false);
    }
  }

  function updateSelectedLead<K extends keyof LeadRow>(key: K, value: LeadRow[K]) {
    setSelectedLead((current) => {
      if (!current) return current;
      return {
        ...current,
        [key]: value
      };
    });
  }

  function moveDraftColumn(columnKey: ColumnKey, direction: "up" | "down") {
    setDraftTableColumnOrder((current) => {
      const index = current.indexOf(columnKey);
      if (index < 0) return current;
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= current.length) {
        return current;
      }
      const next = [...current];
      const [item] = next.splice(index, 1);
      next.splice(targetIndex, 0, item);
      return next;
    });
  }

  function toggleDraftFrozenColumn(columnKey: ColumnKey, checked: boolean) {
    setDraftFrozenColumns((current) => (checked ? Array.from(new Set([...current, columnKey])) : current.filter((key) => key !== columnKey)));
  }

  function openTableLayoutDialog() {
    setDraftTableColumnOrder(tableColumnOrder);
    setDraftFrozenColumns(frozenColumns);
    setIsTableLayoutDialogOpen(true);
  }

  function handleSaveTableLayout() {
    setTableColumnOrder(draftTableColumnOrder);
    setFrozenColumns(draftFrozenColumns);
    writeTableConfigToStorage({
      columnOrder: draftTableColumnOrder,
      frozenColumns: draftFrozenColumns
    });
    setIsTableLayoutDialogOpen(false);
  }

  const resetListFilters = useCallback(() => {
    setSearchInput("");
    setSearchQuery("");
    setStatusFilter("__all__");
    setSourceFilter("__all__");
    setAssigneeFilter("__all__");
    setPipelineStageFilter("__all__");
    setPage(1);
  }, []);

  const stickyOffsetMap = useMemo(() => {
    const offsets = new Map<ColumnKey, number>();
    let left = SELECT_COLUMN_WIDTH + STICKY_COLUMN_BORDER_WIDTH;
    for (const key of tableColumnOrder) {
      if (frozenColumns.includes(key)) {
        offsets.set(key, left);
        left += COLUMN_WIDTHS[key] + STICKY_COLUMN_BORDER_WIDTH;
      }
    }
    return offsets;
  }, [frozenColumns, tableColumnOrder]);

  const setFollowUpDate = useCallback(async (lead: LeadRow, date: Date | undefined) => {
    if (!date) {
      await quickUpdateLead(lead.id, { followUpAt: null });
      return;
    }
    const current = lead.followUpAt ? new Date(lead.followUpAt) : new Date();
    const next = new Date(date);
    next.setHours(current.getHours() || 9, current.getMinutes() || 0, 0, 0);
    await quickUpdateLead(lead.id, { followUpAt: next.toISOString() });
  }, [quickUpdateLead]);

  const setFollowUpTime = useCallback(async (lead: LeadRow, value: string) => {
    if (!lead.followUpAt) return;
    const [hourText, minuteText] = value.split(":");
    const hour = Number(hourText);
    const minute = Number(minuteText);
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return;
    const next = new Date(lead.followUpAt);
    next.setHours(hour, minute, 0, 0);
    await quickUpdateLead(lead.id, { followUpAt: next.toISOString() });
  }, [quickUpdateLead]);

  const getColumnCell = useCallback((lead: LeadRow, key: ColumnKey) => {
    if (key === "createdOn") {
      return <span className="block truncate text-sm text-muted-foreground">{formatDateTime(lead.firstContactAt)}</span>;
    }
    if (key === "name") {
      const fallback = (lead.displayName?.trim() || lead.phoneE164 || "-").slice(0, 1).toUpperCase();
      return (
        <div className="flex min-w-0 items-center gap-2">
          {lead.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={lead.avatarUrl} alt={lead.displayName?.trim() || lead.phoneE164} className="h-7 w-7 shrink-0 rounded-full border border-border/70 object-cover" />
          ) : (
            <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">{fallback}</span>
          )}
          <span className="block truncate text-sm font-medium leading-5 text-foreground">{lead.displayName?.trim() || "-"}</span>
        </div>
      );
    }
    if (key === "whatsapp") {
      return (
        <Button type="button" variant="ghost" className="h-8 max-w-full truncate px-2 text-sm text-primary hover:text-primary" onClick={() => void openOrCreateConversation(lead)}>
          <Inbox className="mr-1.5 h-3.5 w-3.5" />
          <span className="truncate">{lead.phoneE164}</span>
        </Button>
      );
    }
    if (key === "businessCategory") {
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" className="h-8 rounded-lg border border-border/70 px-2.5">
              {lead.businessCategory ? (
                <Badge className="max-w-[140px] truncate rounded-full bg-violet-200 text-violet-700 hover:bg-violet-200" title={lead.businessCategory}>
                  {lead.businessCategory}
                </Badge>
              ) : (
                <span className="text-xs text-muted-foreground">Set category</span>
              )}
              <ChevronDown className="ml-1.5 h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-60">
            {BUSINESS_CATEGORY_OPTIONS.map((category) => (
              <DropdownMenuItem key={category} onClick={() => void quickUpdateLead(lead.id, { businessCategory: category })}>
                {category}
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem
              onClick={() => {
                setAddCategoryTargetLeadId(lead.id);
                setNewCategoryName("");
                setIsAddCategoryDialogOpen(true);
              }}
            >
              + Add custom
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    }
    if (key === "detail") return <span className="whitespace-normal break-words text-sm leading-5 text-foreground/90">{lead.detail || "-"}</span>;
    if (key === "source") return renderToneBadge(lead.source ?? "INBOX", "source");
    if (key === "pipelineStage") {
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" className="h-8 rounded-lg border border-border/70 px-2.5">
              {lead.crmStageId && lead.crmStageName ? (
                renderPipelineStageBadge(
                  lead.crmStageName,
                  pipelineStages.find((stage) => stage.stageId === lead.crmStageId)?.stageColor ?? "slate"
                )
              ) : (
                <Badge variant="outline" className="rounded-full border-border/70 bg-background text-muted-foreground">
                  Unassigned
                </Badge>
              )}
              <ChevronDown className="ml-1.5 h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            {pipelineStages.length === 0 ? <DropdownMenuItem disabled>No pipeline stage configured.</DropdownMenuItem> : null}
            {pipelineStages.map((stage) => (
              <DropdownMenuItem key={stage.stageId} onClick={() => void moveLeadToPipelineStage(lead, stage.stageId)}>
                <div className="flex items-center gap-2">
                  {renderPipelineStageBadge(stage.stageName, stage.stageColor)}
                  {lead.crmStageId === stage.stageId ? <span className="text-xs text-muted-foreground">(current)</span> : null}
                </div>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    }
    if (key === "followUp") {
      return (
        <div className="flex items-center gap-1.5">
          <Popover>
            <PopoverTrigger asChild>
              <Button type="button" variant="ghost" className="h-8 rounded-lg border border-border/70 px-2.5 text-xs">
                <CalendarDays className="mr-1 h-3.5 w-3.5" />
                {lead.followUpAt ? formatDateTime(lead.followUpAt) : "dd/mm/yyyy"}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-auto p-0">
              <div className="p-2">
                <Calendar mode="single" selected={lead.followUpAt ? new Date(lead.followUpAt) : undefined} onSelect={(date) => void setFollowUpDate(lead, date)} />
                <div className="mt-2 flex items-center gap-2 px-2 pb-2">
                  <Input
                    type="time"
                    className="h-8"
                    value={lead.followUpAt ? `${String(new Date(lead.followUpAt).getHours()).padStart(2, "0")}:${String(new Date(lead.followUpAt).getMinutes()).padStart(2, "0")}` : "09:00"}
                    onChange={(event) => void setFollowUpTime(lead, event.target.value)}
                  />
                  <Button type="button" variant="secondary" className="h-8 text-xs" onClick={() => void quickUpdateLead(lead.id, { followUpAt: null })}>
                    Clear
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      );
    }
    if (key === "statusLead") {
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" className="h-8 rounded-lg border border-border/70 px-2.5">
              {renderToneBadge(lead.leadStatus, "status")}
              <ChevronDown className="ml-1.5 h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {LEAD_STATUS_OPTIONS.map((statusOption) => (
              <DropdownMenuItem key={statusOption} onClick={() => void quickUpdateLead(lead.id, { leadStatus: statusOption })}>
                {renderToneBadge(statusOption, "status")}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    }
    if (key === "projectValue") return <span className="font-medium">{formatMoney(lead.projectValueCents)}</span>;
    if (key === "remarks") return <span className="whitespace-normal break-words text-sm leading-5 text-muted-foreground">{lead.remarks || "-"}</span>;
    return (
      <div className="inline-flex items-center gap-2 text-sm">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
          {(lead.assignedToName || "?").slice(0, 1).toUpperCase()}
        </span>
        {lead.assignedToName || "-"}
      </div>
    );
  }, [moveLeadToPipelineStage, openOrCreateConversation, pipelineStages, quickUpdateLead, setFollowUpDate, setFollowUpTime]);

  const tableBodyRows = useMemo(() => {
    if (isLoading && visibleLeads.length === 0) {
      return (
        <TableRow>
          <TableCell colSpan={tableColumnOrder.length + 1} className="h-20 text-center text-muted-foreground">
            Loading leads...
          </TableCell>
        </TableRow>
      );
    }

    if (visibleLeads.length === 0) {
      return (
        <TableRow>
          <TableCell colSpan={tableColumnOrder.length + 1} className="h-20 text-center text-muted-foreground">
            <div className="flex flex-col items-center gap-2 py-2">
              <p>No leads found for current filter.</p>
              {(searchQuery || statusFilter !== "__all__" || sourceFilter !== "__all__" || assigneeFilter !== "__all__" || pipelineStageFilter !== "__all__") && (
                <Button type="button" variant="outline" size="sm" className="h-8" onClick={resetListFilters}>
                  Reset filter
                </Button>
              )}
            </div>
          </TableCell>
        </TableRow>
      );
    }

    return visibleLeads.map((lead) => (
      <TableRow key={lead.id} className="cursor-pointer align-top transition-colors hover:bg-accent/40" onClick={() => void openLeadDrawer(lead.id)}>
        <TableCell
          onClick={(event) => event.stopPropagation()}
          className="relative sticky left-0 z-20 border-r border-border bg-background after:absolute after:-right-px after:top-0 after:h-full after:w-px after:bg-border after:content-['']"
          style={{ width: SELECT_COLUMN_WIDTH, minWidth: SELECT_COLUMN_WIDTH, maxWidth: SELECT_COLUMN_WIDTH }}
        >
          <Checkbox
            checked={selectedLeadIdSet.has(lead.id)}
            onCheckedChange={(checked) => toggleRowSelection(lead.id, Boolean(checked))}
            aria-label={`Select ${lead.displayName ?? lead.phoneE164}`}
          />
        </TableCell>
        {tableColumnOrder.map((columnKey) => {
          const isFrozen = frozenColumns.includes(columnKey);
          const left = stickyOffsetMap.get(columnKey);
          return (
            <TableCell
              key={`${lead.id}-${columnKey}`}
              onClick={INTERACTIVE_COLUMNS.includes(columnKey) ? (event) => event.stopPropagation() : undefined}
              className={
                isFrozen
                  ? "relative sticky z-10 border-r border-border bg-background align-top py-3 after:absolute after:-right-px after:top-0 after:h-full after:w-px after:bg-border after:content-['']"
                  : "align-top py-3"
              }
              style={{
                ...(isFrozen ? { left } : {}),
                width: COLUMN_WIDTHS[columnKey],
                minWidth: COLUMN_WIDTHS[columnKey],
                maxWidth: COLUMN_WIDTHS[columnKey]
              }}
            >
              {getColumnCell(lead, columnKey)}
            </TableCell>
          );
        })}
      </TableRow>
    ));
  }, [
    assigneeFilter,
    frozenColumns,
    getColumnCell,
    isLoading,
    openLeadDrawer,
    pipelineStageFilter,
    resetListFilters,
    searchQuery,
    selectedLeadIdSet,
    sourceFilter,
    statusFilter,
    stickyOffsetMap,
    tableColumnOrder,
    toggleRowSelection,
    visibleLeads
  ]);

  return (
    <section className="flex h-full min-h-0 flex-1 overflow-hidden">
      <div className="flex h-full min-h-0 w-full flex-col rounded-2xl border border-border/70 bg-card/95 p-3 shadow-sm md:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 md:gap-4">
          <div className="flex items-center gap-3 md:gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-600 md:h-11 md:w-11 md:rounded-2xl">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-foreground md:text-3xl">Customer Management</h1>
              <p className="text-xs text-muted-foreground md:text-sm">Kelola database customer, status lead, dan pipeline dari satu workspace.</p>
            </div>
          </div>
          <div className="flex w-full flex-wrap items-center justify-end gap-2 md:w-auto">
            <Button
              type="button"
              className="gap-2 rounded-xl"
              onClick={() => {
                setError(null);
                setSuccess(null);
                setIsAddModalOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Add New
            </Button>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2 rounded-xl border border-border/70 bg-background/50 p-2.5 lg:grid-cols-[minmax(300px,1fr)_auto_auto_auto_auto]">
          <div className="flex min-w-0 items-center gap-2">
            <Button type="button" size="sm" variant="outline" className="h-9 shrink-0 rounded-lg px-3" onClick={openTableLayoutDialog}>
              <SlidersHorizontal className="mr-1.5 h-4 w-4" />
              Table Layout
            </Button>
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search leads..."
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                className="h-9 rounded-lg pl-10"
              />
            </div>
          </div>

          <Select
            value={assigneeFilter}
            onValueChange={(value) => {
              setAssigneeFilter(value);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-9 w-full min-w-[160px] rounded-lg">
              <SelectValue placeholder="Assignee" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Assignee</SelectItem>
              {assignees.map((assignee) => (
                <SelectItem key={assignee.memberId} value={assignee.memberId}>
                  {assignee.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={statusFilter}
            onValueChange={(value) => {
              setStatusFilter(value);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-9 w-full min-w-[160px] rounded-lg">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Status</SelectItem>
              {LEAD_STATUS_OPTIONS.map((status) => (
                <SelectItem key={status} value={status}>
                  {formatLabel(status)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={pipelineStageFilter}
            onValueChange={(value) => {
              setPipelineStageFilter(value);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-9 w-full min-w-[180px] rounded-lg">
              <SelectValue placeholder="Pipeline Stage" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Pipeline Stages</SelectItem>
              <SelectItem value="__none__">Unassigned</SelectItem>
              {pipelineStages.map((stage) => (
                <SelectItem key={stage.stageId} value={stage.stageId}>
                  {stage.stageName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={sourceFilter}
            onValueChange={(value) => {
              setSourceFilter(value);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-9 w-full min-w-[170px] rounded-lg">
              <SelectValue placeholder="Customer Source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Source</SelectItem>
              {sources.map((source) => (
                <SelectItem key={source} value={source}>
                  {formatLabel(source)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedIds.length > 0 ? <p className="col-span-full text-xs text-muted-foreground">{selectedIds.length} selected</p> : null}
          {selectedIds.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <Select value={bulkAction || "__none__"} onValueChange={(value) => setBulkAction(value === "__none__" ? "" : (value as BulkAction))}>
                <SelectTrigger className="h-8 w-[160px] rounded-md">
                  <SelectValue placeholder="Bulk Action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Bulk Action</SelectItem>
                  <SelectItem value="SET_STATUS">Set Status Lead</SelectItem>
                  <SelectItem value="SET_FOLLOW_UP">Set Follow-up</SelectItem>
                  <SelectItem value="ASSIGN">Assign</SelectItem>
                  <SelectItem value="DELETE">Delete</SelectItem>
                </SelectContent>
              </Select>

              {bulkAction === "SET_STATUS" ? (
                <Select value={bulkValue || "__none__"} onValueChange={(value) => setBulkValue(value === "__none__" ? "" : value)}>
                  <SelectTrigger className="h-8 w-[180px] rounded-md">
                    <SelectValue placeholder="Lead Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Lead Status</SelectItem>
                    {LEAD_STATUS_OPTIONS.map((status) => (
                      <SelectItem key={status} value={status}>
                        {formatLabel(status)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}

              {bulkAction === "SET_FOLLOW_UP" ? (
                <Select value={bulkValue || "__none__"} onValueChange={(value) => setBulkValue(value === "__none__" ? "" : value)}>
                  <SelectTrigger className="h-8 w-[180px] rounded-md">
                    <SelectValue placeholder="Follow-up" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Follow-up</SelectItem>
                    {FOLLOW_UP_OPTIONS.map((followup) => (
                      <SelectItem key={followup} value={followup}>
                        {formatLabel(followup)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}

              {bulkAction === "ASSIGN" ? (
                <Select value={bulkValue || "__none__"} onValueChange={(value) => setBulkValue(value === "__none__" ? "" : value)}>
                  <SelectTrigger className="h-8 w-[180px] rounded-md">
                    <SelectValue placeholder="Assignee" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Assignee</SelectItem>
                    {assignees.map((assignee) => (
                      <SelectItem key={assignee.memberId} value={assignee.memberId}>
                        {assignee.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}

              <Button
                type="button"
                size="sm"
                className="h-8 rounded-md"
                disabled={!bulkAction || isApplyingBulk || (bulkAction !== "DELETE" && !bulkValue)}
                onClick={() => void handleBulkApply()}
              >
                {isApplyingBulk ? "Applying..." : "Apply"}
              </Button>
            </div>
          ) : null}
        </div>

        <div className="mt-1 flex items-center justify-between gap-2">
          {isInlineUpdating ? <p className="text-xs text-muted-foreground">Updating lead...</p> : isRefreshingLeads ? <p className="text-xs text-muted-foreground">Refreshing leads...</p> : <span />}
          <p className="text-xs text-muted-foreground md:hidden">Swipe horizontally to see all columns.</p>
        </div>

        <div className="mt-3 min-h-0 flex-1 overflow-hidden rounded-xl border border-border/70 bg-background/40">
          <div className="h-full overflow-auto overscroll-contain">
            <Table className="min-w-[1860px] table-fixed border-collapse">
              <TableHeader>
                <TableRow>
                  <TableHead
                    className="relative sticky left-0 top-0 z-40 border-r border-border bg-background after:absolute after:-right-px after:top-0 after:h-full after:w-px after:bg-border after:content-['']"
                    style={{ width: SELECT_COLUMN_WIDTH, minWidth: SELECT_COLUMN_WIDTH, maxWidth: SELECT_COLUMN_WIDTH }}
                  >
                    <Checkbox checked={allPageSelected} onCheckedChange={(checked) => toggleSelectAllRows(Boolean(checked))} aria-label="Select all rows" />
                  </TableHead>
                  {tableColumnOrder.map((columnKey) => {
                    const isFrozen = frozenColumns.includes(columnKey);
                    const left = stickyOffsetMap.get(columnKey);
                    return (
                      <TableHead
                        key={columnKey}
                        className={
                          isFrozen
                            ? "relative sticky top-0 z-30 border-r border-border bg-background after:absolute after:-right-px after:top-0 after:h-full after:w-px after:bg-border after:content-['']"
                            : "sticky top-0 z-20 bg-background"
                        }
                        style={{
                          ...(isFrozen ? { left } : {}),
                          width: COLUMN_WIDTHS[columnKey],
                          minWidth: COLUMN_WIDTHS[columnKey],
                          maxWidth: COLUMN_WIDTHS[columnKey]
                        }}
                      >
                        {columnKey === "projectValue" ? <span className="block text-right">{COLUMN_LABELS[columnKey]}</span> : COLUMN_LABELS[columnKey]}
                      </TableHead>
                    );
                  })}
                </TableRow>
              </TableHeader>
              <TableBody>{tableBodyRows}</TableBody>
            </Table>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            {Math.min((page - 1) * pageSize + 1, totalLeads)}-{Math.min(page * pageSize, totalLeads)} / {totalLeads} record
          </p>
          <div className="flex items-center gap-2">
            <Select
              value={String(pageSize)}
              onValueChange={(value) => {
                setPageSize(Number(value));
                setPage(1);
              }}
            >
              <SelectTrigger className="h-9 w-[120px] rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="20">20 rows</SelectItem>
                <SelectItem value="30">30 rows</SelectItem>
                <SelectItem value="50">50 rows</SelectItem>
              </SelectContent>
            </Select>
            <Button type="button" size="sm" variant="secondary" className="h-9" onClick={() => setPage((prev) => Math.max(1, prev - 1))} disabled={page <= 1}>
              Prev
            </Button>
            <span className="text-sm text-muted-foreground">
              {page} / {totalPages}
            </span>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-9"
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={page >= totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="sm:max-w-[720px]">
          <DialogHeader>
            <DialogTitle>Add New Lead</DialogTitle>
            <DialogDescription>Create lead via modal form. CreatedOn follows first contact time.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-1 md:grid-cols-2">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Name</p>
              <Input placeholder="Name" value={addName} onChange={(event) => setAddName(event.target.value)} />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">WhatsApp</p>
              <Input placeholder="+628..." value={addPhone} onChange={(event) => setAddPhone(event.target.value)} />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Status Lead</p>
              <Select value={addStatus} onValueChange={setAddStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Status Lead" />
                </SelectTrigger>
                <SelectContent>
                  {LEAD_STATUS_OPTIONS.map((status) => (
                    <SelectItem key={status} value={status}>
                      {formatLabel(status)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Follow-up Tag</p>
              <Select value={addFollowUp} onValueChange={setAddFollowUp}>
                <SelectTrigger>
                  <SelectValue placeholder="Follow-up" />
                </SelectTrigger>
                <SelectContent>
                  {FOLLOW_UP_OPTIONS.map((followup) => (
                    <SelectItem key={followup} value={followup}>
                      {formatLabel(followup)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Follow-up Date</p>
              <Input type="date" value={addFollowUpDate} onChange={(event) => setAddFollowUpDate(event.target.value)} />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Follow-up Time</p>
              <Input type="time" value={addFollowUpTime} onChange={(event) => setAddFollowUpTime(event.target.value)} />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Source</p>
              <Select value={addSource} onValueChange={setAddSource}>
                <SelectTrigger>
                  <SelectValue placeholder="Source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="INBOX">Inbox</SelectItem>
                  <SelectItem value="ADS">Ads</SelectItem>
                  <SelectItem value="IG">IG</SelectItem>
                  <SelectItem value="HCOS">HCOS</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Business Category</p>
              <Input
                list="business-category-options"
                placeholder="Business Category"
                value={addCategory}
                onChange={(event) => setAddCategory(event.target.value)}
              />
              <datalist id="business-category-options">
                {BUSINESS_CATEGORY_OPTIONS.map((category) => (
                  <option key={category} value={category} />
                ))}
              </datalist>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Detail</p>
              <Input placeholder="Detail" value={addDetail} onChange={(event) => setAddDetail(event.target.value)} />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Project Value (IDR)</p>
              <Input placeholder="Project Value (IDR)" value={addProjectValue} onChange={(event) => setAddProjectValue(event.target.value)} />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Assign To</p>
              <Select value={addAssignee || "__none__"} onValueChange={(value) => setAddAssignee(value === "__none__" ? "" : value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Assign to" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Unassigned</SelectItem>
                  {assignees.map((assignee) => (
                    <SelectItem key={assignee.memberId} value={assignee.memberId}>
                      {assignee.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 md:col-span-2">
              <p className="text-xs text-muted-foreground">Notes</p>
              <Textarea placeholder="Notes" value={addRemarks} onChange={(event) => setAddRemarks(event.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setIsAddModalOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void handleCreateLead()} disabled={isSavingAdd}>
              {isSavingAdd ? "Saving..." : "Create Lead"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isTableLayoutDialogOpen} onOpenChange={setIsTableLayoutDialogOpen}>
        <DialogContent className="sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle>Table Layout</DialogTitle>
            <DialogDescription>Freeze columns and reorder them to match your workflow.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] space-y-2 overflow-y-auto py-1">
            {draftTableColumnOrder.map((columnKey, index) => (
              <div key={columnKey} className="flex items-center gap-2 rounded-lg border border-border/70 px-3 py-2">
                <Checkbox checked={draftFrozenColumns.includes(columnKey)} onCheckedChange={(checked) => toggleDraftFrozenColumn(columnKey, Boolean(checked))} />
                <p className="flex-1 text-sm font-medium">{COLUMN_LABELS[columnKey]}</p>
                <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={() => moveDraftColumn(columnKey, "up")} disabled={index === 0}>
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={() => moveDraftColumn(columnKey, "down")}
                  disabled={index === draftTableColumnOrder.length - 1}
                >
                  <ArrowDown className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleSaveTableLayout}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isAddCategoryDialogOpen} onOpenChange={setIsAddCategoryDialogOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Add Custom Category</DialogTitle>
            <DialogDescription>Save category text directly on selected lead.</DialogDescription>
          </DialogHeader>
          <Input placeholder="Business category" value={newCategoryName} onChange={(event) => setNewCategoryName(event.target.value)} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsAddCategoryDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void handleCreateCustomCategory()} disabled={!newCategoryName.trim() || isInlineUpdating}>
              Apply Category
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isFrozenDialogOpen} onOpenChange={setIsFrozenDialogOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Frozen Fields</DialogTitle>
            <DialogDescription>WhatsApp is always frozen. Set additional fields to lock.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-2 py-2 sm:grid-cols-2">
            {(Object.keys(DEFAULT_FROZEN_FIELDS) as FrozenFieldKey[]).map((fieldKey) => (
              <label key={fieldKey} className="flex items-center gap-2 rounded-md border border-border/70 px-3 py-2 text-sm">
                <Checkbox
                  checked={frozenFields[fieldKey]}
                  disabled={fieldKey === "phone"}
                  onCheckedChange={(checked) => {
                    setFrozenFields((current) => {
                      const next = {
                        ...current,
                        [fieldKey]: Boolean(checked),
                        phone: true
                      };
                      writeFrozenFieldsToStorage(next);
                      return next;
                    });
                  }}
                />
                {formatLabel(fieldKey)}
              </label>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Drawer
        open={isDrawerOpen}
        onOpenChange={(nextOpen) => {
          setIsDrawerOpen(nextOpen);
          if (!nextOpen) {
            const current = new URLSearchParams(searchParams.toString());
            if (current.has("leadId")) {
              current.delete("leadId");
              const query = current.toString();
              router.replace(query ? `/customers?${query}` : "/customers");
            }
          }
        }}
        direction="right"
      >
        <DrawerContent className="data-[vaul-drawer-direction=right]:w-[35vw] data-[vaul-drawer-direction=right]:max-w-[35vw] data-[vaul-drawer-direction=right]:min-w-[420px] data-[vaul-drawer-direction=right]:border-l-border max-md:data-[vaul-drawer-direction=right]:max-w-full max-md:data-[vaul-drawer-direction=right]:min-w-0 max-md:data-[vaul-drawer-direction=right]:w-full">
          <DrawerHeader className="border-b border-border/70">
            <div className="flex items-start justify-between gap-3">
              <div>
                <DrawerTitle>{selectedLead?.displayName?.trim() || selectedLead?.phoneE164 || "Lead Detail"}</DrawerTitle>
                <DrawerDescription>{selectedLead?.phoneE164 || "Lead detail and activity log."}</DrawerDescription>
              </div>
              <div className="flex items-center gap-2">
                {selectedLead?.latestConversationId ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8"
                    onClick={() => router.push(`/inbox?conversationId=${encodeURIComponent(selectedLead.latestConversationId ?? "")}`)}
                  >
                    Open Inbox
                  </Button>
                ) : null}
                <DrawerClose asChild>
                  <Button type="button" size="sm" variant="ghost" className="h-8">
                    Close
                  </Button>
                </DrawerClose>
              </div>
            </div>
          </DrawerHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 md:px-6">
            {isLeadLoading || !selectedLead ? (
              <p className="text-sm text-muted-foreground">Loading lead detail...</p>
            ) : (
              <Tabs defaultValue="information" className="w-full">
                <TabsList className="grid h-10 w-full grid-cols-2 rounded-lg">
                  <TabsTrigger value="information">Information</TabsTrigger>
                  <TabsTrigger value="activities">Activities</TabsTrigger>
                </TabsList>

                <TabsContent value="information" className="mt-4 space-y-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Name</p>
                      <Input
                        value={selectedLead.displayName ?? ""}
                        disabled={frozenFields.name}
                        onChange={(event) => updateSelectedLead("displayName", event.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">WhatsApp</p>
                      <Input value={selectedLead.phoneE164} disabled={frozenFields.phone} onChange={(event) => updateSelectedLead("phoneE164", event.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Status Lead</p>
                      <Select value={selectedLead.leadStatus} disabled={frozenFields.leadStatus} onValueChange={(value) => updateSelectedLead("leadStatus", value)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {LEAD_STATUS_OPTIONS.map((status) => (
                            <SelectItem key={status} value={status}>
                              {formatLabel(status)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Follow-up</p>
                      <Select
                        value={selectedLead.followUpStatus ?? "WAIT_RESPON"}
                        disabled={frozenFields.followUpStatus}
                        onValueChange={(value) => updateSelectedLead("followUpStatus", value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FOLLOW_UP_OPTIONS.map((followup) => (
                            <SelectItem key={followup} value={followup}>
                              {formatLabel(followup)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Follow-up Date</p>
                      <Input
                        type="date"
                        value={selectedLead.followUpAt ? selectedLead.followUpAt.slice(0, 10) : ""}
                        disabled={frozenFields.followUpStatus}
                        onChange={(event) => {
                          const value = event.target.value;
                          if (!value) {
                            updateSelectedLead("followUpAt", null);
                            return;
                          }
                          const base = selectedLead.followUpAt ? new Date(selectedLead.followUpAt) : new Date();
                          const next = new Date(`${value}T${String(base.getHours()).padStart(2, "0")}:${String(base.getMinutes()).padStart(2, "0")}:00`);
                          updateSelectedLead("followUpAt", Number.isNaN(next.getTime()) ? null : next.toISOString());
                        }}
                      />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Follow-up Time</p>
                      <Input
                        type="time"
                        value={
                          selectedLead.followUpAt
                            ? `${String(new Date(selectedLead.followUpAt).getHours()).padStart(2, "0")}:${String(new Date(selectedLead.followUpAt).getMinutes()).padStart(2, "0")}`
                            : "09:00"
                        }
                        disabled={frozenFields.followUpStatus || !selectedLead.followUpAt}
                        onChange={(event) => {
                          if (!selectedLead.followUpAt) return;
                          const [hourText, minuteText] = event.target.value.split(":");
                          const hour = Number(hourText);
                          const minute = Number(minuteText);
                          if (!Number.isFinite(hour) || !Number.isFinite(minute)) return;
                          const next = new Date(selectedLead.followUpAt);
                          next.setHours(hour, minute, 0, 0);
                          updateSelectedLead("followUpAt", next.toISOString());
                        }}
                      />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Business Category</p>
                      <Input
                        list="business-category-options-detail"
                        value={selectedLead.businessCategory ?? ""}
                        disabled={frozenFields.businessCategory}
                        onChange={(event) => updateSelectedLead("businessCategory", event.target.value || null)}
                      />
                      <datalist id="business-category-options-detail">
                        {BUSINESS_CATEGORY_OPTIONS.map((category) => (
                          <option key={category} value={category} />
                        ))}
                      </datalist>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Detail</p>
                      <Input value={selectedLead.detail ?? ""} disabled={frozenFields.detail} onChange={(event) => updateSelectedLead("detail", event.target.value || null)} />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Source</p>
                      <Input value={selectedLead.source ?? ""} disabled={frozenFields.source} onChange={(event) => updateSelectedLead("source", event.target.value || null)} />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Pipeline Stage</p>
                      <Select
                        value={selectedLead.crmStageId ?? "__none__"}
                        onValueChange={(value) => {
                          if (value === "__none__") {
                            updateSelectedLead("crmStageId", null);
                            updateSelectedLead("crmStageName", null);
                            return;
                          }
                          const selectedStage = pipelineStages.find((stage) => stage.stageId === value);
                          updateSelectedLead("crmStageId", value);
                          updateSelectedLead("crmStageName", selectedStage?.stageName ?? null);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Unassigned</SelectItem>
                          {pipelineStages.map((stage) => (
                            <SelectItem key={stage.stageId} value={stage.stageId}>
                              {stage.stageName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Project Value (IDR)</p>
                      <Input
                        type="number"
                        value={Math.round(selectedLead.projectValueCents / 100)}
                        disabled={frozenFields.projectValueCents}
                        onChange={(event) => updateSelectedLead("projectValueCents", Math.max(0, Number(event.target.value || "0")) * 100)}
                      />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Assignee</p>
                      <Select
                        value={selectedLead.assignedToMemberId ?? "__none__"}
                        disabled={frozenFields.assignedToMemberId}
                        onValueChange={(value) => {
                          updateSelectedLead("assignedToMemberId", value === "__none__" ? null : value);
                          const selected = assignees.find((assignee) => assignee.memberId === value);
                          updateSelectedLead("assignedToName", selected?.name ?? null);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Unassigned</SelectItem>
                          {assignees.map((assignee) => (
                            <SelectItem key={assignee.memberId} value={assignee.memberId}>
                              {assignee.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1 md:col-span-2">
                      <p className="text-xs text-muted-foreground">Notes</p>
                      <Textarea value={selectedLead.remarks ?? ""} disabled={frozenFields.remarks} onChange={(event) => updateSelectedLead("remarks", event.target.value || null)} />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="activities" className="mt-4">
                  <div className="space-y-3">
                    {leadChangeLog.length === 0 ? <p className="text-sm text-muted-foreground">No activity yet.</p> : null}
                    {leadChangeLog.map((entry, index) => (
                      <div key={entry.id} className="relative rounded-lg border border-border/70 bg-background/70 px-3 py-2.5">
                        {index < leadChangeLog.length - 1 ? <span className="absolute left-4 top-[calc(100%+2px)] h-4 w-px bg-border" /> : null}
                        <p className="text-sm font-medium text-foreground">{entry.action}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {entry.actorName ? (
                            <span className="inline-flex items-center gap-1">
                              <UserRound className="h-3 w-3" />
                              {entry.actorName}
                            </span>
                          ) : (
                            "System"
                          )}{" "}
                          • {formatDateTime(entry.createdAt)}
                        </p>
                      </div>
                    ))}
                  </div>
                </TabsContent>
              </Tabs>
            )}
          </div>

          <DrawerFooter className="border-t border-border/70 bg-background px-5 py-4 md:px-6">
            <Button type="button" onClick={() => void handleLeadSave()} disabled={isLeadSaving || isLeadLoading || !selectedLead}>
              <Lock className="mr-1.5 h-3.5 w-3.5" />
              {isLeadSaving ? "Saving..." : "Save Changes"}
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </section>
  );
}
