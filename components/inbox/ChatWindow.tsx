"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Bot, Globe, Instagram, MessageCircleMore, Send, ShoppingBag } from "lucide-react";

import { ChatHeader } from "@/components/inbox/chat/ChatHeader";
import { ChatMessagesSkeleton } from "@/components/inbox/chat/ChatMessagesSkeleton";
import { formatDayLabel, toDayKey } from "@/components/inbox/chat/chatUtils";
import { MessageBubble } from "@/components/inbox/MessageBubble";
import { MessageInput } from "@/components/inbox/MessageInput";
import type { ConversationItem, MessageItem } from "@/components/inbox/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyStatePanel, ErrorStatePanel } from "@/components/ui/state-panels";

type ChatWindowProps = {
  density: "compact" | "comfy";
  conversation: ConversationItem | null;
  isUpdatingConversationStatus: boolean;
  messages: MessageItem[];
  isLoading: boolean;
  isConversationSelected: boolean;
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
  onRetryOutboundMessage: (messageId: string) => Promise<void>;
  onSelectProofMessage: (messageId: string) => void;
};

export function ChatWindow({
  density,
  conversation,
  isUpdatingConversationStatus,
  messages,
  isLoading,
  isConversationSelected,
  error,
  onSendText,
  onSendAttachment,
  isCrmPanelOpen,
  onToggleCrmPanel,
  onToggleConversationStatus,
  onRetryOutboundMessage,
  onSelectProofMessage
}: ChatWindowProps) {
  const displayName = conversation?.customerDisplayName?.trim() || conversation?.customerPhoneE164 || "No active customer";
  const isOpen = conversation?.status === "OPEN";
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const previousConversationIdRef = useRef<string | null>(null);
  const previousLastMessageIdRef = useRef<string | null>(null);
  const [activeDayLabel, setActiveDayLabel] = useState<string>("Today");
  const [showScrollToLatest, setShowScrollToLatest] = useState(false);
  const [animatedMessageId, setAnimatedMessageId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [isResolveOpen, setIsResolveOpen] = useState(false);
  const [transferMembers, setTransferMembers] = useState<Array<{ userId: string; name: string | null; email: string; role: string }>>([]);
  const [selectedAssignee, setSelectedAssignee] = useState("");
  const [isSubmittingTransfer, setIsSubmittingTransfer] = useState(false);
  const [transferError, setTransferError] = useState<string | null>(null);
  const [resolveMessage, setResolveMessage] = useState("Terima kasih, percakapan ini kami tutup. Jika Anda butuh bantuan lagi, balas pesan ini kapan saja.");
  const [isResolving, setIsResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const lastMessageId = messages.length > 0 ? messages[messages.length - 1]?.id ?? null : null;
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const matchingMessageIds = useMemo(
    () =>
      normalizedSearchQuery
        ? messages.filter((message) => (message.text ?? "").toLowerCase().includes(normalizedSearchQuery)).map((message) => message.id)
        : [],
    [messages, normalizedSearchQuery]
  );
  const matchedCount = matchingMessageIds.length;
  const unreadStartIndex = useMemo(() => {
    const unreadCount = conversation?.unreadCount ?? 0;
    if (unreadCount <= 0 || unreadCount >= messages.length) {
      return null;
    }

    return Math.max(0, messages.length - unreadCount);
  }, [conversation?.unreadCount, messages.length]);

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
  }, [messages.length, conversation?.id]);

  const connectivityItems = [
    { label: "WhatsApp", icon: MessageCircleMore },
    { label: "Messenger", icon: Send },
    { label: "Instagram", icon: Instagram },
    { label: "Telegram", icon: Send },
    { label: "Webchat", icon: Globe }
  ];

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
        setTransferError(payload?.error?.message ?? "Failed to load team members.");
        return;
      }

      const members = payload?.data?.members ?? [];
      setTransferMembers(members);
      setSelectedAssignee(members[0]?.userId ?? "");
    } catch {
      setTransferError("Network error while loading business members.");
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
        setTransferError(payload?.error?.message ?? "Failed to transfer conversation.");
        return;
      }

      setIsTransferOpen(false);
    } catch {
      setTransferError("Network error while transferring conversation.");
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
      setResolveError("Failed to resolve conversation.");
    } finally {
      setIsResolving(false);
    }
  }

  function jumpToMatchedMessage(messageId: string) {
    const element = scrollRef.current?.querySelector<HTMLElement>(`[data-message-id="${messageId}"]`);
    if (!element) {
      return;
    }

    element.scrollIntoView({ behavior: "smooth", block: "center" });
    setAnimatedMessageId(messageId);
    setIsSearchOpen(false);
  }

  return (
    <section data-panel="chat-window" className="relative flex h-full min-h-0 max-h-full flex-col overflow-hidden rounded-[24px] border border-border/70 bg-card/95 shadow-md shadow-black/5 backdrop-blur-sm">
      <ChatHeader
        conversation={conversation}
        displayName={displayName}
        isOpen={isOpen}
        isCrmPanelOpen={isCrmPanelOpen}
        isUpdatingConversationStatus={isUpdatingConversationStatus}
        onOpenSearch={() => setIsSearchOpen(true)}
        onOpenTransfer={() => {
          void handleOpenTransfer();
        }}
        onOpenResolve={() => setIsResolveOpen(true)}
        onToggleCrmPanel={onToggleCrmPanel}
      />

      <div
        ref={scrollRef}
        className={`inbox-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain ${
          isConversationSelected
            ? "bg-[linear-gradient(180deg,hsl(40_30%_90%),hsl(40_24%_88%))] dark:bg-[linear-gradient(180deg,hsl(33_12%_16%),hsl(33_10%_14%))]"
            : "bg-[radial-gradient(circle_at_50%_0%,hsl(var(--accent)/0.24),transparent_40%),linear-gradient(to_bottom,hsl(var(--background)/0.97),hsl(var(--background)/0.78))]"
        } ${
          density === "compact" ? "space-y-2 px-4 py-4 sm:px-5 sm:py-5" : "space-y-3 px-4 py-4 sm:px-6 sm:py-6"
        }`}
      >
        {isConversationSelected && messages.length > 0 ? (
          <div className="pointer-events-none sticky top-2 z-[2] flex justify-center">
            <span className="rounded-full border border-border bg-card/95 px-3 py-1 text-[11px] font-medium text-muted-foreground shadow-sm backdrop-blur-sm">
              {activeDayLabel}
            </span>
          </div>
        ) : null}

        {!isConversationSelected ? (
          <div className="flex min-h-full items-center justify-center px-4 py-10">
            <div className="w-full max-w-[560px] rounded-[32px] border border-border/70 bg-card/95 p-7 text-center shadow-xl shadow-black/5">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[20px] bg-primary text-primary-foreground shadow-lg shadow-primary/30">
                <ShoppingBag className="h-7 w-7" />
              </div>
              <h3 className="mt-6 text-3xl font-semibold tracking-tight text-foreground">
                Centralized <span className="text-primary">Inbox</span>
              </h3>
              <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-muted-foreground">
                Kelola semua pesan bisnis dalam satu dashboard yang rapi. Pilih percakapan di kiri atau mulai chat baru untuk menghubungi customer.
              </p>

              <div className="mt-8 rounded-[24px] border border-border/70 bg-muted/35 p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                  Multi-Channel Connectivity
                </p>
                <div className="mt-4 grid grid-cols-5 gap-3">
                  {connectivityItems.map(({ label, icon: Icon }) => (
                    <div key={label} className="flex flex-col items-center gap-2">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-border/80 bg-background shadow-sm">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <span className="text-[11px] text-muted-foreground">{label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 flex items-center gap-3 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-left">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-background text-primary">
                  <Bot className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Smart AI integration</p>
                  <p className="text-xs text-muted-foreground">Otomatisasi pesan dengan AI chatbot yang terhubung ke bisnis Anda.</p>
                </div>
              </div>

              <div className="mt-5 flex items-center justify-center gap-2">
                <span className="rounded-full border border-border/80 bg-background px-3 py-1 text-xs text-muted-foreground">No contact selected</span>
                {matchedCount > 0 ? (
                  <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs text-primary">{matchedCount} search matches</span>
                ) : null}
              </div>

              <p className="mt-7 text-xs text-muted-foreground">Pilih percakapan di panel kiri untuk mulai membalas pelanggan.</p>
            </div>
          </div>
        ) : null}

        {isConversationSelected && isLoading ? <ChatMessagesSkeleton /> : null}

        {isConversationSelected && !isLoading && error ? <ErrorStatePanel title="Failed to Load Messages" message={error} /> : null}

        {isConversationSelected && !isLoading && !error && messages.length === 0 ? (
          <EmptyStatePanel title="No Messages Yet" message="Start conversation by sending your first message." />
        ) : null}

        {isConversationSelected && !isLoading && !error && messages.length > 0 ? (
          <div key={`${conversation?.id ?? "none"}-${messages.length}`} className="inbox-fade-slide space-y-3">
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
                        New messages
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

      {showScrollToLatest ? (
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
            Latest
          </Button>
        </div>
      ) : null}

      <MessageInput
        density={density}
        disabled={!isConversationSelected}
        onSendText={onSendText}
        onSendAttachment={onSendAttachment}
      />

      {isSearchOpen ? (
        <div className="absolute inset-0 z-20 flex items-start justify-center bg-black/35 px-4 py-10 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-[28px] border border-border/80 bg-card p-5 shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-foreground">Search in conversation</h3>
                <p className="text-sm text-muted-foreground">Cari kata di riwayat WhatsApp customer ini.</p>
              </div>
              <Button type="button" variant="ghost" size="sm" className="h-9 rounded-lg" onClick={() => setIsSearchOpen(false)}>
                Close
              </Button>
            </div>
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Type a keyword..."
              className="mt-4 h-11 rounded-xl"
            />
            <div className="mt-4 space-y-2">
              <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Matches</p>
              {matchedCount === 0 ? <p className="text-sm text-muted-foreground">No messages found.</p> : null}
              {matchingMessageIds.slice(0, 8).map((messageId) => {
                const match = messages.find((message) => message.id === messageId);
                if (!match) {
                  return null;
                }

                return (
                  <button
                    key={messageId}
                    type="button"
                    onClick={() => jumpToMatchedMessage(messageId)}
                    className="w-full rounded-2xl border border-border/80 bg-background/70 px-3 py-3 text-left hover:bg-accent/40"
                  >
                    <p className="line-clamp-2 text-sm text-foreground">{match.text ?? "Media message"}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{new Date(match.createdAt).toLocaleString()}</p>
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
                Close
              </Button>
            </div>
            <div className="mt-4 space-y-2">
              <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Assign to</p>
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
                Cancel
              </Button>
              <Button type="button" onClick={() => void handleTransferConversation()} disabled={!selectedAssignee || isSubmittingTransfer}>
                {isSubmittingTransfer ? "Transferring..." : "Transfer Chat"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {isResolveOpen ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/35 px-4 py-10 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-[28px] border border-border/80 bg-card p-0 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border/80 px-5 py-4">
              <h3 className="text-2xl font-semibold text-foreground">Resolve Conversation</h3>
              <Button type="button" variant="ghost" size="sm" className="h-9 rounded-lg" onClick={() => setIsResolveOpen(false)}>
                Close
              </Button>
            </div>
            <div className="space-y-4 px-5 py-5">
              <p className="text-sm leading-6 text-muted-foreground">
                This will mark the chat as closed and optionally send a closing message to the customer.
              </p>
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Closing message</p>
                <textarea
                  value={resolveMessage}
                  onChange={(event) => setResolveMessage(event.target.value)}
                  className="min-h-36 w-full rounded-2xl border border-border bg-background px-3 py-3 text-sm text-foreground outline-none transition focus:border-primary"
                />
              </div>
              {resolveError ? <p className="text-sm text-destructive">{resolveError}</p> : null}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setIsResolveOpen(false)}>
                  Cancel
                </Button>
                <Button type="button" className="bg-primary text-primary-foreground" onClick={() => void handleResolveConversation()} disabled={isResolving}>
                  {isResolving ? "Resolving..." : "Resolve & Close"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
