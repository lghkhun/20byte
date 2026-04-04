"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, MessageCircleMore, ShoppingBag } from "lucide-react";

import { ChatHeader } from "@/components/inbox/chat/ChatHeader";
import { ChatMessagesSkeleton } from "@/components/inbox/chat/ChatMessagesSkeleton";
import { formatDayLabel, toDayKey } from "@/components/inbox/chat/chatUtils";
import { MessageBubble } from "@/components/inbox/MessageBubble";
import { MessageInput } from "@/components/inbox/MessageInput";
import type { ConversationItem, MessageItem } from "@/components/inbox/types";
import type { SearchMessagesResponse } from "@/components/inbox/workspace/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyStatePanel, ErrorStatePanel } from "@/components/ui/state-panels";

type ChatWindowProps = {
  density: "compact" | "comfy";
  conversation: ConversationItem | null;
  isUpdatingConversationStatus: boolean;
  messages: MessageItem[];
  isLoading: boolean;
  isLoadingOlderMessages: boolean;
  hasMoreMessages: boolean;
  isConversationSelected: boolean;
  isCustomerTyping: boolean;
  error: string | null;
  onSendText: (text: string) => Promise<void>;
  onSendAttachment: (attachment: {
    file: File;
    fileName: string;
    mimeType: string;
    size: number;
  }) => Promise<void>;
  isCrmPanelOpen: boolean;
  onToggleCrmPanel: () => void;
  onToggleConversationStatus: () => Promise<void>;
  onDeleteConversation: () => Promise<void>;
  onRetryOutboundMessage: (messageId: string) => Promise<void>;
  onLoadOlderMessages: () => Promise<void>;
  onSelectProofMessage: (messageId: string) => void;
  onUnselectConversation: () => void;
};

