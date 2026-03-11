"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { ChatHeader } from "@/components/inbox/chat/ChatHeader";
import { ChatMessagesSkeleton } from "@/components/inbox/chat/ChatMessagesSkeleton";
import { formatDayLabel, toDayKey } from "@/components/inbox/chat/chatUtils";
import { MessageBubble } from "@/components/inbox/MessageBubble";
import { MessageInput } from "@/components/inbox/MessageInput";
import type { ConversationItem, MessageItem } from "@/components/inbox/types";
import { Button } from "@/components/ui/button";
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
    fileName: string;
    mimeType: string;
    size: number;
  }) => Promise<void>;
  onSendTemplate: (input: {
    templateName: string;
    templateCategory: "MARKETING" | "UTILITY" | "AUTHENTICATION" | "SERVICE";
    templateLanguageCode: string;
  }) => Promise<void>;
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
  onSendTemplate,
  onToggleConversationStatus,
  onRetryOutboundMessage,
  onSelectProofMessage
}: ChatWindowProps) {
  const displayName = conversation?.customerDisplayName ?? "Unknown Customer";
  const isOpen = conversation?.status === "OPEN";
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const previousConversationIdRef = useRef<string | null>(null);
  const previousLastMessageIdRef = useRef<string | null>(null);
  const [activeDayLabel, setActiveDayLabel] = useState<string>("Today");
  const [showScrollToLatest, setShowScrollToLatest] = useState(false);
  const [animatedMessageId, setAnimatedMessageId] = useState<string | null>(null);
  const lastMessageId = messages.length > 0 ? messages[messages.length - 1]?.id ?? null : null;
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

  return (
    <section className="relative flex h-[calc(100vh-6.75rem)] min-h-[420px] flex-col overflow-hidden rounded-2xl border border-border/80 bg-card/90 shadow-md shadow-black/5 backdrop-blur-sm md:min-h-[560px]">
      <ChatHeader
        conversation={conversation}
        displayName={displayName}
        isOpen={isOpen}
        isUpdatingConversationStatus={isUpdatingConversationStatus}
        onToggleConversationStatus={() => {
          void onToggleConversationStatus();
        }}
      />

      <div
        ref={scrollRef}
        className={`inbox-scroll flex-1 overflow-y-auto bg-[radial-gradient(circle_at_50%_0%,hsl(var(--accent)/0.2),transparent_40%),linear-gradient(to_bottom,hsl(var(--background)/0.97),hsl(var(--background)/0.74))] ${
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

        {!isConversationSelected ? <EmptyStatePanel title="No Conversation Selected" message="Select a conversation to view messages." /> : null}

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
                <div key={message.id} className="space-y-3">
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
        onSendTemplate={onSendTemplate}
      />
    </section>
  );
}
