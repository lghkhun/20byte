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
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const searchInputRef = useRef<HTMLInputElement | null>(null);

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
      key: "unassigned",
      label: "Belum Assign",
      count: conversations.filter((item) => item.assignedToMemberId === null && item.status === "OPEN").length,
      isActive: filter === "UNASSIGNED" && status === "OPEN" && !showUnreadOnly,
      onClick: () => {
        setShowUnreadOnly(false);
        onFilterChange("UNASSIGNED");
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
      <div className="shrink-0 space-y-4 border-b border-border/70 bg-card/95 px-4 py-4 sm:px-5">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">Inbox</h2>
            <p className="text-xs text-muted-foreground">{filteredConversations.length} percakapan aktif</p>
          </div>
          <IndicatorLegend compact />
        </div>

        <div className="inbox-scroll flex items-center gap-4 overflow-x-auto whitespace-nowrap border-b border-border/70 pb-3">
          {tabItems.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={item.onClick}
              className={item.isActive ? "shrink-0 border-b-2 border-primary px-0 pb-2 text-sm font-semibold text-primary" : "shrink-0 px-0 pb-2 text-sm font-semibold text-muted-foreground"}
            >
              {item.label}
              <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[11px]">{item.count}</span>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(event) => onSearchQueryChange(event.target.value)}
              placeholder="Cari chat..."
              className="h-10 rounded-xl border-border/80 bg-background/80 pl-9"
            />
          </label>
          <Button
            type="button"
            variant="default"
            size="sm"
            className="h-10 gap-2 rounded-xl border border-primary/70 bg-primary px-3 text-primary-foreground shadow-md shadow-primary/20 hover:bg-primary/90"
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

      <div className="inbox-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain border-t border-border/70 bg-[linear-gradient(180deg,hsl(var(--background))/0.88,hsl(var(--muted))/0.2)]">
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
              <Button
                type="button"
                variant="outline"
                className="h-9 w-full rounded-xl"
                disabled={isLoadingMore}
                onClick={onLoadMore}
              >
                {isLoadingMore ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Memuat chat lama...
                  </>
                ) : (
                  "Muat Percakapan Lain"
                )}
              </Button>
            ) : (
              <p className="text-center text-xs text-muted-foreground">Semua percakapan sudah ditampilkan.</p>
            )}
          </div>
        ) : null}
      </div>

      {isNewMessageOpen ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/35 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[28px] border border-border/80 bg-card p-5 shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-foreground">Chat Baru</h3>
                <p className="text-sm text-muted-foreground">Masukkan nomor WhatsApp tujuan untuk mulai percakapan baru.</p>
              </div>
              <Button type="button" variant="ghost" size="sm" className="h-9 rounded-lg" onClick={() => setIsNewMessageOpen(false)}>
                Tutup
              </Button>
            </div>
            <div className="mt-4 space-y-3">
              <Input
                value={newPhone}
                onChange={(event) => setNewPhone(event.target.value)}
                placeholder="Nomor WhatsApp tujuan (+628...)"
                className="h-11 rounded-xl"
              />
              <Input
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                placeholder="Nama customer (opsional)"
                className="h-11 rounded-xl"
              />
              {createError ? <p className="text-sm text-destructive">{createError}</p> : null}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setIsNewMessageOpen(false)}>
                Batal
              </Button>
              <Button
                type="button"
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