export function ChatWindow({
  density,
  conversation,
  isUpdatingConversationStatus,
  messages,
  isLoading,
  isLoadingOlderMessages,
  hasMoreMessages,
  isConversationSelected,
  isCustomerTyping,
  error,
  onSendText,
  onSendAttachment,
  isCrmPanelOpen,
  onToggleCrmPanel,
  onToggleConversationStatus,
  onDeleteConversation,
  onRetryOutboundMessage,
  onLoadOlderMessages,
  onSelectProofMessage,
  onUnselectConversation
}: ChatWindowProps) {
  const displayName = conversation?.customerDisplayName?.trim() || conversation?.customerPhoneE164 || "Belum ada chat dipilih";
  const isOpen = conversation?.status === "OPEN";
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const previousConversationIdRef = useRef<string | null>(null);
  const previousLastMessageIdRef = useRef<string | null>(null);
  const pendingOlderScrollRestoreRef = useRef<{ previousHeight: number; previousTop: number } | null>(null);
  const loadOlderLockRef = useRef(false);
  const [activeDayLabel, setActiveDayLabel] = useState<string>("Hari ini");
  const [showScrollToLatest, setShowScrollToLatest] = useState(false);
  const [animatedMessageId, setAnimatedMessageId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSearchingMessages, setIsSearchingMessages] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchMatches, setSearchMatches] = useState<Array<{ id: string; text: string; createdAt: string }>>([]);
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [isResolveOpen, setIsResolveOpen] = useState(false);
  const [transferMembers, setTransferMembers] = useState<Array<{ userId: string; name: string | null; email: string; role: string }>>([]);
  const [selectedAssignee, setSelectedAssignee] = useState("");
  const [isSubmittingTransfer, setIsSubmittingTransfer] = useState(false);
  const [transferError, setTransferError] = useState<string | null>(null);
  const [resolveMessage, setResolveMessage] = useState("Terima kasih, percakapan ini kami tutup. Jika Anda butuh bantuan lagi, balas pesan ini kapan saja.");
  const [isResolving, setIsResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [draftByConversation, setDraftByConversation] = useState<Record<string, string>>({});
  const lastMessageId = messages.length > 0 ? messages[messages.length - 1]?.id ?? null : null;
  const trimmedSearchQuery = searchQuery.trim();
  const normalizedSearchQuery = trimmedSearchQuery.toLowerCase();
  const activeDraft = conversation ? draftByConversation[conversation.id] ?? "" : "";
  const matchedCount = searchMatches.length;
  const unreadStartIndex = useMemo(() => {
    const unreadCount = conversation?.unreadCount ?? 0;
    if (unreadCount <= 0 || unreadCount >= messages.length) {
      return null;
    }

    return Math.max(0, messages.length - unreadCount);
  }, [conversation?.unreadCount, messages.length]);

  useEffect(() => {
    setSearchQuery("");
    setSearchMatches([]);
    setSearchError(null);
    setIsSearchingMessages(false);
  }, [conversation?.id]);

  useEffect(() => {
    if (!isConversationSelected || !scrollRef.current) {
      return;
    }

    const currentConversationId = conversation?.id ?? null;
    if (previousConversationIdRef.current !== currentConversationId) {
      previousConversationIdRef.current = currentConversationId;
      previousLastMessageIdRef.current = lastMessageId;
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "auto" });
      return;
    }

    if (!lastMessageId || previousLastMessageIdRef.current === lastMessageId) {
      return;
    }

    previousLastMessageIdRef.current = lastMessageId;
    scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    setAnimatedMessageId(lastMessageId);

    const timer = window.setTimeout(() => {
      setAnimatedMessageId((current) => (current === lastMessageId ? null : current));
    }, 320);

    return () => window.clearTimeout(timer);
  }, [conversation?.id, isConversationSelected, lastMessageId, messages.length]);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) {
      return;
    }

    const updateScrollState = () => {
      if (
        isConversationSelected &&
        hasMoreMessages &&
        !isLoadingOlderMessages &&
        !loadOlderLockRef.current &&
        element.scrollTop < 80
      ) {
        loadOlderLockRef.current = true;
        pendingOlderScrollRestoreRef.current = {
          previousHeight: element.scrollHeight,
          previousTop: element.scrollTop
        };
        void onLoadOlderMessages();
      }

      const nearBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 80;
      setShowScrollToLatest(!nearBottom);

      const separators = Array.from(element.querySelectorAll<HTMLElement>("[data-day-separator='true']"));
      if (separators.length === 0) {
        return;
      }

      const containerTop = element.getBoundingClientRect().top;
      const firstVisible = separators.find((separator) => separator.getBoundingClientRect().bottom >= containerTop + 28);
      const label = firstVisible?.dataset.dayLabel ?? separators[separators.length - 1]?.dataset.dayLabel;
      if (label) {
        setActiveDayLabel(label);
      }
    };

    updateScrollState();
    element.addEventListener("scroll", updateScrollState, { passive: true });
    return () => element.removeEventListener("scroll", updateScrollState);
  }, [conversation?.id, hasMoreMessages, isConversationSelected, isLoadingOlderMessages, messages.length, onLoadOlderMessages]);

  useEffect(() => {
    if (isLoadingOlderMessages) {
      return;
    }
    loadOlderLockRef.current = false;
  }, [isLoadingOlderMessages]);

  useEffect(() => {
    const element = scrollRef.current;
    const pending = pendingOlderScrollRestoreRef.current;
    if (!element || !pending || isLoadingOlderMessages) {
      return;
    }

    const nextTop = element.scrollHeight - pending.previousHeight + pending.previousTop;
    element.scrollTop = Math.max(0, nextTop);
    pendingOlderScrollRestoreRef.current = null;
  }, [isLoadingOlderMessages, messages.length]);

  useEffect(() => {
    if (!isSearchOpen || !conversation) {
      setSearchMatches([]);
      setSearchError(null);
      setIsSearchingMessages(false);
      return;
    }

    if (!normalizedSearchQuery) {
      setSearchMatches([]);
      setSearchError(null);
      setIsSearchingMessages(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setIsSearchingMessages(true);
      setSearchError(null);
      try {
        const params = new URLSearchParams({
          conversationId: conversation.id,
          query: trimmedSearchQuery,
          limit: "20",
          orgId: conversation.orgId
        });
        const response = await fetch(`/api/messages/search?${params.toString()}`, {
          signal: controller.signal
        });
        const payload = (await response.json().catch(() => null)) as SearchMessagesResponse | null;
        if (!response.ok) {
          setSearchError(payload?.error?.message ?? "Gagal mencari pesan.");
          setSearchMatches([]);
          return;
        }
        setSearchMatches(payload?.data?.messages ?? []);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        setSearchError("Terjadi masalah jaringan saat mencari pesan.");
        setSearchMatches([]);
      } finally {
        setIsSearchingMessages(false);
      }
    }, 220);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [conversation, isSearchOpen, normalizedSearchQuery, trimmedSearchQuery]);

  async function handleOpenTransfer() {
    if (!conversation) {
      return;
    }

    setTransferError(null);
    setIsTransferOpen(true);
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
        setTransferError(payload?.error?.message ?? "Gagal memuat daftar anggota tim.");
        return;
      }

      const members = payload?.data?.members ?? [];
      setTransferMembers(members);
      setSelectedAssignee(members[0]?.userId ?? "");
    } catch {
      setTransferError("Terjadi masalah jaringan saat memuat anggota bisnis.");
    }
  }

  async function handleTransferConversation() {
    if (!conversation || !selectedAssignee || isSubmittingTransfer) {
      return;
    }

    setIsSubmittingTransfer(true);
    setTransferError(null);
    try {
      const response = await fetch("/api/conversations/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: conversation.id,
          assigneeUserId: selectedAssignee
        })
      });

      const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
      if (!response.ok) {
        setTransferError(payload?.error?.message ?? "Gagal memindahkan percakapan.");
        return;
      }

      setIsTransferOpen(false);
    } catch {
      setTransferError("Terjadi masalah jaringan saat memindahkan percakapan.");
    } finally {
      setIsSubmittingTransfer(false);
    }
  }

  async function handleResolveConversation() {
    if (!conversation || isResolving) {
      return;
    }

    setIsResolving(true);
    setResolveError(null);
    try {
      const closingMessage = resolveMessage.trim();
      if (closingMessage) {
        await onSendText(closingMessage);
      }

      await onToggleConversationStatus();
      setIsResolveOpen(false);
    } catch {
      setResolveError("Gagal menutup percakapan.");
    } finally {
      setIsResolving(false);
    }
  }

  function setDraftValue(nextValue: string) {
    if (!conversation) {
      return;
    }
    setDraftByConversation((current) => ({
      ...current,
      [conversation.id]: nextValue
    }));
  }

  async function handleSendText(text: string) {
    await onSendText(text);
    if (!conversation) {
      return;
    }
    setDraftByConversation((current) => ({
      ...current,
      [conversation.id]: ""
    }));
  }

  async function jumpToMatchedMessage(messageId: string) {
    const element = scrollRef.current?.querySelector<HTMLElement>(`[data-message-id="${messageId}"]`);
    if (!element) {
      if (hasMoreMessages) {
        await onLoadOlderMessages();
      }
      return;
    }

    element.scrollIntoView({ behavior: "smooth", block: "center" });
    setAnimatedMessageId(messageId);
    setIsSearchOpen(false);
  }

  return (
    <section data-panel="chat-window" className="inbox-scroll relative flex h-full min-h-0 max-h-full flex-col overflow-y-auto overscroll-contain rounded-[24px] border border-border/70 bg-card/95 shadow-md shadow-black/5 backdrop-blur-sm">
      {isConversationSelected ? (
        <ChatHeader
          conversation={conversation}
          displayName={displayName}
          isCustomerTyping={isCustomerTyping}
          isOpen={isOpen}
          isCrmPanelOpen={isCrmPanelOpen}
          isUpdatingConversationStatus={isUpdatingConversationStatus}
          onOpenSearch={() => setIsSearchOpen(true)}
          onOpenTransfer={() => {
            void handleOpenTransfer();
          }}
          onOpenResolve={() => setIsResolveOpen(true)}
          onDeleteConversation={() => {
            if (!conversation) {
              return;
            }
            const confirmed = window.confirm("Hapus chat ini? Semua pesan pada chat ini akan dihapus.");
            if (!confirmed) {
              return;
            }
            void onDeleteConversation();
          }}
          onUnselectConversation={onUnselectConversation}
          onToggleCrmPanel={onToggleCrmPanel}
        />
      ) : null}

      {!isConversationSelected ? (
        <div className="relative flex flex-1 flex-col items-center justify-center bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.05),transparent_80%),linear-gradient(to_bottom,hsl(var(--background)/0.96),hsl(var(--muted)/0.4))] p-8">
          <div className="flex w-full max-w-md flex-col items-center text-center">
            <div className="relative mb-10 flex h-36 w-36 items-center justify-center rounded-[2rem] bg-background shadow-sm border border-border/80">
              <MessageCircleMore className="relative z-10 h-16 w-16 text-primary" />
              <div className="absolute inset-0 rounded-[2rem] border border-primary/20 bg-gradient-to-tr from-primary/10 to-transparent"></div>
            </div>
            <h3 className="text-[32px] font-light text-foreground/90 tracking-tight">
              20byte <span className="font-semibold text-primary">WhatsApp CRM</span>
            </h3>
            <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground/80">
              Pusat kendali interaksi pelanggan Anda. Kembangkan, atur, dan kelola kelancaran bisnis Anda di satu tempat.
            </p>
          </div>
          
          <div className="absolute bottom-8 flex w-full justify-center">
             <p className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground/60">
              <svg width="10" height="12" viewBox="0 0 10 12" fill="none" xmlns="http://www.w3.org/2000/svg" className="opacity-70"><path fillRule="evenodd" clipRule="evenodd" d="M1.99616 5.17647V3.52941C1.99616 1.86877 3.34241 0.522522 5.00305 0.522522C6.66369 0.522522 8.00994 1.86877 8.00994 3.52941V5.17647H8.50305C9.05534 5.17647 9.50305 5.62419 9.50305 6.17647V10.1765C9.50305 10.7288 9.05534 11.1765 8.50305 11.1765H1.50305C0.950767 11.1765 0.503052 10.7288 0.503052 10.1765V6.17647C0.503052 5.62419 0.950767 5.17647 1.50305 5.17647H1.99616ZM3.17263 5.17647V3.52941C3.17263 2.51866 3.99221 1.69908 5.00296 1.69908C6.01371 1.69908 6.83329 2.51866 6.83329 3.52941V5.17647H3.17263ZM5.00296 7.64706C4.58875 7.64706 4.25296 7.98285 4.25296 8.39706C4.25296 8.81127 4.58875 9.14706 5.00296 9.14706C5.41717 9.14706 5.75296 8.81127 5.75296 8.39706C5.75296 7.98285 5.41717 7.64706 5.00296 7.64706Z" fill="currentColor"/></svg>
              Sistem Anda terintegrasi penuh secara real-time
            </p>
          </div>
        </div>
      ) : (
        <div
          ref={scrollRef}
          className={`inbox-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.05),transparent_80%),linear-gradient(to_bottom,hsl(var(--background)/0.96),hsl(var(--muted)/0.4))] ${
            density === "compact" ? "space-y-2 px-4 py-4 sm:px-5 sm:py-5" : "space-y-3 px-4 py-4 sm:px-6 sm:py-6"
          }`}
        >
          {messages.length > 0 ? (
            <div className="pointer-events-none sticky top-2 z-[2] flex justify-center">
              <span className="rounded-full border border-border bg-card/95 px-3 py-1 text-[11px] font-medium text-muted-foreground shadow-sm backdrop-blur-sm">
                {activeDayLabel}
              </span>
            </div>
          ) : null}

        {isConversationSelected && isLoading ? <ChatMessagesSkeleton /> : null}

        {isConversationSelected && !isLoading && error ? <ErrorStatePanel title="Gagal Memuat Pesan" message={error} /> : null}

        {isConversationSelected && !isLoading && !error && messages.length === 0 ? (
          <EmptyStatePanel title="Belum Ada Pesan" message="Mulai percakapan dengan mengirim pesan pertama." />
        ) : null}

        {isConversationSelected && !isLoading && !error && messages.length > 0 ? (
          <div key={`${conversation?.id ?? "none"}-${messages.length}`} className="inbox-fade-slide space-y-3">
            {hasMoreMessages ? (
              <div className="flex justify-center">
                <span className="rounded-full border border-border bg-card/90 px-3 py-1 text-[11px] text-muted-foreground">
                  {isLoadingOlderMessages ? "Memuat riwayat lama..." : "Gulir ke atas untuk memuat pesan lama"}
                </span>
              </div>
            ) : null}
            {messages.map((message, index) => {
              const currentDayKey = toDayKey(message.createdAt);
              const previousDayKey = index > 0 ? toDayKey(messages[index - 1]?.createdAt ?? "") : null;
              const showSeparator = index === 0 || currentDayKey !== previousDayKey;

              return (
                <div key={message.id} data-message-id={message.id} className="space-y-3">
                  {showSeparator ? (
                    <div className="sticky top-2 z-[1] flex justify-center">
                      <span
                        data-day-separator="true"
                        data-day-label={formatDayLabel(currentDayKey)}
                        className="rounded-full border border-border bg-card/95 px-3 py-1 text-[11px] font-medium text-muted-foreground shadow-sm backdrop-blur-sm"
                      >
                        {formatDayLabel(currentDayKey)}
                      </span>
                    </div>
                  ) : null}
                  {unreadStartIndex !== null && index === unreadStartIndex ? (
                    <div className="flex items-center gap-2">
                      <div className="h-px flex-1 bg-border" />
                      <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium text-primary">
                        Pesan baru
                      </span>
                      <div className="h-px flex-1 bg-border" />
                    </div>
                  ) : null}
                  <MessageBubble
                    density={density}
                    isEmphasized={message.id === animatedMessageId}
                    message={message}
                    onSelectProofMessage={onSelectProofMessage}
                    onRetryOutboundMessage={(messageId) => {
                      void onRetryOutboundMessage(messageId);
                    }}
                  />
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
      )}

      {showScrollToLatest && isConversationSelected ? (
        <div className="pointer-events-none absolute bottom-24 right-4 z-[3] sm:right-7">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="pointer-events-auto rounded-full shadow-md"
            onClick={() => {
              if (!scrollRef.current) {
                return;
              }

              scrollRef.current.scrollTo({
                top: scrollRef.current.scrollHeight,
                behavior: "smooth"
              });
            }}
          >
            Terbaru
          </Button>
        </div>
      ) : null}

      {isConversationSelected ? (
        <MessageInput
          density={density}
          disabled={!isConversationSelected}
          textValue={activeDraft}
          onTextValueChange={setDraftValue}
          onSendText={handleSendText}
          onSendAttachment={onSendAttachment}
        />
      ) : null}

      {isSearchOpen ? (
        <div className="absolute inset-0 z-20 flex items-start justify-center bg-black/35 px-4 py-10 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-[28px] border border-border/80 bg-card p-5 shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-foreground">Cari Dalam Percakapan</h3>
                <p className="text-sm text-muted-foreground">Cari kata di riwayat WhatsApp customer ini.</p>
              </div>
              <Button type="button" variant="ghost" size="sm" className="h-9 rounded-lg" onClick={() => setIsSearchOpen(false)}>
                Tutup
              </Button>
            </div>
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Ketik kata kunci..."
              className="mt-4 h-11 rounded-xl"
            />
            <div className="mt-4 space-y-2">
              <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Hasil</p>
              {isSearchingMessages ? (
                <p className="inline-flex items-center text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Mencari pesan...
                </p>
              ) : null}
              {!isSearchingMessages && searchError ? <p className="text-sm text-destructive">{searchError}</p> : null}
              {!isSearchingMessages && !searchError && normalizedSearchQuery && matchedCount === 0 ? (
                <p className="text-sm text-muted-foreground">Tidak ada pesan yang cocok.</p>
              ) : null}
              {!isSearchingMessages && !searchError && !normalizedSearchQuery ? (
                <p className="text-sm text-muted-foreground">Ketik kata kunci untuk mulai mencari.</p>
              ) : null}
              {searchMatches.slice(0, 10).map((match) => {
                return (
                  <button
                    key={match.id}
                    type="button"
                    onClick={() => {
                      void jumpToMatchedMessage(match.id);
                    }}
                    className="w-full rounded-2xl border border-border/80 bg-background/70 px-3 py-3 text-left hover:bg-accent/40"
                  >
                    <p className="line-clamp-2 text-sm text-foreground">{match.text ?? "Pesan media"}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{new Date(match.createdAt).toLocaleString("id-ID")}</p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      {isTransferOpen ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/35 px-4 py-10 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[28px] border border-border/80 bg-card p-5 shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-foreground">Transfer Conversation</h3>
                <p className="text-sm text-muted-foreground">Pindahkan chat ke anggota bisnis atau CS lain.</p>
              </div>
              <Button type="button" variant="ghost" size="sm" className="h-9 rounded-lg" onClick={() => setIsTransferOpen(false)}>
                Tutup
              </Button>
            </div>
            <div className="mt-4 space-y-2">
              <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Pilih Tujuan</p>
              <select
                value={selectedAssignee}
                onChange={(event) => setSelectedAssignee(event.target.value)}
                className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground"
              >
                {transferMembers.map((member) => (
                  <option key={member.userId} value={member.userId}>
                    {(member.name?.trim() || member.email)} • {member.role}
                  </option>
                ))}
              </select>
              {transferError ? <p className="text-sm text-destructive">{transferError}</p> : null}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setIsTransferOpen(false)}>
                Batal
              </Button>
              <Button type="button" onClick={() => void handleTransferConversation()} disabled={!selectedAssignee || isSubmittingTransfer}>
                {isSubmittingTransfer ? "Memindahkan..." : "Pindahkan Chat"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {isResolveOpen ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/35 px-4 py-10 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-[28px] border border-border/80 bg-card p-0 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border/80 px-5 py-4">
              <h3 className="text-2xl font-semibold text-foreground">Tutup Percakapan</h3>
              <Button type="button" variant="ghost" size="sm" className="h-9 rounded-lg" onClick={() => setIsResolveOpen(false)}>
                Tutup
              </Button>
            </div>
            <div className="space-y-4 px-5 py-5">
              <p className="text-sm leading-6 text-muted-foreground">
                Aksi ini akan menandai chat sebagai selesai dan opsional mengirim pesan penutup ke customer.
              </p>
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Pesan Penutup</p>
                <textarea
                  value={resolveMessage}
                  onChange={(event) => setResolveMessage(event.target.value)}
                  className="min-h-36 w-full rounded-2xl border border-border bg-background px-3 py-3 text-sm text-foreground outline-none transition focus:border-primary"
                />
              </div>
              {resolveError ? <p className="text-sm text-destructive">{resolveError}</p> : null}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setIsResolveOpen(false)}>
                  Batal
                </Button>
                <Button type="button" className="bg-primary text-primary-foreground" onClick={() => void handleResolveConversation()} disabled={isResolving}>
                  {isResolving ? "Menutup..." : "Tutup Percakapan"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
