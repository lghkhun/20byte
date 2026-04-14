"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FileText, Mailbox, MoreHorizontal, UserRound, Workflow, X } from "lucide-react";

import {
  BUSINESS_CATEGORY_OPTIONS,
  FOLLOW_UP_OPTIONS,
  LEAD_STATUS_OPTIONS,
  formatLeadSettingLabel
} from "@/lib/crm/leadSettingsConfig";
import { InvoiceDrawer } from "@/components/invoices/InvoiceDrawer";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle
} from "@/components/ui/drawer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { subscribeToOrgMessageEvents } from "@/lib/ably/client";
import { fetchOrganizationsCached } from "@/lib/client/orgsCache";
import { dismissNotify, notifyError, notifyLoading, notifySuccess } from "@/lib/ui/notify";
import { cn } from "@/lib/utils";

type OrgItem = {
  id: string;
  name: string;
};

type StageItem = {
  id: string;
  name: string;
  color: string;
  position: number;
};

type PipelineItem = {
  id: string;
  name: string;
  isDefault: boolean;
  stages: StageItem[];
};

type KanbanCard = {
  id: string;
  customerId: string;
  customerName: string;
  customerPhoneE164: string;
  status: "OPEN" | "CLOSED";
  assignedToMemberId: string | null;
  unreadCount: number;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  invoiceCount: number;
  unpaidInvoiceCount: number;
};

type KanbanColumn = {
  stageId: string;
  stageName: string;
  stageColor: string;
  position: number;
  cardCount: number;
  hasMore: boolean;
  cards: KanbanCard[];
};

type KanbanBoard = {
  pipeline: PipelineItem | null;
  columns: KanbanColumn[];
  assignees: Array<{
    orgMemberId: string;
    userId: string;
    name: string | null;
    email: string;
    role: string;
  }>;
  unassigned: {
    cardCount: number;
    hasMore: boolean;
    cards: KanbanCard[];
  };
};

type RealtimeConnectionState =
  | "initialized"
  | "connecting"
  | "connected"
  | "disconnected"
  | "suspended"
  | "failed";
type RealtimeSubscriptionStatus = "connecting" | "connected" | "reconnecting" | "fallback";
type BoardChatScope = "ALL" | "CUSTOMER_ONLY" | "GROUP_ONLY";

type LeadDetailRow = {
  id: string;
  displayName: string | null;
  phoneE164: string;
  source: string | null;
  leadStatus: string;
  followUpStatus: string | null;
  followUpAt: string | null;
  businessCategory: string | null;
  detail: string | null;
  projectValueCents: number;
  remarks: string | null;
  assignedToMemberId: string | null;
  latestConversationId: string | null;
  crmStageId: string | null;
  crmStageName: string | null;
};

type LeadChangeLog = {
  id: string;
  action: string;
  actorName: string | null;
  createdAt: string;
};

type CustomerDetailResponse = {
  data?: {
    customer?: LeadDetailRow;
    changelog?: LeadChangeLog[];
  };
  error?: {
    message?: string;
  };
} | null;

const STAGE_COLOR_CLASS: Record<string, string> = {
  emerald: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700",
  amber: "border-amber-500/30 bg-amber-500/10 text-amber-700",
  sky: "border-sky-500/30 bg-sky-500/10 text-sky-700",
  violet: "border-violet-500/30 bg-violet-500/10 text-violet-700",
  rose: "border-rose-500/30 bg-rose-500/10 text-rose-700",
  slate: "border-slate-500/30 bg-slate-500/10 text-slate-700"
};
const CRM_LAST_ACTIVITY_FORMATTER = new Intl.DateTimeFormat("id-ID", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit"
});

function formatLastActivity(value: string | null): string {
  if (!value) {
    return "Belum ada aktivitas";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Belum ada aktivitas";
  }

  return CRM_LAST_ACTIVITY_FORMATTER.format(date);
}

function getStageColorClass(color: string): string {
  return STAGE_COLOR_CLASS[color] ?? "border-border bg-muted/40 text-foreground";
}

function formatLabel(value: string | null | undefined): string {
  if (!value) {
    return "-";
  }
  return formatLeadSettingLabel(value);
}

