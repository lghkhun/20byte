"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { MoreHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { notifyError } from "@/lib/ui/notify";
import { cn } from "@/lib/utils";

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
    cards: KanbanCard[];
  };
};

const STAGE_COLOR_CLASS: Record<string, string> = {
  emerald: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700",
  amber: "border-amber-500/30 bg-amber-500/10 text-amber-700",
  sky: "border-sky-500/30 bg-sky-500/10 text-sky-700",
  violet: "border-violet-500/30 bg-violet-500/10 text-violet-700",
  rose: "border-rose-500/30 bg-rose-500/10 text-rose-700",
  slate: "border-slate-500/30 bg-slate-500/10 text-slate-700"
};

function formatLastActivity(value: string | null): string {
  if (!value) {
    return "No activity yet";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "No activity yet";
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function getStageColorClass(color: string): string {
  return STAGE_COLOR_CLASS[color] ?? "border-border bg-muted/40 text-foreground";
}

export function CrmPipelineWorkspace() {
  const [board, setBoard] = useState<KanbanBoard | null>(null);
  const [isLoadingBoard, setIsLoadingBoard] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSavingMove, setIsSavingMove] = useState(false);
  const [draggedConversationId, setDraggedConversationId] = useState<string | null>(null);
  const [dragOverStageId, setDragOverStageId] = useState<string | null>(null);

  const loadBoard = useCallback(async (pipelineId: string) => {
    setIsLoadingBoard(true);
    setError(null);
    try {
      const query = pipelineId ? `?pipelineId=${encodeURIComponent(pipelineId)}&status=OPEN` : "?status=OPEN";
      const response = await fetch(`/api/crm/pipelines/board${query}`, {
        cache: "no-store"
      });
      const payload = (await response.json().catch(() => null)) as { data?: { board?: KanbanBoard }; error?: { message?: string } } | null;
      if (!response.ok) {
        setError(payload?.error?.message ?? "Failed to load CRM board.");
        return;
      }

      const nextBoard = payload?.data?.board ?? null;
      setBoard(nextBoard);
    } catch {
      setError("Network error while loading CRM board.");
    } finally {
      setIsLoadingBoard(false);
    }
  }, []);

  const moveConversation = useCallback(async (conversationId: string, stageId: string) => {
    if (!board || isSavingMove) {
      return;
    }

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

      return {
        ...current,
        unassigned: {
          ...current.unassigned,
          cards: nextUnassignedCards,
          cardCount: nextUnassignedCards.length
        },
        columns: finalColumns.map((column) => ({
          ...column,
          cardCount: column.cards.length
        }))
      };
    });

    if (!movedCard) {
      return;
    }

    setIsSavingMove(true);
    setError(null);
    try {
      const response = await fetch(`/api/conversations/${encodeURIComponent(conversationId)}/pipeline`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          pipelineId: board.pipeline?.id,
          stageId
        })
      });
      const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
      if (!response.ok) {
        setBoard(previousBoard);
        setError(payload?.error?.message ?? "Failed to move conversation.");
        return;
      }
    } catch {
      setBoard(previousBoard);
      setError("Network error while moving conversation.");
    } finally {
      setIsSavingMove(false);
    }
  }, [board, isSavingMove]);

  useEffect(() => {
    void loadBoard("");
  }, [loadBoard]);

  useEffect(() => {
    if (!error) return;
    notifyError(error);
  }, [error]);

  const activePipeline = useMemo(() => board?.pipeline ?? null, [board]);

  const isCompact = true;
  const totalBoardColumns = (board?.columns.length ?? 0) + 1;

  return (
    <section className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex items-center justify-between gap-2 px-3 pt-2 text-xs text-muted-foreground md:px-4">
          <p>Drag and drop leads between stages to update pipeline progress.</p>
          {isSavingMove ? <p className="font-medium text-foreground">Saving move...</p> : null}
        </div>
        {isLoadingBoard ? <p className="px-3 py-3 text-sm text-muted-foreground md:px-4">Loading board...</p> : null}

        {!isLoadingBoard && board ? (
          <>
            <div className="inbox-scroll min-h-0 flex-1 overflow-x-auto overflow-y-hidden px-3 py-3 md:px-4 md:py-4">
              <div
                className={cn("grid h-full min-h-0 min-w-full items-stretch", isCompact ? "gap-3" : "gap-4")}
                style={{ gridTemplateColumns: `repeat(${totalBoardColumns}, minmax(320px, 1fr))` }}
              >
              <article className={cn("flex h-full min-h-0 flex-col rounded-[22px] border border-dashed border-border/80 bg-background/45", isCompact ? "p-3" : "p-4")}>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-[13px] font-semibold uppercase tracking-[0.16em] text-foreground">Unassigned</h3>
                  <span className="rounded-full border border-border bg-background px-2.5 py-1 text-[11px] text-muted-foreground">{board.unassigned.cardCount}</span>
                </div>
                <div className={cn("inbox-scroll flex-1 overflow-y-auto pr-1", isCompact ? "space-y-3" : "space-y-4")}>
                  {board.unassigned.cards.map((card) => (
                    <div
                      key={card.id}
                      draggable
                      onDragStart={() => setDraggedConversationId(card.id)}
                      onDragEnd={() => setDraggedConversationId(null)}
                      className={cn("cursor-grab rounded-[18px] border border-border/80 bg-card shadow-sm active:cursor-grabbing", isCompact ? "p-3.5" : "p-4")}
                    >
                      <p className="truncate text-[15px] font-semibold text-foreground">{card.customerName}</p>
                      <p className="truncate pt-1 text-[12px] text-muted-foreground">{card.customerPhoneE164}</p>
                      <p className="mt-2 line-clamp-3 text-[12px] leading-6 text-muted-foreground">{card.lastMessagePreview ?? "No message yet"}</p>
                    </div>
                  ))}
                  {board.unassigned.cards.length === 0 ? <p className="text-xs text-muted-foreground">No cards.</p> : null}
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
                    "flex h-full min-h-0 flex-col rounded-[22px] border",
                    isCompact ? "p-3" : "p-4",
                    dragOverStageId === column.stageId ? "border-primary bg-primary/5" : "border-border/80 bg-background/60"
                  )}
                >
                  <div className="mb-2.5 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate text-[13px] font-semibold uppercase tracking-[0.16em] text-foreground">{column.stageName}</h3>
                      <p className="pt-0.5 text-[11px] text-muted-foreground">Stage {column.position + 1}</p>
                    </div>
                    <span className={`rounded-full border px-2.5 py-1 text-[11px] ${getStageColorClass(column.stageColor)}`}>
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
                        className={cn("cursor-grab rounded-[18px] border border-border/80 bg-card shadow-sm active:cursor-grabbing", isCompact ? "p-2.5" : "p-3")}
                      >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-[15px] font-semibold text-foreground">{card.customerName}</p>
                          <p className="truncate pt-px text-[12px] leading-4.5 text-muted-foreground">{card.customerPhoneE164}</p>
                        </div>
                        {card.unreadCount > 0 ? (
                          <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] text-primary">{card.unreadCount} unread</span>
                        ) : null}
                      </div>
                        <p className="mt-1 line-clamp-3 text-[12px] leading-5 text-muted-foreground">{card.lastMessagePreview ?? "No message yet"}</p>
                        <div className="mt-1.5 flex items-center gap-3 text-[11px] leading-4.5 text-muted-foreground">
                          <span>Invoice: {card.invoiceCount}</span>
                          <span>Unpaid: {card.unpaidInvoiceCount}</span>
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <p className="text-[11px] leading-4.5 text-muted-foreground">Last activity: {formatLastActivity(card.lastMessageAt)}</p>
                          <div className="flex items-center gap-1">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button type="button" size="sm" variant="ghost" className="h-6 w-6 p-0">
                                  <span className="sr-only">Move card</span>
                                  <MoreHorizontal className="h-3.5 w-3.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Move to stage</DropdownMenuLabel>
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
                              Open Inbox
                            </Link>
                          </div>
                        </div>
                      </div>
                    ))}
                    {column.cards.length === 0 ? <p className="text-xs text-muted-foreground">No cards in this stage yet.</p> : null}
                  </div>

                  {board.unassigned.cards.length > 0 ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="mt-3 h-9 w-full rounded-xl border border-border/80 bg-background text-[11px]"
                      disabled={isSavingMove}
                      onClick={async () => {
                        const topUnassigned = board.unassigned.cards[0];
                        if (!topUnassigned) {
                          return;
                        }
                        await moveConversation(topUnassigned.id, column.stageId);
                      }}
                    >
                      Move 1 lead from Unassigned
                    </Button>
                  ) : null}
                </article>
              ))}
              </div>
            </div>

            {activePipeline?.stages.length === 0 ? <p className="px-1 text-sm text-muted-foreground">Default pipeline has no stages yet.</p> : null}
          </>
        ) : null}

        {!isLoadingBoard && !board ? (
          <div className="flex flex-1 items-center justify-center px-4">
            <div className="rounded-xl border border-border/70 bg-card/80 px-5 py-4 text-center">
              <p className="text-sm font-medium text-foreground">Pipeline board is unavailable.</p>
              <p className="mt-1 text-xs text-muted-foreground">Please refresh or create a default pipeline stage in CRM settings.</p>
            </div>
          </div>
        ) : null}
      </section>
    </section>
  );
}
