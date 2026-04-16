import Image from "next/image";
import { Ellipsis, Search, SendToBack, ShieldCheck, UsersRound } from "lucide-react";
import { useEffect, useState } from "react";

import type { ConversationItem } from "@/components/inbox/types";
import { Button } from "@/components/ui/button";
import { toAvatarTone } from "@/components/inbox/chat/chatUtils";
import { useLocalImageCache } from "@/lib/client/localImageCache";

type ChatHeaderProps = {
  conversation: ConversationItem | null;
  displayName: string;
  isCustomerTyping: boolean;
  isOpen: boolean;
  isCrmPanelOpen: boolean;
  isUpdatingConversationStatus: boolean;
  onOpenSearch: () => void;
  onOpenTransfer: () => void;
  onOpenResolve: () => void;
  onToggleCrmPanel: () => void;
};

export function ChatHeader({
  conversation,
  displayName,
  isCustomerTyping,
  isOpen,
  isCrmPanelOpen,
  isUpdatingConversationStatus,
  onOpenSearch,
  onOpenTransfer,
  onOpenResolve,
  onToggleCrmPanel
}: ChatHeaderProps) {
  const [avatarError, setAvatarError] = useState(false);
  const cachedCustomerAvatarUrl = useLocalImageCache(conversation?.customerAvatarUrl, {
    cacheKey: `chat-avatar:${conversation?.id ?? "none"}`,
    ttlMs: 24 * 60 * 60 * 1000,
    maxBytes: 180 * 1024
  });
  const avatarSrc = !avatarError ? cachedCustomerAvatarUrl ?? conversation?.customerAvatarUrl ?? undefined : undefined;
  const activityTimestamp = conversation?.lastMessageAt ?? conversation?.updatedAt ?? null;
  const avatarPresenceActive =
    conversation?.status === "OPEN" &&
    Boolean(activityTimestamp) &&
    new Date(activityTimestamp ?? 0).getTime() >= Date.now() - 5 * 60 * 1000;
  const isLatestMessageProofReady =
    conversation?.lastMessageDirection === "INBOUND" &&
    (conversation.lastMessageType === "IMAGE" || conversation.lastMessageType === "DOCUMENT");
  const isGroupConversation = Boolean(conversation?.waChatJid?.endsWith("@g.us"));
  const groupParticipantsLabel = (conversation?.groupParticipants ?? []).join(", ");

  useEffect(() => {
    setAvatarError(false);
  }, [conversation?.customerAvatarUrl]);

  return (
    <div className="flex items-center justify-between gap-2 border-b border-border/70 bg-card/95 px-3 py-2.5 sm:gap-3 sm:px-5 sm:py-3.5">
      {/* Avatar + Info */}
      <div className="flex min-w-0 flex-1 items-center gap-2.5 sm:gap-3">
        {avatarSrc ? (
          <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full border border-border/70 shadow-sm sm:h-11 sm:w-11">
            <Image
              src={avatarSrc}
              alt={displayName}
              fill
              unoptimized
              className="object-cover"
              onError={() => setAvatarError(true)}
            />
            <span
              className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card sm:h-3.5 sm:w-3.5 ${
                avatarPresenceActive ? "bg-emerald-500" : "bg-slate-300"
              }`}
              title={avatarPresenceActive ? "Active recently" : "No recent activity"}
            />
          </div>
        ) : (
          <div
            className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold shadow-sm sm:h-11 sm:w-11 ${toAvatarTone(
              `${conversation?.customerPhoneE164 ?? ""}:${displayName}`
            )}`}
          >
            {(conversation ? displayName : "I").slice(0, 1).toUpperCase()}
            {conversation ? (
              <span
                className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card sm:h-3.5 sm:w-3.5 ${
                  avatarPresenceActive ? "bg-emerald-500" : "bg-slate-300"
                }`}
                title={avatarPresenceActive ? "Active recently" : "No recent activity"}
              />
            ) : null}
          </div>
        )}

        <div className="min-w-0">
          <h2 className="truncate text-[15px] font-semibold leading-tight text-foreground sm:text-lg">
            {conversation ? (
              <span className="inline-flex items-center gap-1.5">
                {isGroupConversation ? <UsersRound className="h-3.5 w-3.5 text-indigo-500" /> : null}
                {displayName}
              </span>
            ) : "Belum ada chat dipilih"}
          </h2>
          {conversation ? (
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
              <span
                className={`inline-flex items-center rounded-full border px-1.5 py-0 text-[10px] font-semibold sm:px-2 sm:py-0.5 sm:text-[11px] ${
                  isOpen
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                }`}
              >
                {conversation.status === "OPEN" ? "Open" : "Closed"}
              </span>
              <span className="truncate text-[11px] text-muted-foreground">{conversation.customerPhoneE164}</span>
              {isGroupConversation && groupParticipantsLabel ? (
                <span className="hidden break-words text-[11px] leading-relaxed text-muted-foreground/90 sm:block">
                  {groupParticipantsLabel}
                </span>
              ) : null}
              {isCustomerTyping ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                  Mengetik...
                </span>
              ) : null}
              {isLatestMessageProofReady ? (
                <span
                  className="hidden items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-600 dark:text-emerald-400 sm:inline-flex"
                  title="Latest inbound media/document can be used as payment proof"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Proof ready
                </span>
              ) : null}
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground sm:text-xs">Pilih percakapan untuk mulai membalas.</p>
          )}
        </div>
      </div>

      {/* Action buttons — compact pill */}
      <div className="flex shrink-0 items-center gap-0 rounded-xl border border-border/70 bg-background/50 p-0.5 sm:gap-0.5 sm:rounded-2xl sm:p-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
          disabled={!conversation}
          title="Cari pesan"
          onClick={onOpenSearch}
        >
          <Search className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={!conversation}
          className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
          title="Transfer chat"
          onClick={onOpenTransfer}
        >
          <SendToBack className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={!conversation}
          className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
          title="Selesaikan percakapan"
          onClick={onOpenResolve}
        >
          <ShieldCheck className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={!conversation || isUpdatingConversationStatus}
          className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
          title={isCrmPanelOpen ? "Sembunyikan panel CRM" : "Tampilkan panel CRM"}
          onClick={onToggleCrmPanel}
        >
          <Ellipsis className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