function CardIconActionButton({
  label,
  onClick,
  className,
  children
}: {
  label: string;
  onClick: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className={cn("h-6 w-6 p-0", className)}
          onClick={onClick}
        >
          {children}
          <span className="sr-only">{label}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

type BoardApiPayload = {
  data?: { board?: KanbanBoard };
  error?: { message?: string };
} | null;

type BoardCacheEntry = {
  board: KanbanBoard | null;
  cachedAt: number;
};

const BOARD_CACHE_TTL_MS = 20_000;
const DEFAULT_BOARD_CARD_LIMIT = 80;
const BOARD_CARD_LIMIT_STEP = 40;
const PERF_STORAGE_KEY = "perf.crm.pipeline.v1";
const PERF_MAX_SAMPLES = 120;

function mapRealtimeConnectionState(state: RealtimeConnectionState): RealtimeSubscriptionStatus {
  if (state === "connected") {
    return "connected";
  }
  if (state === "failed") {
    return "fallback";
  }
  if (state === "disconnected" || state === "suspended") {
    return "reconnecting";
  }

  return "connecting";
}

type PerfMetricName = "crm.board.load" | "crm.move.stage";

type PerfSample = {
  name: PerfMetricName;
  durationMs: number;
  ok: boolean;
  at: number;
};

function savePerfSample(sample: PerfSample) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const raw = window.localStorage.getItem(PERF_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as PerfSample[]) : [];
    const next = [...parsed, sample].slice(-PERF_MAX_SAMPLES);
    window.localStorage.setItem(PERF_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Keep primary flow fast even when telemetry write fails.
  }
}

export function CrmPipelineWorkspace() {
  const router = useRouter();
  const [orgs, setOrgs] = useState<OrgItem[]>([]);
  const [hasLoadedOrganizations, setHasLoadedOrganizations] = useState(false);
  const [board, setBoard] = useState<KanbanBoard | null>(null);
  const [boardCardLimit, setBoardCardLimit] = useState(DEFAULT_BOARD_CARD_LIMIT);
  const [isLoadingBoard, setIsLoadingBoard] = useState(true);
  const [isRefreshingBoard, setIsRefreshingBoard] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSavingMove, setIsSavingMove] = useState(false);
  const [draggedConversationId, setDraggedConversationId] = useState<string | null>(null);
  const [dragOverStageId, setDragOverStageId] = useState<string | null>(null);
  const [isLeadDrawerOpen, setIsLeadDrawerOpen] = useState(false);
  const [isLeadLoading, setIsLeadLoading] = useState(false);
  const [isLeadSaving, setIsLeadSaving] = useState(false);
  const [chatScope, setChatScope] = useState<BoardChatScope>("ALL");
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [selectedLead, setSelectedLead] = useState<LeadDetailRow | null>(null);
  const [leadChangeLog, setLeadChangeLog] = useState<LeadChangeLog[]>([]);
  const [isInvoiceDrawerOpen, setIsInvoiceDrawerOpen] = useState(false);
  const [invoiceDrawerContext, setInvoiceDrawerContext] = useState<{
    customerId: string | null;
    conversationId: string | null;
    customerDisplayName: string | null;
    customerPhoneE164: string | null;
  }>({
    customerId: null,
    conversationId: null,
    customerDisplayName: null,
    customerPhoneE164: null
  });
  const realtimeStatusRef = useRef<RealtimeSubscriptionStatus>("connecting");
  const boardCacheRef = useRef<Map<string, BoardCacheEntry>>(new Map());
  const boardInFlightRef = useRef<{ key: string; promise: Promise<void> } | null>(null);
  const boardAbortControllerRef = useRef<AbortController | null>(null);
  const boardLoadingToastIdRef = useRef<string | number | null>(null);
  const boardRequestIdRef = useRef(0);
  const isMountedRef = useRef(true);
  const boardRef = useRef<KanbanBoard | null>(null);
  const activeBusiness = useMemo(() => orgs[0] ?? null, [orgs]);
  const recordPerf = useCallback((name: PerfMetricName, startedAt: number, ok: boolean) => {
    const durationMs = Number((performance.now() - startedAt).toFixed(1));
    savePerfSample({
      name,
      durationMs,
      ok,
      at: Date.now()
    });
  }, []);

  const updateRealtimeStatus = useCallback((nextStatus: RealtimeSubscriptionStatus) => {
    realtimeStatusRef.current = nextStatus;
  }, []);

  const writeBoardCache = useCallback(
    (nextBoard: KanbanBoard | null, pipelineIdOverride?: string) => {
      const orgId = activeBusiness?.id ?? "";
      if (!orgId) {
        return;
      }

      const pipelineId =
        pipelineIdOverride ?? nextBoard?.pipeline?.id ?? boardRef.current?.pipeline?.id ?? "";
      const cacheKey = `${orgId}::${pipelineId || "__default__"}::scope:${chatScope}::limit:${boardCardLimit}`;
      boardCacheRef.current.set(cacheKey, {
        board: nextBoard,
        cachedAt: Date.now()
      });
    },
    [activeBusiness?.id, boardCardLimit, chatScope]
  );

  const loadBoard = useCallback(
    async (pipelineId: string, options?: { force?: boolean }) => {
      const orgId = activeBusiness?.id ?? "";
      if (!hasLoadedOrganizations) {
        return;
      }
      if (!orgId) {
        if (isMountedRef.current) {
          setBoard(null);
          setIsLoadingBoard(false);
          setIsRefreshingBoard(false);
        }
        return;
      }
      const startedAt = performance.now();
      const cacheKey = `${orgId}::${pipelineId || "__default__"}::scope:${chatScope}::limit:${boardCardLimit}`;
      const cached = boardCacheRef.current.get(cacheKey);
      if (cached) {
        setBoard(cached.board);
      }
      const isCacheFresh = Boolean(cached && Date.now() - cached.cachedAt < BOARD_CACHE_TTL_MS);
      if (isCacheFresh && !options?.force) {
        setIsLoadingBoard(false);
        setIsRefreshingBoard(false);
        recordPerf("crm.board.load", startedAt, true);
        return;
      }

      if (!options?.force && boardInFlightRef.current?.key === cacheKey) {
        await boardInFlightRef.current.promise;
        return;
      }

      const requestId = ++boardRequestIdRef.current;

      if (!cached) {
        setIsLoadingBoard(true);
      } else {
        setIsRefreshingBoard(true);
      }
      setError(null);

      const requestPromise = (async () => {
        const abortController = new AbortController();
        boardAbortControllerRef.current?.abort();
        boardAbortControllerRef.current = abortController;
        try {
          const query = pipelineId
            ? `?pipelineId=${encodeURIComponent(pipelineId)}&status=OPEN&chatScope=${encodeURIComponent(chatScope)}&orgId=${encodeURIComponent(orgId)}&cardLimit=${encodeURIComponent(String(boardCardLimit))}`
            : `?status=OPEN&chatScope=${encodeURIComponent(chatScope)}&orgId=${encodeURIComponent(orgId)}&cardLimit=${encodeURIComponent(String(boardCardLimit))}`;
          let attempts = 0;
          let resolved = false;
          while (attempts < 2 && !resolved) {
            attempts += 1;
            try {
              const response = await fetch(`/api/crm/pipelines/board${query}`, {
                cache: "no-store",
                signal: abortController.signal
              });
              const payload = (await response.json().catch(() => null)) as BoardApiPayload;
              if (!isMountedRef.current || requestId !== boardRequestIdRef.current) {
                return;
              }
              if (!response.ok) {
                const message = payload?.error?.message ?? "Gagal memuat board CRM.";
                if (response.status >= 500 && attempts < 2) {
                  await new Promise((resolve) => {
                    globalThis.setTimeout(resolve, 240);
                  });
                  continue;
                }
                setError(message);
                recordPerf("crm.board.load", startedAt, false);
                return;
              }

              const nextBoard = payload?.data?.board ?? null;
              writeBoardCache(nextBoard, pipelineId);
              setBoard(nextBoard);
              recordPerf("crm.board.load", startedAt, true);
              resolved = true;
            } catch (error) {
              if (error instanceof DOMException && error.name === "AbortError") {
                return;
              }
              if (!isMountedRef.current || requestId !== boardRequestIdRef.current) {
                return;
              }
              if (attempts < 2) {
                await new Promise((resolve) => {
                  globalThis.setTimeout(resolve, 240);
                });
                continue;
              }
              setError("Jaringan bermasalah saat memuat board CRM.");
              recordPerf("crm.board.load", startedAt, false);
            }
          }
        } finally {
          if (boardAbortControllerRef.current === abortController) {
            boardAbortControllerRef.current = null;
          }
        }
      })();

      boardInFlightRef.current = {
        key: cacheKey,
        promise: requestPromise
      };

      try {
        await requestPromise;
      } finally {
        if (boardInFlightRef.current?.promise === requestPromise) {
          boardInFlightRef.current = null;
        }
        if (isMountedRef.current && requestId === boardRequestIdRef.current) {
          setIsLoadingBoard(false);
          setIsRefreshingBoard(false);
        }
      }
    },
    [
      activeBusiness?.id,
      boardCardLimit,
      chatScope,
      hasLoadedOrganizations,
      recordPerf,
      writeBoardCache
    ]
  );

  const moveConversation = useCallback(
    async (conversationId: string, stageId: string) => {
      if (!board || isSavingMove) {
        return;
      }
      const startedAt = performance.now();

      const previousBoard = board;
      const targetExists = previousBoard.columns.some((column) => column.stageId === stageId);
      if (!targetExists) {
        return;
      }

      const isAlreadyInTarget = previousBoard.columns.some(
        (column) =>
          column.stageId === stageId && column.cards.some((card) => card.id === conversationId)
      );
      if (isAlreadyInTarget) {
        return;
      }

      let movedCard: KanbanCard | null = null;
      setBoard((current) => {
        if (!current) {
          return current;
        }

        let nextUnassignedCards = current.unassigned.cards;
        if (nextUnassignedCards.some((card) => card.id === conversationId)) {
          movedCard = nextUnassignedCards.find((card) => card.id === conversationId) ?? null;
          nextUnassignedCards = nextUnassignedCards.filter((card) => card.id !== conversationId);
        }

        const nextColumns = current.columns.map((column) => {
          const foundInColumn = column.cards.find((card) => card.id === conversationId);
          if (foundInColumn) {
            movedCard = foundInColumn;
          }

          if (column.stageId === stageId) {
            return column;
          }

          return {
            ...column,
            cards: column.cards.filter((card) => card.id !== conversationId)
          };
        });

        if (!movedCard) {
          return current;
        }

        const finalColumns = nextColumns.map((column) =>
          column.stageId === stageId
            ? {
                ...column,
                cards: [movedCard as KanbanCard, ...column.cards]
              }
            : column
        );

        const nextBoard: KanbanBoard = {
          ...current,
          unassigned: {
            ...current.unassigned,
            cards: nextUnassignedCards,
            cardCount: nextUnassignedCards.length,
            hasMore: current.unassigned.hasMore
          },
          columns: finalColumns.map((column) => ({
            ...column,
            cardCount: column.cards.length,
            hasMore: column.hasMore
          }))
        };
        writeBoardCache(nextBoard, current.pipeline?.id ?? undefined);
        return nextBoard;
      });

      if (!movedCard) {
        return;
      }

      setIsSavingMove(true);
      const toastId = notifyLoading("Menyimpan perpindahan stage...");
      setError(null);
      try {
        const response = await fetch(
          `/api/conversations/${encodeURIComponent(conversationId)}/pipeline`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              orgId: activeBusiness?.id ?? "",
              pipelineId: board.pipeline?.id,
              stageId
            })
          }
        );
        const payload = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        if (!response.ok) {
          dismissNotify(toastId);
          writeBoardCache(previousBoard, previousBoard.pipeline?.id ?? undefined);
          setBoard(previousBoard);
          setError(payload?.error?.message ?? "Gagal memindahkan percakapan.");
          recordPerf("crm.move.stage", startedAt, false);
          return;
        }
        dismissNotify(toastId);
        recordPerf("crm.move.stage", startedAt, true);
      } catch {
        writeBoardCache(previousBoard, previousBoard.pipeline?.id ?? undefined);
        setBoard(previousBoard);
        setError("Jaringan bermasalah saat memindahkan percakapan.");
        dismissNotify(toastId);
        recordPerf("crm.move.stage", startedAt, false);
      } finally {
        setIsSavingMove(false);
      }
    },
    [activeBusiness?.id, board, isSavingMove, recordPerf, writeBoardCache]
  );

  const openInvoiceDrawerForCard = useCallback((card: KanbanCard) => {
    setInvoiceDrawerContext({
      customerId: card.customerId,
      conversationId: card.id,
      customerDisplayName: card.customerName,
      customerPhoneE164: card.customerPhoneE164
    });
    setIsInvoiceDrawerOpen(true);
  }, []);

  const openLeadDrawer = useCallback(
    async (card: KanbanCard) => {
      const orgId = activeBusiness?.id ?? "";
      if (!orgId) {
        return;
      }
      setIsLeadDrawerOpen(true);
      setIsLeadLoading(true);
      setSelectedLeadId(card.customerId);
      setSelectedLead(null);
      setLeadChangeLog([]);
      setError(null);
      try {
        const response = await fetch(
          `/api/customers/${encodeURIComponent(card.customerId)}?orgId=${encodeURIComponent(orgId)}`,
          { cache: "no-store" }
        );
        const payload = (await response.json().catch(() => null)) as CustomerDetailResponse;
        if (!response.ok || !payload?.data?.customer) {
          throw new Error(payload?.error?.message ?? "Gagal memuat detail customer.");
        }
        setSelectedLead(payload.data.customer);
        setLeadChangeLog(payload.data.changelog ?? []);
      } catch (drawerError) {
        setIsLeadDrawerOpen(false);
        setError(
          drawerError instanceof Error ? drawerError.message : "Gagal memuat detail customer."
        );
      } finally {
        setIsLeadLoading(false);
      }
    },
    [activeBusiness?.id]
  );

  const updateSelectedLead = useCallback(
    <K extends keyof LeadDetailRow>(key: K, value: LeadDetailRow[K]) => {
      setSelectedLead((current) => {
        if (!current) {
          return current;
        }
        return {
          ...current,
          [key]: value
        };
      });
    },
    []
  );

  const handleSaveLead = useCallback(async () => {
    if (!selectedLeadId || !selectedLead) {
      return;
    }
    const orgId = activeBusiness?.id ?? "";
    if (!orgId) {
      return;
    }

    try {
      setIsLeadSaving(true);
      setError(null);
      const response = await fetch(`/api/customers/${encodeURIComponent(selectedLeadId)}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          orgId,
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
      const payload = (await response.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      if (!response.ok) {
        throw new Error(payload?.error?.message ?? "Gagal menyimpan customer.");
      }

      const pipelineId = board?.pipeline?.id ?? null;
      if (selectedLead.crmStageId && pipelineId) {
        let conversationId = selectedLead.latestConversationId;
        if (!conversationId) {
          const createResponse = await fetch("/api/conversations", {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              orgId,
              phoneE164: selectedLead.phoneE164,
              customerDisplayName: selectedLead.displayName ?? undefined
            })
          });
          const createPayload = (await createResponse.json().catch(() => null)) as {
            data?: { conversation?: { id?: string } };
            error?: { message?: string };
          } | null;
          if (!createResponse.ok || !createPayload?.data?.conversation?.id) {
            throw new Error(createPayload?.error?.message ?? "Gagal membuat conversation.");
          }
          conversationId = createPayload.data.conversation.id;
          setSelectedLead((current) =>
            current ? { ...current, latestConversationId: conversationId } : current
          );
        }

        if (conversationId) {
          const moveResponse = await fetch(
            `/api/conversations/${encodeURIComponent(conversationId)}/pipeline`,
            {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                orgId,
                pipelineId,
                stageId: selectedLead.crmStageId
              })
            }
          );
          const movePayload = (await moveResponse.json().catch(() => null)) as {
            error?: { message?: string };
          } | null;
          if (!moveResponse.ok) {
            throw new Error(movePayload?.error?.message ?? "Gagal sinkronisasi stage pipeline.");
          }
        }
      }

      notifySuccess("Perubahan customer tersimpan.");
      await loadBoard(board?.pipeline?.id ?? "", { force: true });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Gagal menyimpan customer.");
    } finally {
      setIsLeadSaving(false);
    }
  }, [activeBusiness?.id, board?.pipeline?.id, loadBoard, selectedLead, selectedLeadId]);

  const loadOrganizations = useCallback(async () => {
    try {
      const organizations = (await fetchOrganizationsCached()) as OrgItem[];
      setOrgs(organizations);
    } finally {
      setHasLoadedOrganizations(true);
    }
  }, []);

  useEffect(() => {
    void loadOrganizations().catch(() => {
      setError("Gagal memuat organisasi.");
    });
  }, [loadOrganizations]);

  useEffect(() => {
    boardRef.current = board;
  }, [board]);

  useEffect(() => {
    setBoardCardLimit(DEFAULT_BOARD_CARD_LIMIT);
  }, [activeBusiness?.id]);

  useEffect(() => {
    if (!hasLoadedOrganizations) {
      return;
    }
    if (!activeBusiness?.id) {
      setBoard(null);
      setIsLoadingBoard(false);
      setIsRefreshingBoard(false);
      return;
    }
    void loadBoard("").catch(() => {
      if (!isMountedRef.current) {
        return;
      }
      setError("Gagal memuat board CRM.");
      setIsLoadingBoard(false);
      setIsRefreshingBoard(false);
    });
  }, [activeBusiness?.id, hasLoadedOrganizations, loadBoard]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      boardAbortControllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!error) return;
    notifyError(error);
  }, [error]);

  useEffect(() => {
    if (isLoadingBoard) {
      if (boardLoadingToastIdRef.current === null) {
        boardLoadingToastIdRef.current = notifyLoading("Memuat board pipeline...");
      }
      return;
    }
    if (boardLoadingToastIdRef.current !== null) {
      dismissNotify(boardLoadingToastIdRef.current);
      boardLoadingToastIdRef.current = null;
    }
  }, [isLoadingBoard]);

  useEffect(() => {
    return () => {
      if (boardLoadingToastIdRef.current !== null) {
        dismissNotify(boardLoadingToastIdRef.current);
        boardLoadingToastIdRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!hasLoadedOrganizations || !activeBusiness?.id) {
      return;
    }

    let active = true;
    let cleanup: (() => void) | null = null;
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    let fallbackTimer: ReturnType<typeof setInterval> | null = null;
    updateRealtimeStatus("connecting");

    const stopFallbackPolling = () => {
      if (fallbackTimer) {
        clearInterval(fallbackTimer);
        fallbackTimer = null;
      }
    };

    const startFallbackPolling = (intervalMs: number) => {
      if (fallbackTimer) {
        return;
      }
      fallbackTimer = setInterval(() => {
        if (!active || realtimeStatusRef.current === "connected") {
          return;
        }
        const currentPipelineId = boardRef.current?.pipeline?.id ?? "";
        void loadBoard(currentPipelineId, { force: true });
      }, intervalMs);
    };

    const scheduleRefresh = () => {
      if (refreshTimer) {
        clearTimeout(refreshTimer);
      }
      refreshTimer = setTimeout(() => {
        if (!active) {
          return;
        }
        const currentPipelineId = boardRef.current?.pipeline?.id ?? "";
        void loadBoard(currentPipelineId, { force: true });
      }, 250);
    };

    const bumpCardRealtime = (conversationId: string, timestamp: string, inbound: boolean) => {
      const parsed = new Date(timestamp);
      const eventIso = Number.isNaN(parsed.getTime())
        ? new Date().toISOString()
        : parsed.toISOString();
      const eventMs = Number.isNaN(parsed.getTime()) ? Date.now() : parsed.getTime();
      let changed = false;

      setBoard((current) => {
        if (!current) {
          return current;
        }

        const patchCard = (card: KanbanCard): KanbanCard => {
          const cardLastMs = card.lastMessageAt ? new Date(card.lastMessageAt).getTime() : 0;
          return {
            ...card,
            status: "OPEN",
            unreadCount: inbound ? card.unreadCount + 1 : card.unreadCount,
            lastMessageAt: eventMs >= cardLastMs ? eventIso : card.lastMessageAt
          };
        };

        const inUnassignedIndex = current.unassigned.cards.findIndex(
          (card) => card.id === conversationId
        );
        if (inUnassignedIndex >= 0) {
          changed = true;
          const sourceCard = current.unassigned.cards[inUnassignedIndex];
          const nextCard = patchCard(sourceCard);
          const remaining = current.unassigned.cards.filter((card) => card.id !== conversationId);
          const nextBoard: KanbanBoard = {
            ...current,
            unassigned: {
              ...current.unassigned,
              cards: [nextCard, ...remaining],
              cardCount: remaining.length + 1
            }
          };
          writeBoardCache(nextBoard, current.pipeline?.id ?? undefined);
          return nextBoard;
        }

        const sourceColumnIndex = current.columns.findIndex((column) =>
          column.cards.some((card) => card.id === conversationId)
        );
        if (sourceColumnIndex < 0) {
          return current;
        }

        changed = true;
        const sourceColumn = current.columns[sourceColumnIndex];
        const sourceCard = sourceColumn.cards.find((card) => card.id === conversationId);
        if (!sourceCard) {
          return current;
        }

        const nextCard = patchCard(sourceCard);
        const sourceRemaining = sourceColumn.cards.filter((card) => card.id !== conversationId);
        const nextColumns = current.columns.map((column, index) => {
          if (index !== sourceColumnIndex) {
            return column;
          }
          const cards = [nextCard, ...sourceRemaining];
          return {
            ...column,
            cards,
            cardCount: cards.length
          };
        });

        const nextBoard: KanbanBoard = {
          ...current,
          columns: nextColumns
        };
        writeBoardCache(nextBoard, current.pipeline?.id ?? undefined);
        return nextBoard;
      });

      return changed;
    };

    const patchConversationRealtime = (input: {
      conversationId: string;
      status: "OPEN" | "CLOSED";
      assignedToMemberId: string | null;
      crmStageId?: string | null;
    }) => {
      let changed = false;
      let missing = false;
      setBoard((current) => {
        if (!current) {
          return current;
        }

        let sourceCard: KanbanCard | null = null;
        let sourceStageId: string | null = null;
        const sourceInUnassigned = current.unassigned.cards.find(
          (card) => card.id === input.conversationId
        );
        if (sourceInUnassigned) {
          sourceCard = sourceInUnassigned;
          sourceStageId = null;
        } else {
          for (const column of current.columns) {
            const found = column.cards.find((card) => card.id === input.conversationId);
            if (found) {
              sourceCard = found;
              sourceStageId = column.stageId;
              break;
            }
          }
        }

        if (!sourceCard) {
          missing = true;
          return current;
        }

        changed = true;
        const patchCard: KanbanCard = {
          ...sourceCard,
          status: input.status,
          assignedToMemberId: input.assignedToMemberId
        };

        const unassignedPool = current.unassigned.cards.filter(
          (card) => card.id !== input.conversationId
        );
        const columnsPool = current.columns.map((column) => ({
          ...column,
          cards: column.cards.filter((card) => card.id !== input.conversationId)
        }));

        if (input.status === "CLOSED") {
          const nextBoard: KanbanBoard = {
            ...current,
            unassigned: {
              ...current.unassigned,
              cards: unassignedPool,
              cardCount: unassignedPool.length
            },
            columns: columnsPool.map((column) => ({
              ...column,
              cardCount: column.cards.length
            }))
          };
          writeBoardCache(nextBoard, current.pipeline?.id ?? undefined);
          return nextBoard;
        }

        const targetStageId = input.crmStageId === undefined ? sourceStageId : input.crmStageId;
        const targetColumnExists = Boolean(
          targetStageId && columnsPool.some((column) => column.stageId === targetStageId)
        );
        const nextUnassignedCards = targetColumnExists
          ? unassignedPool
          : [patchCard, ...unassignedPool];
        const nextColumns = columnsPool.map((column) => {
          if (!targetColumnExists || column.stageId !== targetStageId) {
            return {
              ...column,
              cardCount: column.cards.length
            };
          }
          const cards = [patchCard, ...column.cards];
          return {
            ...column,
            cards,
            cardCount: cards.length
          };
        });

        if (!changed) {
          return current;
        }

        const nextBoard: KanbanBoard = {
          ...current,
          unassigned: {
            ...current.unassigned,
            cards: nextUnassignedCards,
            cardCount: nextUnassignedCards.length
          },
          columns: nextColumns
        };
        writeBoardCache(nextBoard, current.pipeline?.id ?? undefined);
        return nextBoard;
      });
      return { changed, missing };
    };

    const startSubscription = async () => {
      try {
        cleanup = await subscribeToOrgMessageEvents({
          orgId: activeBusiness.id,
          onConnectionStateChange: (state) => {
            if (!active) {
              return;
            }
            const nextStatus = mapRealtimeConnectionState(state as RealtimeConnectionState);
            updateRealtimeStatus(nextStatus);
            if (nextStatus === "connected") {
              stopFallbackPolling();
              return;
            }
            if (nextStatus === "reconnecting") {
              startFallbackPolling(10_000);
              return;
            }
            if (nextStatus === "fallback") {
              startFallbackPolling(15_000);
              return;
            }
            startFallbackPolling(12_000);
          },
          onMessageNew: (payload) => {
            bumpCardRealtime(
              payload.conversationId,
              payload.timestamp,
              payload.direction === "INBOUND"
            );
            scheduleRefresh();
          },
          onConversationUpdated: (payload) => {
            const reconcile = patchConversationRealtime({
              conversationId: payload.conversationId,
              status: payload.status,
              assignedToMemberId: payload.assignedToMemberId,
              crmStageId: payload.crmStageId
            });
            if (!reconcile.changed || reconcile.missing) {
              scheduleRefresh();
            }
          },
          onAssignmentChanged: (payload) => {
            const reconcile = patchConversationRealtime({
              conversationId: payload.conversationId,
              status: payload.status,
              assignedToMemberId: payload.assignedToMemberId
            });
            if (!reconcile.changed || reconcile.missing) {
              scheduleRefresh();
            }
          },
          onInvoiceCreated: scheduleRefresh,
          onInvoiceUpdated: scheduleRefresh,
          onInvoicePaid: scheduleRefresh,
          onProofAttached: scheduleRefresh,
          onCustomerUpdated: scheduleRefresh,
          onStorageUpdated: scheduleRefresh
        });
      } catch (subscriptionError) {
        const message =
          subscriptionError instanceof Error
            ? subscriptionError.message
            : "Unknown realtime subscribe error";
        console.error(`[realtime] crm pipeline subscription failed: ${message}`);
        updateRealtimeStatus("fallback");
        startFallbackPolling(15_000);
      }
    };

    void startSubscription();

    return () => {
      active = false;
      if (refreshTimer) {
        clearTimeout(refreshTimer);
      }
      stopFallbackPolling();
      if (cleanup) {
        cleanup();
      }
    };
  }, [
    activeBusiness?.id,
    hasLoadedOrganizations,
    loadBoard,
    updateRealtimeStatus,
    writeBoardCache
  ]);

  const activePipeline = useMemo(() => board?.pipeline ?? null, [board]);
  const pipelineStageOptions = useMemo(
    () =>
      (activePipeline?.stages ?? []).map((stage) => ({
        stageId: stage.id,
        stageName: stage.name
      })),
    [activePipeline?.stages]
  );
  const assigneeOptions = useMemo(
    () =>
      (board?.assignees ?? []).map((assignee) => ({
        memberId: assignee.orgMemberId,
        name: assignee.name?.trim() || assignee.email
      })),
    [board?.assignees]
  );
  const isCompact = true;
  const totalBoardColumns = (board?.columns.length ?? 0) + 1;
  const canLoadMoreCards = Boolean(
    boardCardLimit < 320 &&
    (board?.unassigned.hasMore || board?.columns.some((column) => column.hasMore))
  );

  return (
    <TooltipProvider delayDuration={120}>
      <section className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex items-center gap-3 px-3 pb-2 pt-3 md:gap-4 md:px-4 md:pt-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-primary/20 to-primary/5 text-primary shadow-inner ring-1 ring-primary/20 md:h-12 md:w-12 md:rounded-[18px]">
            <Workflow className="h-5 w-5 md:h-6 md:w-6" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground md:text-3xl">
              CRM Pipeline
            </h1>
            <p className="text-xs text-muted-foreground md:text-sm">
              Kelola pergerakan lead antar stage CRM secara cepat dalam satu workspace.
            </p>
          </div>
          <div className="ml-auto w-[220px]">
            <Select
              value={chatScope}
              onValueChange={(value) => {
                setChatScope(value as BoardChatScope);
                void loadBoard(board?.pipeline?.id ?? "", { force: true });
              }}
            >
              <SelectTrigger className="h-10 rounded-xl border-border/80 bg-background shadow-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Semua Percakapan</SelectItem>
                <SelectItem value="CUSTOMER_ONLY">Personal Saja</SelectItem>
                <SelectItem value="GROUP_ONLY">Grup Saja</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <section className="flex min-h-0 flex-1 flex-col overflow-hidden pt-2">
          {isLoadingBoard ? (
            <div className="inbox-scroll min-h-0 flex-1 overflow-x-auto overflow-y-hidden px-3 py-3 md:px-4 md:py-4">
              <div
                className="grid h-full min-h-0 min-w-full items-stretch gap-3"
                style={{ gridTemplateColumns: "repeat(4, minmax(320px, 1fr))" }}
              >
                {Array.from({ length: 4 }).map((_, columnIndex) => (
                  <article
                    key={`board-skeleton-${columnIndex}`}
                    className="flex h-full min-h-0 flex-col rounded-[22px] border border-border/70 bg-gradient-to-b from-card/30 to-background/5 p-3 shadow-sm"
                  >
                    <div className="mb-3 flex items-center justify-between pb-1">
                      <Skeleton className="h-4 w-36 rounded-full" />
                      <Skeleton className="h-6 w-10 rounded-full" />
                    </div>
                    <div className="space-y-3">
                      {Array.from({ length: 4 }).map((__, cardIndex) => (
                        <div
                          key={`board-skeleton-${columnIndex}-card-${cardIndex}`}
                          className="rounded-2xl border border-border/60 bg-card p-3.5"
                        >
                          <Skeleton className="h-4 w-3/4" />
                          <Skeleton className="mt-2 h-3 w-1/2" />
                          <Skeleton className="mt-3 h-3 w-full" />
                          <Skeleton className="mt-2 h-3 w-11/12" />
                          <div className="mt-3 flex justify-between">
                            <Skeleton className="h-4 w-20 rounded" />
                            <div className="flex gap-1">
                              <Skeleton className="h-6 w-6 rounded" />
                              <Skeleton className="h-6 w-6 rounded" />
                              <Skeleton className="h-6 w-6 rounded" />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ) : null}

          {!isLoadingBoard && board ? (
            <>
              <div className="inbox-scroll min-h-0 flex-1 overflow-x-auto overflow-y-hidden px-3 py-3 md:px-4 md:py-4">
                <div
                  className={cn(
                    "grid h-full min-h-0 min-w-full items-stretch",
                    isCompact ? "gap-3" : "gap-4"
                  )}
                  style={{
                    gridTemplateColumns: `repeat(${totalBoardColumns}, minmax(320px, 1fr))`
                  }}
                >
                  <article
                    className={cn(
                      "flex h-full min-h-0 flex-col rounded-[22px] border border-border/70 bg-gradient-to-b from-card/30 to-background/5 shadow-sm",
                      isCompact ? "p-3" : "p-4"
                    )}
                  >
                    <div className="mb-3 flex items-center justify-between pb-1">
                      <h3 className="text-[12px] font-bold uppercase tracking-widest text-foreground/80">
                        Belum Ditentukan
                      </h3>
                      <span className="rounded-full border border-border/80 bg-background px-2.5 py-1 text-[11px] font-mono font-semibold text-muted-foreground">
                        {board.unassigned.cardCount}
                      </span>
                    </div>
                    <div
                      className={cn(
                        "inbox-scroll flex-1 overflow-y-auto pr-1",
                        isCompact ? "space-y-3" : "space-y-4"
                      )}
                    >
                      {board.unassigned.cards.map((card) => (
                        <div
                          key={card.id}
                          draggable
                          onDragStart={() => setDraggedConversationId(card.id)}
                          onDragEnd={() => setDraggedConversationId(null)}
                          className={cn(
                            "cursor-grab rounded-2xl border border-border/60 bg-card shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] transition-shadow hover:shadow-[0_4px_16px_-4px_rgba(0,0,0,0.08)] active:cursor-grabbing",
                            isCompact ? "p-3.5" : "p-4"
                          )}
                        >
                          <p className="truncate text-sm font-semibold tracking-tight text-foreground">
                            {card.customerName}
                          </p>
                          <p className="truncate pt-1 text-[12px] text-muted-foreground">
                            {card.customerPhoneE164}
                          </p>
                          <p className="mt-2 line-clamp-3 text-[12px] leading-relaxed text-muted-foreground/90">
                            {card.lastMessagePreview ?? "Belum ada pesan"}
                          </p>
                          <div className="mt-3 flex items-center justify-end gap-1">
                            <CardIconActionButton
                              label="Open Inbox"
                              className="h-7 w-7"
                              onClick={() =>
                                router.push(`/inbox?conversationId=${encodeURIComponent(card.id)}`)
                              }
                            >
                              <Mailbox className="h-3.5 w-3.5" />
                            </CardIconActionButton>
                            <CardIconActionButton
                              label="Lihat Customer"
                              className="h-7 w-7"
                              onClick={() => {
                                void openLeadDrawer(card);
                              }}
                            >
                              <UserRound className="h-3.5 w-3.5" />
                            </CardIconActionButton>
                            <CardIconActionButton
                              label="Create Invoice"
                              className="h-7 w-7"
                              onClick={() => openInvoiceDrawerForCard(card)}
                            >
                              <FileText className="h-3.5 w-3.5" />
                            </CardIconActionButton>
                          </div>
                        </div>
                      ))}
                      {board.unassigned.cards.length === 0 ? (
                        <p className="text-xs text-muted-foreground">Belum ada kartu.</p>
                      ) : null}
                    </div>
                  </article>

                  {board.columns.map((column) => (
                    <article
                      key={column.stageId}
                      onDragOver={(event) => {
                        event.preventDefault();
                        setDragOverStageId(column.stageId);
                      }}
                      onDragLeave={() =>
                        setDragOverStageId((current) =>
                          current === column.stageId ? null : current
                        )
                      }
                      onDrop={async () => {
                        if (!draggedConversationId) {
                          return;
                        }
                        await moveConversation(draggedConversationId, column.stageId);
                        setDraggedConversationId(null);
                        setDragOverStageId(null);
                      }}
                      className={cn(
                        "flex h-full min-h-0 flex-col rounded-[22px] border shadow-sm",
                        isCompact ? "p-3" : "p-4",
                        dragOverStageId === column.stageId
                          ? "border-primary bg-primary/5"
                          : "border-border/70 bg-gradient-to-b from-card/30 to-background/5"
                      )}
                    >
                      <div className="mb-3 flex items-center justify-between gap-2 pb-1">
                        <div className="min-w-0">
                          <h3 className="truncate text-[12px] font-bold uppercase tracking-widest text-foreground/80">
                            {column.stageName}
                          </h3>
                          <p className="pt-0.5 text-[10px] uppercase text-muted-foreground">
                            Tahap {column.position + 1}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 rounded-full border px-2.5 py-1 font-mono text-[11px] font-semibold ${getStageColorClass(column.stageColor)}`}
                        >
                          {column.cardCount}
                        </span>
                      </div>

                      <div
                        className={cn(
                          "inbox-scroll flex-1 overflow-y-auto pr-1",
                          isCompact ? "space-y-3" : "space-y-4"
                        )}
                      >
                        {column.cards.map((card) => (
                          <div
                            key={card.id}
                            draggable
                            onDragStart={() => setDraggedConversationId(card.id)}
                            onDragEnd={() => setDraggedConversationId(null)}
                            className={cn(
                              "group flex cursor-grab flex-col rounded-2xl border border-border/60 bg-card shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] transition-shadow hover:shadow-[0_4px_16px_-4px_rgba(0,0,0,0.08)] active:cursor-grabbing",
                              isCompact ? "p-3.5" : "p-4"
                            )}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold tracking-tight text-foreground">
                                  {card.customerName}
                                </p>
                                <p className="truncate pt-px text-[12px] text-muted-foreground">
                                  {card.customerPhoneE164}
                                </p>
                              </div>
                              {card.unreadCount > 0 ? (
                                <span className="shrink-0 rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                                  {card.unreadCount} BARU
                                </span>
                              ) : null}
                            </div>

                            <p className="mt-2 line-clamp-3 text-[12px] leading-relaxed text-muted-foreground/90">
                              {card.lastMessagePreview ?? "Belum ada pesan"}
                            </p>

                            <div className="mt-2.5 flex items-center gap-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/80">
                              <span className="rounded bg-muted/40 px-1.5 py-0.5">
                                Inv: {card.invoiceCount}
                              </span>
                              <span className="rounded bg-muted/40 px-1.5 py-0.5">
                                Belum Lunas: {card.unpaidInvoiceCount}
                              </span>
                            </div>

                            <div className="mt-auto flex items-center justify-between gap-2 pt-3">
                              <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/70">
                                {formatLastActivity(card.lastMessageAt)}
                              </p>
                              <div className="flex items-center gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 md:opacity-100">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="ghost"
                                      className="h-6 w-6 p-0"
                                      title="Pindahkan kartu"
                                    >
                                      <span className="sr-only">Pindahkan kartu</span>
                                      <MoreHorizontal className="h-3.5 w-3.5" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuLabel>Pindahkan ke tahap</DropdownMenuLabel>
                                    {board.columns.map((targetColumn) => (
                                      <DropdownMenuItem
                                        key={targetColumn.stageId}
                                        disabled={
                                          targetColumn.stageId === column.stageId || isSavingMove
                                        }
                                        onClick={() => {
                                          void moveConversation(card.id, targetColumn.stageId);
                                        }}
                                      >
                                        {targetColumn.stageName}
                                      </DropdownMenuItem>
                                    ))}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                                <CardIconActionButton
                                  label="Open Inbox"
                                  onClick={() =>
                                    router.push(
                                      `/inbox?conversationId=${encodeURIComponent(card.id)}`
                                    )
                                  }
                                >
                                  <Mailbox className="h-3.5 w-3.5" />
                                </CardIconActionButton>
                                <CardIconActionButton
                                  label="Lihat Customer"
                                  onClick={() => {
                                    void openLeadDrawer(card);
                                  }}
                                >
                                  <UserRound className="h-3.5 w-3.5" />
                                </CardIconActionButton>
                                <CardIconActionButton
                                  label="Create Invoice"
                                  onClick={() => openInvoiceDrawerForCard(card)}
                                >
                                  <FileText className="h-3.5 w-3.5" />
                                </CardIconActionButton>
                              </div>
                            </div>
                          </div>
                        ))}
                        {column.cards.length === 0 ? (
                          <p className="text-xs text-muted-foreground">
                            Belum ada kartu di tahap ini.
                          </p>
                        ) : null}
                      </div>
                    </article>
                  ))}
                </div>
              </div>

              {canLoadMoreCards ? (
                <div className="px-3 pb-1 md:px-4">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setBoardCardLimit((current) =>
                        Math.min(320, current + BOARD_CARD_LIMIT_STEP)
                      );
                    }}
                    className="h-8"
                  >
                    Muat lebih banyak kartu
                  </Button>
                </div>
              ) : null}

              {activePipeline?.stages.length === 0 ? (
                <p className="px-1 text-sm text-muted-foreground">
                  Pipeline default belum punya tahap.
                </p>
              ) : null}
            </>
          ) : null}

          {!isLoadingBoard && !board ? (
            <div className="flex flex-1 items-center justify-center px-4">
              <div className="rounded-xl border border-border/70 bg-card/80 px-5 py-4 text-center">
                <p className="text-sm font-medium text-foreground">
                  Board pipeline belum tersedia.
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Silakan muat ulang atau buat tahap pipeline default di pengaturan CRM.
                </p>
                <div className="mt-3">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => void loadBoard("", { force: true })}
                  >
                    Muat ulang
                  </Button>
                </div>
              </div>
            </div>
          ) : null}

          <Drawer open={isLeadDrawerOpen} onOpenChange={setIsLeadDrawerOpen} direction="right">
            <DrawerContent className="data-[vaul-drawer-direction=right]:w-[35vw] data-[vaul-drawer-direction=right]:max-w-[35vw] data-[vaul-drawer-direction=right]:min-w-[420px] data-[vaul-drawer-direction=right]:border-l-border max-md:data-[vaul-drawer-direction=right]:max-w-full max-md:data-[vaul-drawer-direction=right]:min-w-0 max-md:data-[vaul-drawer-direction=right]:w-full">
              <DrawerHeader className="border-b border-border/70">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <DrawerTitle>
                      {selectedLead?.displayName?.trim() ||
                        selectedLead?.phoneE164 ||
                        "Customer Detail"}
                    </DrawerTitle>
                    <DrawerDescription>
                      {selectedLead?.phoneE164 || "Informasi customer."}
                    </DrawerDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedLead?.latestConversationId ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8"
                        onClick={() =>
                          router.push(
                            `/inbox?conversationId=${encodeURIComponent(selectedLead.latestConversationId ?? "")}`
                          )
                        }
                      >
                        Open Inbox
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8"
                      disabled={!selectedLead}
                      onClick={() => {
                        if (!selectedLead) {
                          return;
                        }
                        setInvoiceDrawerContext({
                          customerId: selectedLead.id,
                          conversationId: selectedLead.latestConversationId,
                          customerDisplayName: selectedLead.displayName,
                          customerPhoneE164: selectedLead.phoneE164
                        });
                        setIsInvoiceDrawerOpen(true);
                      }}
                    >
                      <FileText className="mr-1.5 h-3.5 w-3.5" />
                      Create Invoice
                    </Button>
                    <DrawerClose asChild>
                      <Button type="button" size="sm" variant="ghost" className="h-8 w-8 p-0">
                        <X className="h-4 w-4" />
                        <span className="sr-only">Close</span>
                      </Button>
                    </DrawerClose>
                  </div>
                </div>
              </DrawerHeader>

              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 md:px-6">
                {isLeadLoading || !selectedLead ? (
                  <p className="text-sm text-muted-foreground">Loading customer detail...</p>
                ) : (
                  <Tabs defaultValue="information" className="w-full">
                    <TabsList className="grid h-11 w-full grid-cols-2 rounded-xl bg-muted/40 p-1">
                      <TabsTrigger
                        value="information"
                        className="rounded-lg text-[13px] font-medium"
                      >
                        Information
                      </TabsTrigger>
                      <TabsTrigger
                        value="activities"
                        className="rounded-lg text-[13px] font-medium"
                      >
                        Activities
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="information" className="mt-5">
                      <div className="grid gap-x-4 gap-y-5 md:grid-cols-2">
                        <div className="space-y-1">
                          <p className="pl-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70">
                            Name
                          </p>
                          <Input
                            value={selectedLead.displayName ?? ""}
                            onChange={(event) =>
                              updateSelectedLead("displayName", event.target.value)
                            }
                            className="h-10 rounded-xl bg-muted/20 focus-visible:bg-transparent"
                          />
                        </div>
                        <div className="space-y-1">
                          <p className="pl-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70">
                            WhatsApp
                          </p>
                          <Input
                            value={selectedLead.phoneE164}
                            onChange={(event) =>
                              updateSelectedLead("phoneE164", event.target.value)
                            }
                            className="h-10 rounded-xl bg-muted/20 focus-visible:bg-transparent"
                          />
                        </div>
                        <div className="space-y-1">
                          <p className="pl-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70">
                            Status Lead
                          </p>
                          <Select
                            value={selectedLead.leadStatus}
                            onValueChange={(value) => updateSelectedLead("leadStatus", value)}
                          >
                            <SelectTrigger className="h-10 rounded-xl bg-muted/20 focus-visible:bg-transparent">
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
                          <p className="pl-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70">
                            Follow-up
                          </p>
                          <Select
                            value={selectedLead.followUpStatus ?? "WAIT_RESPON"}
                            onValueChange={(value) => updateSelectedLead("followUpStatus", value)}
                          >
                            <SelectTrigger className="h-10 rounded-xl bg-muted/20 focus-visible:bg-transparent">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {FOLLOW_UP_OPTIONS.map((item) => (
                                <SelectItem key={item} value={item}>
                                  {formatLabel(item)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <p className="pl-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70">
                            Follow-up Date
                          </p>
                          <Input
                            type="date"
                            value={
                              selectedLead.followUpAt ? selectedLead.followUpAt.slice(0, 10) : ""
                            }
                            className="h-10 rounded-xl bg-muted/20 focus-visible:bg-transparent"
                            onChange={(event) => {
                              const value = event.target.value;
                              if (!value) {
                                updateSelectedLead("followUpAt", null);
                                return;
                              }
                              const base = selectedLead.followUpAt
                                ? new Date(selectedLead.followUpAt)
                                : new Date();
                              const next = new Date(
                                `${value}T${String(base.getHours()).padStart(2, "0")}:${String(base.getMinutes()).padStart(2, "0")}:00`
                              );
                              updateSelectedLead(
                                "followUpAt",
                                Number.isNaN(next.getTime()) ? null : next.toISOString()
                              );
                            }}
                          />
                        </div>
                        <div className="space-y-1">
                          <p className="pl-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70">
                            Follow-up Time
                          </p>
                          <Input
                            type="time"
                            value={
                              selectedLead.followUpAt
                                ? `${String(new Date(selectedLead.followUpAt).getHours()).padStart(2, "0")}:${String(new Date(selectedLead.followUpAt).getMinutes()).padStart(2, "0")}`
                                : "09:00"
                            }
                            disabled={!selectedLead.followUpAt}
                            className="h-10 rounded-xl bg-muted/20 focus-visible:bg-transparent"
                            onChange={(event) => {
                              if (!selectedLead.followUpAt) {
                                return;
                              }
                              const [hourText, minuteText] = event.target.value.split(":");
                              const next = new Date(selectedLead.followUpAt);
                              next.setHours(Number(hourText), Number(minuteText), 0, 0);
                              updateSelectedLead("followUpAt", next.toISOString());
                            }}
                          />
                        </div>
                        <div className="space-y-1">
                          <p className="pl-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70">
                            Business Category
                          </p>
                          <Input
                            list="crm-pipeline-business-category-options"
                            value={selectedLead.businessCategory ?? ""}
                            className="h-10 rounded-xl bg-muted/20 focus-visible:bg-transparent"
                            onChange={(event) =>
                              updateSelectedLead("businessCategory", event.target.value || null)
                            }
                          />
                          <datalist id="crm-pipeline-business-category-options">
                            {BUSINESS_CATEGORY_OPTIONS.map((category) => (
                              <option key={category} value={category} />
                            ))}
                          </datalist>
                        </div>
                        <div className="space-y-1">
                          <p className="pl-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70">
                            Detail
                          </p>
                          <Input
                            value={selectedLead.detail ?? ""}
                            className="h-10 rounded-xl bg-muted/20 focus-visible:bg-transparent"
                            onChange={(event) =>
                              updateSelectedLead("detail", event.target.value || null)
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <p className="pl-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70">
                            Source
                          </p>
                          <Input
                            value={selectedLead.source ?? ""}
                            className="h-10 rounded-xl bg-muted/20 focus-visible:bg-transparent"
                            onChange={(event) =>
                              updateSelectedLead("source", event.target.value || null)
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <p className="pl-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70">
                            Pipeline Stage
                          </p>
                          <Select
                            value={selectedLead.crmStageId ?? "__none__"}
                            onValueChange={(value) => {
                              if (value === "__none__") {
                                updateSelectedLead("crmStageId", null);
                                updateSelectedLead("crmStageName", null);
                                return;
                              }
                              const selectedStage = pipelineStageOptions.find(
                                (stage) => stage.stageId === value
                              );
                              updateSelectedLead("crmStageId", value);
                              updateSelectedLead("crmStageName", selectedStage?.stageName ?? null);
                            }}
                          >
                            <SelectTrigger className="h-10 rounded-xl bg-muted/20 focus-visible:bg-transparent">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">Unassigned</SelectItem>
                              {pipelineStageOptions.map((stage) => (
                                <SelectItem key={stage.stageId} value={stage.stageId}>
                                  {stage.stageName}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <p className="pl-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70">
                            Project Value (IDR)
                          </p>
                          <Input
                            type="number"
                            value={Math.round(selectedLead.projectValueCents / 100)}
                            className="h-10 rounded-xl bg-muted/20 focus-visible:bg-transparent"
                            onChange={(event) =>
                              updateSelectedLead(
                                "projectValueCents",
                                Math.max(0, Number(event.target.value || "0")) * 100
                              )
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <p className="pl-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70">
                            Assignee
                          </p>
                          <Select
                            value={selectedLead.assignedToMemberId ?? "__none__"}
                            onValueChange={(value) =>
                              updateSelectedLead(
                                "assignedToMemberId",
                                value === "__none__" ? null : value
                              )
                            }
                          >
                            <SelectTrigger className="h-10 rounded-xl bg-muted/20 focus-visible:bg-transparent">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">Unassigned</SelectItem>
                              {assigneeOptions.map((assignee) => (
                                <SelectItem key={assignee.memberId} value={assignee.memberId}>
                                  {assignee.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1 md:col-span-2">
                          <p className="pl-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70">
                            Notes
                          </p>
                          <Textarea
                            value={selectedLead.remarks ?? ""}
                            className="min-h-[100px] rounded-xl bg-muted/20 focus-visible:bg-transparent"
                            onChange={(event) =>
                              updateSelectedLead("remarks", event.target.value || null)
                            }
                          />
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="activities" className="mt-5">
                      <div className="space-y-3">
                        {leadChangeLog.length === 0 ? (
                          <p className="text-sm text-muted-foreground">Belum ada aktivitas.</p>
                        ) : null}
                        {leadChangeLog.map((entry) => (
                          <div
                            key={entry.id}
                            className="rounded-xl border border-border/70 bg-card/80 p-3"
                          >
                            <p className="text-sm font-semibold text-foreground">
                              {entry.action.replace(/_/g, " ")}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {entry.actorName ?? "System"} • {formatLastActivity(entry.createdAt)}
                            </p>
                          </div>
                        ))}
                      </div>
                    </TabsContent>
                  </Tabs>
                )}
              </div>

              <DrawerFooter className="border-t border-border/70 bg-background px-5 py-4 md:px-6">
                <Button
                  type="button"
                  disabled={isLeadSaving || isLeadLoading || !selectedLead}
                  onClick={() => void handleSaveLead()}
                >
                  {isLeadSaving ? "Saving..." : "Save Changes"}
                </Button>
              </DrawerFooter>
            </DrawerContent>
          </Drawer>

          <InvoiceDrawer
            open={isInvoiceDrawerOpen}
            customerId={invoiceDrawerContext.customerId}
            conversationId={invoiceDrawerContext.conversationId}
            orgId={activeBusiness?.id ?? null}
            customerDisplayName={invoiceDrawerContext.customerDisplayName}
            customerPhoneE164={invoiceDrawerContext.customerPhoneE164}
            onClose={() => setIsInvoiceDrawerOpen(false)}
          />
        </section>
      </section>
    </TooltipProvider>
  );
}
