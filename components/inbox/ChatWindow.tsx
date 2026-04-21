"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarClock, Check, Loader2, MessageCircleMore, Search, X } from "lucide-react";

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
  onSendText: (
    text: string,
    options?: { replyToMessageId?: string | null; replyPreviewText?: string | null; scheduleAt?: string | null }
  ) => Promise<{ scheduledDueAt?: string | null } | void>;
  onSendAttachment: (attachment: {
    file: File;
    fileName: string;
    mimeType: string;
    size: number;
  }, options?: { replyToMessageId?: string | null; text?: string | null }) => Promise<void>;
  isCrmPanelOpen: boolean;
  onToggleCrmPanel: () => void;
  onToggleConversationStatus: () => Promise<void>;
  onDeleteConversation: () => Promise<void>;
  onRetryOutboundMessage: (messageId: string) => Promise<void>;
  onLoadOlderMessages: () => Promise<void>;
  onSelectProofMessage: (messageId: string) => void;
  onReplyPrivatelyFromMessage: (message: MessageItem) => Promise<void>;
  onForwardMessageToTarget: (input: {
    message: MessageItem;
    targetPhoneE164: string;
    targetDisplayName?: string;
    suppressToast?: boolean;
  }) => Promise<void>;
  onCreateNoteFromMessage: (message: MessageItem) => Promise<void>;
  onUnselectConversation: () => void;
};

