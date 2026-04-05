"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MoreHorizontal, Workflow } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { subscribeToOrgMessageEvents } from "@/lib/ably/client";
import { fetchOrganizationsCached } from "@/lib/client/orgsCache";
import { dismissNotify, notifyError, notifyLoading } from "@/lib/ui/notify";
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

type RealtimeConnectionState = "initialized" | "connecting" | "connected" | "disconnected" | "suspended" | "failed";
type RealtimeSubscriptionStatus = "connecting" | "connected" | "reconnecting" | "fallback";

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
  const [orgs, setOrgs] = useState<OrgItem[]>([]);
  const [hasLoadedOrganizations, setHasLoadedOrganizations] = useState(false);
  const [board, setBoard] = useState<KanbanBoard | null>(null);
  const [boardCardLimit, setBoardCardLimit] = useState(DEFAULT_BOARD_CARD_LIMIT);
  const [isLoadingBoard, setIsLoadingBoard] = useState(true);
  const [isRefreshingBoard, setIsRefreshingBoard] = useState(false);
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeSubscriptionStatus>("connecting");
  const [error, setError] = useState<string | null>(null);
  const [isSavingMove, setIsSavingMove] = useState(false);
  const [draggedConversationId, setDraggedConversationId] = useState<string | null>(null);
  const [dragOverStageId, setDragOverStageId] = useState<string | null>(null);
  const realtimeStatusRef = useRef<RealtimeSubscriptionStatus>("connecting");
  const boardCacheRef = useRef<Map<string, BoardCacheEntry>>(new Map());
  const boardInFlightRef = useRef<{ key: string; promise: Promise<void> } | null>(null);
  const boardAbortControllerRef = useRef<AbortController | null>(null);
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
    setRealtimeStatus((current) => (current === nextStatus ? current : nextStatus));
  }, []);

  const writeBoardCache = useCallback((nextBoard: KanbanBoard | null, pipelineIdOverride?: string) => {
    const orgId = activeBusiness?.id ?? "";
    if (!orgId) {
      return;
    }

    const pipelineId = pipelineIdOverride ?? nextBoard?.pipeline?.id ?? boardRef.current?.pipeline?.id ?? "";
    const cacheKey = `${orgId}::${pipelineId || "__default__"}::limit:${boardCardLimit}`;
    boardCacheRef.current.set(cacheKey, {
      board: nextBoard,
      cachedAt: Date.now()
    });
  }, [activeBusiness?.id, boardCardLimit]);

  const loadBoard = useCallback(async (pipelineId: string, options?: { force?: boolean }) => {
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
    const cacheKey = `${orgId}::${pipelineId || "__default__"}::limit:${boardCardLimit}`;
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
          ? `?pipelineId=${encodeURIComponent(pipelineId)}&status=OPEN&orgId=${encodeURIComponent(orgId)}&cardLimit=${encodeURIComponent(String(boardCardLimit))}`
          : `?status=OPEN&orgId=${encodeURIComponent(orgId)}&cardLimit=${encodeURIComponent(String(boardCardLimit))}`;
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
  }, [activeBusiness?.id, boardCardLimit, hasLoadedOrganizations, recordPerf, writeBoardCache]);

  const moveConversation = useCallback(async (conversationId: string, stageId: string) => {
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
      (column) => column.stageId === stageId && column.cards.some((card) => card.id === conversationId)
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
      const response = await fetch(`/api/conversations/${encodeURIComponent(conversationId)}/pipeline`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          orgId: activeBusiness?.id ?? "",
          pipelineId: board.pipeline?.id,
          stageId
        })
      });
      const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
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
  }, [activeBusiness?.id, board, isSavingMove, recordPerf, writeBoardCache]);

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
      const eventIso = Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
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

        const inUnassignedIndex = current.unassigned.cards.findIndex((card) => card.id === conversationId);
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

        const sourceColumnIndex = current.columns.findIndex((column) => column.cards.some((card) => card.id === conversationId));
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
        const sourceInUnassigned = current.unassigned.cards.find((card) => card.id === input.conversationId);
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

        const unassignedPool = current.unassigned.cards.filter((card) => card.id !== input.conversationId);
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
        const targetColumnExists = Boolean(targetStageId && columnsPool.some((column) => column.stageId === targetStageId));
        const nextUnassignedCards = targetColumnExists ? unassignedPool : [patchCard, ...unassignedPool];
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
            bumpCardRealtime(payload.conversationId, payload.timestamp, payload.direction === "INBOUND");
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
        const message = subscriptionError instanceof Error ? subscriptionError.message : "Unknown realtime subscribe error";
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
  }, [activeBusiness?.id, hasLoadedOrganizations, loadBoard, updateRealtimeStatus, writeBoardCache]);

  const activePipeline = useMemo(() => board?.pipeline ?? null, [board]);
  const realtimeStatusMeta = useMemo(() => {
    if (realtimeStatus === "connected") {
      return {
        label: "Realtime tersambung",
        description: "Perubahan stage dan pesan masuk disinkronkan langsung.",
        className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
      };
    }
    if (realtimeStatus === "reconnecting") {
      return {
        label: "Realtime menyambung ulang",
        description: "Sementara memakai fallback polling adaptif.",
        className: "border-amber-500/30 bg-amber-500/10 text-amber-700"
      };
    }
    if (realtimeStatus === "fallback") {
      return {
        label: "Fallback polling aktif",
        description: "Koneksi realtime sedang bermasalah, board tetap disegarkan berkala.",
        className: "border-rose-500/30 bg-rose-500/10 text-rose-700"
      };
    }
    return {
      label: "Menghubungkan realtime",
      description: "Menyiapkan sinkronisasi CRM pipeline...",
      className: "border-sky-500/30 bg-sky-500/10 text-sky-700"
    };
  }, [realtimeStatus]);

  const isCompact = true;
  const totalBoardColumns = (board?.columns.length ?? 0) + 1;
  const canLoadMoreCards = Boolean(
    boardCardLimit < 320 && (board?.unassigned.hasMore || board?.columns.some((column) => column.hasMore))
  );

  return (
    <section className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex items-center gap-3 px-3 pb-2 pt-3 md:gap-4 md:px-4 md:pt-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-primary/20 to-primary/5 text-primary shadow-inner ring-1 ring-primary/20 md:h-12 md:w-12 md:rounded-[18px]">
          <Workflow className="h-5 w-5 md:h-6 md:w-6" />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground md:text-3xl">CRM Pipeline</h1>
          <p className="text-xs text-muted-foreground md:text-sm">Kelola pergerakan lead antar stage CRM secara cepat dalam satu workspace.</p>
        </div>
      </div>
      <div className={`mx-3 mb-1 rounded-xl border px-3 py-2 text-xs md:mx-4 ${realtimeStatusMeta.className}`} aria-live="polite">
        <p className="font-semibold">{realtimeStatusMeta.label}</p>
        <p className="text-[11px] text-current/80">{realtimeStatusMeta.description}</p>
        {isRefreshingBoard ? <p className="pt-1 text-[11px] font-medium text-current/85">Menyegarkan board...</p> : null}
      </div>
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden pt-2">
        {isLoadingBoard ? <p className="px-3 py-3 text-sm text-muted-foreground md:px-4">Memuat board pipeline...</p> : null}

        {!isLoadingBoard && board ? (
          <>
            <div className="inbox-scroll min-h-0 flex-1 overflow-x-auto overflow-y-hidden px-3 py-3 md:px-4 md:py-4">
              <div
                className={cn("grid h-full min-h-0 min-w-full items-stretch", isCompact ? "gap-3" : "gap-4")}
                style={{ gridTemplateColumns: `repeat(${totalBoardColumns}, minmax(320px, 1fr))` }}
              >
              <article className={cn("flex h-full min-h-0 flex-col rounded-[22px] border border-border/70 bg-gradient-to-b from-card/30 to-background/5 shadow-sm", isCompact ? "p-3" : "p-4")}>
                <div className="mb-3 flex items-center justify-between pb-1">
                  <h3 className="text-[12px] font-bold uppercase tracking-widest text-foreground/80">Belum Ditentukan</h3>
                  <span className="rounded-full border border-border/80 bg-background px-2.5 py-1 text-[11px] font-mono font-semibold text-muted-foreground">{board.unassigned.cardCount}</span>
                </div>
                <div className={cn("inbox-scroll flex-1 overflow-y-auto pr-1", isCompact ? "space-y-3" : "space-y-4")}>
                  {board.unassigned.cards.map((card) => (
                    <div
                      key={card.id}
                      draggable
                      onDragStart={() => setDraggedConversationId(card.id)}
                      onDragEnd={() => setDraggedConversationId(null)}
                      className={cn("cursor-grab rounded-2xl border border-border/60 bg-card shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] transition-shadow hover:shadow-[0_4px_16px_-4px_rgba(0,0,0,0.08)] active:cursor-grabbing", isCompact ? "p-3.5" : "p-4")}
                    >
                      <p className="truncate text-sm font-semibold tracking-tight text-foreground">{card.customerName}</p>
                      <p className="truncate pt-1 text-[12px] text-muted-foreground">{card.customerPhoneE164}</p>
                      <p className="mt-2 line-clamp-3 text-[12px] leading-relaxed text-muted-foreground/90">{card.lastMessagePreview ?? "Belum ada pesan"}</p>
                    </div>
                  ))}
                  {board.unassigned.cards.length === 0 ? <p className="text-xs text-muted-foreground">Belum ada kartu.</p> : null}
                </div>
              </article>

              {board.columns.map((column) => (
                <article
                  key={column.stageId}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDragOverStageId(column.stageId);
                  }}
                  onDragLeave={() => setDragOverStageId((current) => (current === column.stageId ? null : current))}
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
                    dragOverStageId === column.stageId ? "border-primary bg-primary/5" : "border-border/70 bg-gradient-to-b from-card/30 to-background/5"
                  )}
                >
                  <div className="mb-3 flex items-center justify-between gap-2 pb-1">
                    <div className="min-w-0">
                      <h3 className="truncate text-[12px] font-bold uppercase tracking-widest text-foreground/80">{column.stageName}</h3>
                      <p className="pt-0.5 text-[10px] uppercase text-muted-foreground">Tahap {column.position + 1}</p>
                    </div>
                    <span className={`shrink-0 rounded-full border px-2.5 py-1 font-mono text-[11px] font-semibold ${getStageColorClass(column.stageColor)}`}>
                      {column.cardCount}
                    </span>
                  </div>

                  <div className={cn("inbox-scroll flex-1 overflow-y-auto pr-1", isCompact ? "space-y-3" : "space-y-4")}>
                    {column.cards.map((card) => (
                    <div
                      key={card.id}
                      draggable
                      onDragStart={() => setDraggedConversationId(card.id)}
                      onDragEnd={() => setDraggedConversationId(null)}
                      className={cn("group flex cursor-grab flex-col rounded-2xl border border-border/60 bg-card shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] transition-shadow hover:shadow-[0_4px_16px_-4px_rgba(0,0,0,0.08)] active:cursor-grabbing", isCompact ? "p-3.5" : "p-4")}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold tracking-tight text-foreground">{card.customerName}</p>
                          <p className="truncate pt-px text-[12px] text-muted-foreground">{card.customerPhoneE164}</p>
                        </div>
                        {card.unreadCount > 0 ? (
                          <span className="shrink-0 rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">{card.unreadCount} BARU</span>
                        ) : null}
                      </div>

                      <p className="mt-2 line-clamp-3 text-[12px] leading-relaxed text-muted-foreground/90">{card.lastMessagePreview ?? "Belum ada pesan"}</p>
                      
                      <div className="mt-2.5 flex items-center gap-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/80">
                        <span className="rounded bg-muted/40 px-1.5 py-0.5">Inv: {card.invoiceCount}</span>
                        <span className="rounded bg-muted/40 px-1.5 py-0.5">Belum Lunas: {card.unpaidInvoiceCount}</span>
                      </div>

                      <div className="mt-auto flex items-center justify-between gap-2 pt-3">
                        <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/70">{formatLastActivity(card.lastMessageAt)}</p>
                        <div className="flex items-center gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 md:opacity-100">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button type="button" size="sm" variant="ghost" className="h-6 w-6 p-0">
                                  <span className="sr-only">Pindahkan kartu</span>
                                  <MoreHorizontal className="h-3.5 w-3.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Pindahkan ke tahap</DropdownMenuLabel>
                                {board.columns.map((targetColumn) => (
                                  <DropdownMenuItem
                                    key={targetColumn.stageId}
                                    disabled={targetColumn.stageId === column.stageId || isSavingMove}
                                    onClick={() => {
                                      void moveConversation(card.id, targetColumn.stageId);
                                    }}
                                  >
                                    {targetColumn.stageName}
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
                            <Link
                              href={`/inbox?conversationId=${encodeURIComponent(card.id)}`}
                              prefetch={false}
                              className="text-[11px] font-medium text-primary underline-offset-2 hover:underline"
                            >
                              Buka Inbox
                            </Link>
                          </div>
                        </div>
                      </div>
                    ))}
                    {column.cards.length === 0 ? <p className="text-xs text-muted-foreground">Belum ada kartu di tahap ini.</p> : null}
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
                    setBoardCardLimit((current) => Math.min(320, current + BOARD_CARD_LIMIT_STEP));
                  }}
                  className="h-8"
                >
                  Muat lebih banyak kartu
                </Button>
              </div>
            ) : null}

            {activePipeline?.stages.length === 0 ? <p className="px-1 text-sm text-muted-foreground">Pipeline default belum punya tahap.</p> : null}
          </>
        ) : null}

        {!isLoadingBoard && !board ? (
          <div className="flex flex-1 items-center justify-center px-4">
            <div className="rounded-xl border border-border/70 bg-card/80 px-5 py-4 text-center">
              <p className="text-sm font-medium text-foreground">Board pipeline belum tersedia.</p>
              <p className="mt-1 text-xs text-muted-foreground">Silakan muat ulang atau buat tahap pipeline default di pengaturan CRM.</p>
              <div className="mt-3">
                <Button type="button" size="sm" variant="secondary" onClick={() => void loadBoard("", { force: true })}>
                  Muat ulang
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </section>
  );
}
