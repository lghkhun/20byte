import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Plus, RefreshCw, Search } from "lucide-react";

import { ConversationRow } from "@/components/inbox/conversation-list/ConversationRow";
import { ConversationListSkeleton } from "@/components/inbox/conversation-list/ConversationListSkeleton";
import { IndicatorLegend } from "@/components/inbox/IndicatorLegend";
import type { ConversationListFilter, ConversationItem, ConversationStatusFilter } from "@/components/inbox/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyStatePanel, ErrorStatePanel } from "@/components/ui/state-panels";
import { normalizeWhatsAppDestination } from "@/lib/whatsapp/e164";

type ConversationListPanelProps = {
  density: "compact" | "comfy";
  conversations: ConversationItem[];
  selectedConversationId: string | null;
  filter: ConversationListFilter;
  status: ConversationStatusFilter;
  searchQuery: string;
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  onFilterChange: (nextFilter: ConversationListFilter) => void;
  onStatusChange: (nextStatus: ConversationStatusFilter) => void;
  onSearchQueryChange: (nextQuery: string) => void;
  onSelectConversation: (conversationId: string) => void;
  onRefresh: () => void;
  onLoadMore: () => void;
  onCreateConversation: (input: { phoneE164: string; customerDisplayName?: string }) => Promise<void>;
};