type ListConversationsPayload = {
  data?: {
    conversations?: ConversationItem[];
  };
  error?: {
    message?: string;
  };
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
  onReplyPrivatelyFromMessage,
  onForwardMessageToTarget,
  onCreateNoteFromMessage,
  onUnselectConversation
}: ChatWindowProps) {
  void onDeleteConversation;
  void onUnselectConversation;
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
  const [isForwardOpen, setIsForwardOpen] = useState(false);
  const [forwardMessage, setForwardMessage] = useState<MessageItem | null>(null);
  const [forwardSearch, setForwardSearch] = useState("");
  const [forwardTargetPhone, setForwardTargetPhone] = useState("");
  const [forwardTargetName, setForwardTargetName] = useState("");
  const [forwardCandidates, setForwardCandidates] = useState<ConversationItem[]>([]);
  const [selectedForwardConversationIds, setSelectedForwardConversationIds] = useState<string[]>([]);
  const [isLoadingForwardTargets, setIsLoadingForwardTargets] = useState(false);
  const [forwardError, setForwardError] = useState<string | null>(null);
  const [isForwarding, setIsForwarding] = useState(false);
  const [transferMembers, setTransferMembers] = useState<Array<{ userId: string; name: string | null; email: string; role: string }>>([]);
  const [selectedAssignee, setSelectedAssignee] = useState("");
  const [isSubmittingTransfer, setIsSubmittingTransfer] = useState(false);
  const [transferError, setTransferError] = useState<string | null>(null);
  const [resolveMessage, setResolveMessage] = useState("Terima kasih, percakapan ini kami tutup. Jika Anda butuh bantuan lagi, balas pesan ini kapan saja.");
  const [isResolving, setIsResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [draftByConversation, setDraftByConversation] = useState<Record<string, string>>({});
  const [replyTarget, setReplyTarget] = useState<{ id: string; text: string; author?: string | null } | null>(null);
  const [scheduledBannerText, setScheduledBannerText] = useState<string | null>(null);
  const lastMessageId = messages.length > 0 ? messages[messages.length - 1]?.id ?? null : null;
  const trimmedSearchQuery = searchQuery.trim();
  const normalizedSearchQuery = trimmedSearchQuery.toLowerCase();
  const activeDraft = conversation ? draftByConversation[conversation.id] ?? "" : "";
  const isGroupChat = Boolean(conversation?.waChatJid?.endsWith("@g.us"));
  const fallbackGroupParticipants = useMemo(() => {
    if (!isGroupChat) {
      return [] as string[];
    }

    const unique = new Set<string>();
    for (const message of messages) {
      const label = message.senderDisplayName?.trim() || message.senderPhoneE164?.trim() || "";
      if (label) {
        unique.add(label);
      }
    }
    return [...unique].slice(0, 120);
  }, [isGroupChat, messages]);
  const headerConversation = useMemo(() => {
    if (!conversation) {
      return null;
    }
    if (!isGroupChat) {
      return conversation;
    }
    return {
      ...conversation,
      groupParticipants:
        conversation.groupParticipants.length > 0 ? conversation.groupParticipants : fallbackGroupParticipants
    };
  }, [conversation, fallbackGroupParticipants, isGroupChat]);
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
    setReplyTarget(null);
    setIsForwardOpen(false);
    setForwardMessage(null);
    setForwardSearch("");
    setForwardTargetPhone("");
    setForwardTargetName("");
    setForwardCandidates([]);
    setSelectedForwardConversationIds([]);
    setIsLoadingForwardTargets(false);
    setForwardError(null);
    setIsForwarding(false);
  }, [conversation?.id]);

  useEffect(() => {
    setScheduledBannerText(null);
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

  async function handleSubmitForwardMessage() {
    if (!forwardMessage || isForwarding) {
      return;
    }

    const selectedTargets = forwardCandidates
      .filter((item) => selectedForwardConversationIds.includes(item.id))
      .map((item) => ({
        phone: item.customerPhoneE164.trim(),
        name: item.customerDisplayName?.trim() || item.customerPhoneE164.trim()
      }))
      .filter((item) => Boolean(item.phone));
    const customPhone = forwardTargetPhone.trim();
    const customTarget =
      customPhone.length > 0
        ? [
            {
              phone: customPhone,
              name: forwardTargetName.trim() || undefined
            }
          ]
        : [];
    const dedupedTargets = [...selectedTargets, ...customTarget].filter(
      (target, index, list) => list.findIndex((row) => row.phone === target.phone) === index
    );

    if (dedupedTargets.length === 0) {
      setForwardError("Pilih tujuan chat atau isi nomor tujuan.");
      return;
    }

    setIsForwarding(true);
    setForwardError(null);
    try {
      for (let i = 0; i < dedupedTargets.length; i += 1) {
        const target = dedupedTargets[i]!;
        await onForwardMessageToTarget({
          message: forwardMessage,
          targetPhoneE164: target.phone,
          targetDisplayName: target.name,
          suppressToast: i < dedupedTargets.length - 1
        });
      }
      setIsForwardOpen(false);
      setForwardMessage(null);
      setForwardSearch("");
      setForwardTargetPhone("");
      setForwardTargetName("");
      setForwardCandidates([]);
      setSelectedForwardConversationIds([]);
    } catch {
      setForwardError("Gagal meneruskan pesan.");
    } finally {
      setIsForwarding(false);
    }
  }

  useEffect(() => {
    if (!isForwardOpen || !conversation) {
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setIsLoadingForwardTargets(true);
      try {
        const params = new URLSearchParams({
          filter: "ALL",
          status: "OPEN",
          page: "1",
          limit: "80",
          orgId: conversation.orgId
        });
        const trimmedQuery = forwardSearch.trim();
        if (trimmedQuery) {
          params.set("query", trimmedQuery);
        }
        const response = await fetch(`/api/conversations?${params.toString()}`, {
          signal: controller.signal
        });
        const payload = (await response.json().catch(() => null)) as ListConversationsPayload | null;
        if (!response.ok) {
          setForwardError(payload?.error?.message ?? "Gagal memuat daftar percakapan.");
          setForwardCandidates([]);
          return;
        }
        const rows = payload?.data?.conversations ?? [];
        setForwardCandidates(rows.filter((row) => row.id !== conversation.id));
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        setForwardError("Terjadi masalah jaringan saat memuat tujuan forward.");
        setForwardCandidates([]);
      } finally {
        setIsLoadingForwardTargets(false);
      }
    }, 180);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [conversation, forwardSearch, isForwardOpen]);

  function setDraftValue(nextValue: string) {
    if (!conversation) {
      return;
    }
    setDraftByConversation((current) => ({
      ...current,
      [conversation.id]: nextValue
    }));
  }

  async function handleSendText(
    text: string,
    options?: { replyToMessageId?: string | null; replyPreviewText?: string | null; scheduleAt?: string | null }
  ) {
    const result = await onSendText(text, options);
    const dueAt = result?.scheduledDueAt;
    if (options?.scheduleAt && dueAt) {
      setScheduledBannerText(
        `Pesan terjadwal: ${new Date(dueAt).toLocaleString("id-ID", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit"
        })}`
      );
    }
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
          conversation={headerConversation}
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
          onToggleCrmPanel={onToggleCrmPanel}
        />
      ) : null}

      {!isConversationSelected ? (
        <div className="relative flex flex-1 flex-col items-center justify-center bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.05),transparent_80%),linear-gradient(to_bottom,hsl(var(--background)/0.96),hsl(var(--muted)/0.4))] p-8">
          <div className="flex w-full max-w-lg flex-col items-center text-center">
            <div className="relative mb-10 mt-4 flex h-36 w-[260px] items-center justify-center transition-transform duration-500 hover:scale-[1.02] lg:mb-12 lg:h-40 lg:w-[280px] 2xl:mb-14 2xl:mt-6 2xl:h-48 2xl:w-[320px]">
              {/* Dashboard Window Glass */}
              <div className="absolute inset-0 overflow-hidden rounded-2xl border border-border/80 bg-background/60 shadow-xl backdrop-blur-md dark:bg-card/40 dark:shadow-primary/5 2xl:rounded-3xl 2xl:shadow-2xl">
                {/* Top Header */}
                <div className="flex h-10 items-center gap-2 border-b border-border/50 bg-muted/30 px-4">
                  <div className="h-2.5 w-2.5 rounded-full bg-rose-400/80"></div>
                  <div className="h-2.5 w-2.5 rounded-full bg-amber-400/80"></div>
                  <div className="h-2.5 w-2.5 rounded-full bg-emerald-400/80"></div>
                  <div className="ml-4 h-2 w-16 rounded-full bg-muted-foreground/20"></div>
                  <div className="ml-auto flex gap-1">
                    <div className="h-4 w-4 rounded bg-muted-foreground/10"></div>
                    <div className="h-4 w-4 rounded bg-muted-foreground/10"></div>
                  </div>
                </div>
                {/* Dashboard Body Layout */}
                <div className="flex h-full gap-4 p-4">
                  {/* Sidebar */}
                  <div className="flex w-8 flex-col items-center gap-3">
                     <div className="h-5 w-5 rounded bg-primary/20"></div>
                     <div className="h-5 w-5 rounded bg-muted-foreground/10"></div>
                     <div className="h-5 w-5 rounded bg-muted-foreground/10"></div>
                     <div className="h-5 w-5 rounded bg-muted-foreground/10"></div>
                  </div>
                  {/* Main Data Content */}
                  <div className="flex flex-1 flex-col gap-3 border-l border-border/40 pl-4 pr-2 pt-1">
                    <div className="flex gap-2">
                       <div className="h-10 flex-1 rounded-lg border border-emerald-500/20 bg-emerald-500/10"></div>
                       <div className="h-10 flex-1 rounded-lg border border-blue-500/20 bg-blue-500/10"></div>
                       <div className="h-10 flex-1 rounded-lg border border-amber-500/20 bg-amber-500/10"></div>
                    </div>
                    {/* Graph Area */}
                    <div className="flex flex-1 items-end gap-2 rounded-xl border border-border/30 bg-muted/20 p-2">
                       <div className="h-[30%] w-full rounded-sm bg-muted-foreground/20"></div>
                       <div className="h-[60%] w-full rounded-sm bg-primary/40"></div>
                       <div className="h-[45%] w-full rounded-sm bg-muted-foreground/20"></div>
                       <div className="h-[80%] w-full rounded-sm bg-primary/60"></div>
                       <div className="h-[55%] w-full rounded-sm bg-muted-foreground/20"></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating WhatsApp Bubble */}
              <div className="absolute -bottom-6 -right-3 z-10 drop-shadow-xl lg:-right-6 2xl:-bottom-8 2xl:-right-8 2xl:drop-shadow-2xl">
                <div className="relative flex items-center gap-2.5 rounded-[20px] rounded-bl-sm border border-emerald-400/40 bg-gradient-to-br from-emerald-400 to-emerald-600 px-4 py-2.5 shadow-lg shadow-emerald-500/20 dark:shadow-emerald-500/10 2xl:gap-3 2xl:rounded-[24px] 2xl:px-5 2xl:py-3.5 2xl:shadow-xl">
                  <div className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full border-2 border-background bg-rose-500 text-[9px] font-bold text-white shadow-sm 2xl:h-5 2xl:w-5 2xl:text-[10px]">
                    3
                  </div>
                  <MessageCircleMore className="h-5 w-5 text-white drop-shadow-md 2xl:h-7 2xl:w-7" />
                  <span className="text-lg font-bold tracking-tight text-white drop-shadow-md 2xl:text-xl">WhatsApp</span>
                </div>
              </div>
            </div>
            <h3 className="mt-2 text-[24px] font-light tracking-tight text-foreground/90 lg:text-[28px] 2xl:text-[32px]">
              Transformasi <span className="font-bold text-primary">Konversi Maksimal</span>
            </h3>
            <p className="mt-3 px-2 text-[13px] leading-relaxed text-muted-foreground/80 lg:mt-4 lg:px-4 lg:text-[14px] 2xl:text-[15px]">
              Ubah setiap obrolan menjadi penjualan riil. Maksimalkan kampanye performa tinggi Anda dengan mulus melalui dukungan <strong>CTWA</strong> penuh, pelacakan konversi <strong>Meta CAPI & Pixel</strong> termutakhir, serta terhubung langsung ke mesin <strong>Invoice</strong> cerdas kami.
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
            density === "compact" ? "space-y-2 px-3 py-3 sm:px-4 sm:py-4" : "space-y-3 px-3 py-4 sm:px-5 sm:py-5"
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
          <div className="inbox-fade-slide space-y-3">
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
                    isGroupChat={isGroupChat}
                    message={message}
                    onReplyMessage={(targetMessage) => {
                      const senderLabel = targetMessage.senderDisplayName?.trim() || targetMessage.senderPhoneE164?.trim() || null;
                      const preview = (targetMessage.text?.trim() ||
                        targetMessage.replyPreviewText?.trim() ||
                        (targetMessage.type === "IMAGE"
                          ? "Foto"
                          : targetMessage.type === "VIDEO"
                            ? "Video"
                            : targetMessage.type === "AUDIO"
                              ? "Audio"
                              : targetMessage.type === "DOCUMENT"
                                ? "Dokumen"
                                : targetMessage.type === "TEMPLATE"
                                  ? `Template: ${targetMessage.templateName ?? "Template"}`
                                  : "Pesan")) as string;
                      setReplyTarget({
                        id: targetMessage.id,
                        text: preview,
                        author:
                          senderLabel ||
                          (targetMessage.direction === "OUTBOUND"
                            ? "Anda"
                            : conversation?.customerDisplayName?.trim() || conversation?.customerPhoneE164 || "Penulis pesan")
                      });
                    }}
                    onReplyPrivatelyMessage={(targetMessage) => {
                      void onReplyPrivatelyFromMessage(targetMessage);
                    }}
                    onForwardMessage={(targetMessage) => {
                      setForwardMessage(targetMessage);
                      setForwardSearch("");
                      setForwardTargetPhone("");
                      setForwardTargetName("");
                      setSelectedForwardConversationIds([]);
                      setForwardError(null);
                      setIsForwardOpen(true);
                    }}
                    onCreateNoteFromMessage={(targetMessage) => {
                      void onCreateNoteFromMessage(targetMessage);
                    }}
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
        <div className="pointer-events-none absolute bottom-[5.15rem] left-1/2 z-[3] -translate-x-1/2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="pointer-events-auto h-9 rounded-full border border-emerald-600/35 bg-emerald-500/12 px-4 text-emerald-900 shadow-[0_10px_28px_-12px_rgba(16,185,129,0.45)] backdrop-blur-md transition hover:bg-emerald-500/18 hover:text-emerald-950 dark:border-emerald-400/45 dark:bg-emerald-500/15 dark:text-emerald-100 dark:shadow-[0_10px_28px_-12px_rgba(16,185,129,0.75)] dark:hover:bg-emerald-500/22 dark:hover:text-emerald-50"
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

      {isConversationSelected && scheduledBannerText ? (
        <div className="pointer-events-none absolute left-1/2 top-[68px] z-[4] -translate-x-1/2">
          <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-emerald-500/35 bg-emerald-500/12 px-3 py-1.5 text-[11px] font-medium text-emerald-900 shadow-md backdrop-blur-md dark:text-emerald-50">
            <CalendarClock className="h-3.5 w-3.5" />
            <span>{scheduledBannerText}</span>
            <button
              type="button"
              className="inline-flex h-5 w-5 items-center justify-center rounded-full text-emerald-900/70 transition hover:bg-emerald-500/20 hover:text-emerald-900 dark:text-emerald-100/80 dark:hover:text-emerald-50"
              onClick={() => setScheduledBannerText(null)}
              aria-label="Tutup notifikasi jadwal"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
      ) : null}

      {isConversationSelected ? (
        <MessageInput
          density={density}
          disabled={!isConversationSelected}
          focusKey={conversation?.id ?? null}
          textValue={activeDraft}
          replyTarget={replyTarget}
          onClearReplyTarget={() => setReplyTarget(null)}
          onTextValueChange={setDraftValue}
          onSendText={handleSendText}
          onSendAttachment={async (attachment, options) => onSendAttachment(attachment, options)}
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

      {isForwardOpen ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/55 px-0 py-0 backdrop-blur-sm sm:px-4 sm:py-6">
          <div className="flex h-full w-full max-w-lg flex-col overflow-hidden rounded-none border border-border/80 bg-background text-foreground shadow-2xl sm:h-[86vh] sm:max-h-[820px] sm:rounded-[26px]">
            <div className="border-b border-border/80 px-4 pb-3 pt-4">
              <div className="mb-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsForwardOpen(false)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-accent/80 hover:text-foreground"
                  aria-label="Tutup"
                >
                  <X className="h-4 w-4" />
                </button>
                <h3 className="text-lg font-medium text-foreground">Teruskan pesan ke</h3>
              </div>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={forwardSearch}
                  onChange={(event) => setForwardSearch(event.target.value)}
                  placeholder="Cari nama atau nomor"
                  className="h-11 rounded-full border-border bg-background pl-10 focus-visible:ring-emerald-500"
                />
              </div>
            </div>

            {forwardMessage ? (
              <div className="border-b border-border/80 px-4 py-2.5">
                <p className="line-clamp-2 text-xs text-muted-foreground">
                  {forwardMessage.text?.trim() || forwardMessage.replyPreviewText?.trim() || `[${forwardMessage.type}]`}
                </p>
              </div>
            ) : null}

            <div className="inbox-scroll min-h-0 flex-1 overflow-y-auto px-2 py-2">
              {isLoadingForwardTargets ? (
                <div className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Memuat daftar chat...
                </div>
              ) : null}
              {!isLoadingForwardTargets && forwardCandidates.length === 0 ? (
                <p className="px-3 py-3 text-sm text-muted-foreground">Tidak ada chat yang cocok.</p>
              ) : null}
              {forwardCandidates.map((item) => {
                const isSelected = selectedForwardConversationIds.includes(item.id);
                const title = item.customerDisplayName?.trim() || item.customerPhoneE164;
                const subtitle = item.customerDisplayName?.trim() ? item.customerPhoneE164 : item.lastMessagePreview || "-";
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setSelectedForwardConversationIds((current) =>
                        current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id]
                      );
                      setForwardError(null);
                    }}
                    className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition ${
                      isSelected ? "bg-accent/75" : "hover:bg-accent/45"
                    }`}
                  >
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                        isSelected ? "border-emerald-500 bg-emerald-500/20 text-emerald-500" : "border-border text-transparent"
                      }`}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-medium text-foreground">{title}</p>
                      <p className="truncate text-sm text-muted-foreground">{subtitle}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="space-y-2 border-t border-border/80 px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Atau nomor baru</p>
              <Input
                value={forwardTargetPhone}
                onChange={(event) => {
                  setForwardTargetPhone(event.target.value);
                }}
                placeholder="Nomor tujuan (+62...)"
                className="h-10 rounded-xl border-border bg-background"
              />
              <Input
                value={forwardTargetName}
                onChange={(event) => setForwardTargetName(event.target.value)}
                placeholder="Nama kontak (opsional)"
                className="h-10 rounded-xl border-border bg-background"
              />
              {forwardError ? <p className="text-sm text-destructive">{forwardError}</p> : null}
              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="ghost" onClick={() => setIsForwardOpen(false)}>
                  Batal
                </Button>
                <Button type="button" className="bg-emerald-600 text-white hover:bg-emerald-500" onClick={() => void handleSubmitForwardMessage()} disabled={isForwarding}>
                  {isForwarding ? "Meneruskan..." : "Teruskan"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