export function ConversationListPanel({
  density,
  conversations,
  selectedConversationId,
  filter,
  status,
  searchQuery,
  isLoading,
  isLoadingMore,
  hasMore,
  error,
  onFilterChange,
  onStatusChange,
  onSearchQueryChange,
  onSelectConversation,
  onRefresh,
  onLoadMore,
  onCreateConversation
}: ConversationListPanelProps) {
  const [isNewMessageOpen, setIsNewMessageOpen] = useState(false);
  const [newPhone, setNewPhone] = useState("");
  const [newName, setNewName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [showUnreadOnly, setShowUnreadOnly] = useState(true);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const listScrollRef = useRef<HTMLDivElement | null>(null);
  const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);
  const loadMoreLockRef = useRef(false);

  const filteredConversations = useMemo(() => {
    const nextItems = conversations.filter((conversation) => {
      if (showUnreadOnly && conversation.unreadCount <= 0) {
        return false;
      }
      return true;
    });

    return nextItems.sort((left, right) => {
      const leftTime = new Date(left.lastMessageAt ?? left.updatedAt).getTime();
      const rightTime = new Date(right.lastMessageAt ?? right.updatedAt).getTime();
      return rightTime - leftTime;
    });
  }, [conversations, showUnreadOnly]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!hasMore || isLoading || error) {
      return;
    }

    const root = listScrollRef.current;
    const sentinel = loadMoreSentinelRef.current;
    if (!root || !sentinel) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) {
          return;
        }

        if (loadMoreLockRef.current || isLoadingMore || !hasMore) {
          return;
        }

        loadMoreLockRef.current = true;
        onLoadMore();
      },
      {
        root,
        rootMargin: "120px 0px",
        threshold: 0.05
      }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [error, hasMore, isLoading, isLoadingMore, onLoadMore]);

  useEffect(() => {
    if (!isLoadingMore) {
      loadMoreLockRef.current = false;
    }
  }, [isLoadingMore]);

  const tabItems = [
    {
      key: "all",
      label: "Semua",
      count: conversations.length,
      isActive: filter === "ALL" && status === "OPEN" && !showUnreadOnly,
      onClick: () => {
        setShowUnreadOnly(false);
        onFilterChange("ALL");
        onStatusChange("OPEN");
      }
    },

    {
      key: "unread",
      label: "Belum Dibaca",
      count: conversations.filter((item) => item.unreadCount > 0 && item.status === "OPEN").length,
      isActive: showUnreadOnly && status === "OPEN",
      onClick: () => {
        setShowUnreadOnly(true);
        onFilterChange("ALL");
        onStatusChange("OPEN");
      }
    },
    {
      key: "resolved",
      label: "Selesai",
      count: status === "CLOSED" ? conversations.length : 0,
      isActive: status === "CLOSED",
      onClick: () => {
        setShowUnreadOnly(false);
        onFilterChange("ALL");
        onStatusChange("CLOSED");
      }
    }
  ];

  return (
    <section data-panel="conversation-list" className="inbox-scroll relative flex h-full min-h-0 max-h-full flex-col overflow-y-auto overscroll-contain bg-card/95 backdrop-blur-sm">
      <div className="shrink-0 space-y-3 border-b border-border/70 bg-card/95 px-4 py-3 sm:space-y-4 sm:px-5 sm:py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-0.5">
            <h2 className="text-base font-bold tracking-tight text-foreground sm:text-lg">Inbox</h2>
            <p className="text-[11px] text-muted-foreground sm:text-xs">{filteredConversations.length} percakapan aktif</p>
          </div>
          <IndicatorLegend compact />
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-1 rounded-xl border border-border/60 bg-muted/30 p-1 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {tabItems.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={item.onClick}
              className={`flex flex-1 shrink-0 whitespace-nowrap items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-all active:scale-95 ${
                item.isActive
                  ? "bg-background text-emerald-600 shadow-sm dark:text-emerald-400"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {item.label}
              <span
                className={`rounded-full px-1.5 py-0 text-[10px] font-bold tabular-nums ${
                  item.isActive
                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {item.count}
              </span>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-1.5 sm:gap-2">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70" />
            <Input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(event) => onSearchQueryChange(event.target.value)}
              placeholder="Cari chat..."
              className="h-10 rounded-xl border-border/70 bg-background/80 pl-9 pr-9 text-[14px] shadow-sm transition-all focus:bg-background sm:text-sm"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchQueryChange("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground/50 hover:bg-muted hover:text-foreground active:scale-90"
              >
                <Plus className="h-4 w-4 rotate-45" />
              </button>
            )}
          </label>
          <Button
            type="button"
            variant="default"
            size="sm"
            className="h-10 w-10 gap-0 rounded-xl border border-primary/70 bg-primary px-0 text-primary-foreground shadow-md shadow-primary/20 hover:bg-primary/90 sm:w-auto sm:gap-2 sm:px-3"
            title="Mulai chat baru"
            onClick={() => {
              setCreateError(null);
              setNewPhone("");
              setNewName("");
              setIsNewMessageOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Baru</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-xl border border-border/70"
            onClick={onRefresh}
          >
            <RefreshCw className="h-4 w-4" />
            <span className="sr-only">Muat ulang percakapan</span>
          </Button>
        </div>
      </div>

      <div
        ref={listScrollRef}
        className="inbox-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain border-t border-border/70 bg-[linear-gradient(180deg,hsl(var(--background))/0.88,hsl(var(--muted))/0.2)]"
      >
        {isLoading ? <ConversationListSkeleton /> : null}
        {!isLoading && error ? <ErrorStatePanel title="Gagal Memuat Percakapan" message={error} /> : null}

        {!isLoading && !error && filteredConversations.length === 0 ? (
          <EmptyStatePanel title="Belum Ada Percakapan" message="Tidak ada percakapan untuk filter yang dipilih." />
        ) : null}

        {!isLoading && !error && filteredConversations.length > 0 ? (
          <div className="divide-y divide-border/80">
            {filteredConversations.map((conversation) => (
              <ConversationRow
                key={conversation.id}
                density={density}
                conversation={conversation}
                isSelected={conversation.id === selectedConversationId}
                nowMs={nowMs}
                onSelect={onSelectConversation}
              />
            ))}
          </div>
        ) : null}

        {!isLoading && !error && filteredConversations.length > 0 ? (
          <div className="px-4 py-3 sm:px-5">
            {hasMore ? (
              <div
                ref={loadMoreSentinelRef}
                className="flex min-h-9 items-center justify-center rounded-xl border border-border/70 bg-background/60"
              >
                {isLoadingMore ? (
                  <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Memuat percakapan...
                  </span>
                ) : (
                  <span className="text-[11px] text-muted-foreground">Scroll untuk memuat lebih banyak</span>
                )}
              </div>
            ) : (
              <p className="text-center text-xs text-muted-foreground">Semua percakapan sudah ditampilkan.</p>
            )}
          </div>
        ) : null}
      </div>

      {isNewMessageOpen ? (
        <div className="absolute inset-0 z-20 flex items-end justify-center bg-black/40 px-0 pb-0 backdrop-blur-[2px] sm:items-center sm:px-4 sm:pb-6">
          <div className="w-full max-w-lg animate-in slide-in-from-bottom duration-300 rounded-t-[32px] border-x border-t border-border/70 bg-card p-6 shadow-2xl sm:rounded-b-[32px] sm:border">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <h3 className="text-xl font-bold tracking-tight text-foreground">Chat Baru</h3>
                <p className="text-[13px] leading-relaxed text-muted-foreground/80">Masukkan nomor WhatsApp tujuan untuk mulai percakapan baru.</p>
              </div>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-full bg-muted/50" onClick={() => setIsNewMessageOpen(false)}>
                <Plus className="h-4 w-4 rotate-45" />
              </Button>
            </div>
            <div className="mt-6 flex flex-col gap-3">
              <div className="space-y-1.5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/60 ml-1">Nomor WhatsApp</p>
                <Input
                  value={newPhone}
                  onChange={(event) => setNewPhone(event.target.value)}
                  placeholder="+628..."
                  className="h-12 rounded-2xl border-border/70 bg-muted/20 text-base shadow-sm ring-offset-background focus-visible:ring-emerald-500/20"
                />
              </div>
              <div className="space-y-1.5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/60 ml-1">Nama Customer (Opsional)</p>
                <Input
                  value={newName}
                  onChange={(event) => setNewName(event.target.value)}
                  placeholder="Contoh: Budi Santoso"
                  className="h-12 rounded-2xl border-border/70 bg-muted/20 text-base shadow-sm ring-offset-background focus-visible:ring-emerald-500/20"
                />
              </div>
              {createError ? <p className="mt-2 text-[13px] font-medium text-destructive">{createError}</p> : null}
            </div>
            <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="ghost" className="h-11 rounded-2xl sm:h-10" onClick={() => setIsNewMessageOpen(false)}>
                Batal
              </Button>
              <Button
                type="button"
                className="h-11 rounded-2xl bg-emerald-600 font-bold text-white shadow-lg shadow-emerald-500/25 transition-all hover:bg-emerald-700 active:scale-[0.98] sm:h-10"
                onClick={async () => {
                  if (!newPhone.trim() || isCreating) {
                    return;
                  }

                  setIsCreating(true);
                  setCreateError(null);
                  try {
                    const normalizedPhone = normalizeWhatsAppDestination(newPhone.trim());
                    if (!normalizedPhone) {
                      throw new Error("Nomor WhatsApp tidak valid. Gunakan format +62, 62, atau 08.");
                    }

                    await onCreateConversation({
                      phoneE164: normalizedPhone,
                      customerDisplayName: newName.trim() || undefined
                    });
                    setIsNewMessageOpen(false);
                  } catch (error) {
                    setCreateError(error instanceof Error ? error.message : "Gagal membuat percakapan.");
                  } finally {
                    setIsCreating(false);
                  }
                }}
                disabled={!newPhone.trim() || isCreating}
              >
                {isCreating ? "Membuat..." : "Mulai Chat"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
