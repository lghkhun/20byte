import Image from "next/image";
import { CheckCheck, Ellipsis, Search, SendToBack, ShieldCheck, Trash2, X } from "lucide-react";

import { IndicatorLegend } from "@/components/inbox/IndicatorLegend";
import type { ConversationItem } from "@/components/inbox/types";
import { Button } from "@/components/ui/button";
import { toAvatarTone } from "@/components/inbox/chat/chatUtils";
import { useLocalImageCache } from "@/lib/client/localImageCache";
import { formatLeadSettingLabel } from "@/lib/crm/leadSettingsConfig";

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
  onDeleteConversation: () => void;
  onUnselectConversation: () => void;
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
  onDeleteConversation,
  onUnselectConversation,
  onToggleCrmPanel
}: ChatHeaderProps) {
  const cachedCustomerAvatarUrl = useLocalImageCache(conversation?.customerAvatarUrl, {
    cacheKey: `chat-avatar:${conversation?.id ?? "none"}`,
    ttlMs: 24 * 60 * 60 * 1000,
    maxBytes: 180 * 1024
  });
  const activityTimestamp = conversation?.lastMessageAt ?? conversation?.updatedAt ?? null;
  const avatarPresenceActive =
    conversation?.status === "OPEN" &&
    Boolean(activityTimestamp) &&
    new Date(activityTimestamp ?? 0).getTime() >= Date.now() - 5 * 60 * 1000;
  const isLatestMessageProofReady =
    conversation?.lastMessageDirection === "INBOUND" &&
    (conversation.lastMessageType === "IMAGE" || conversation.lastMessageType === "DOCUMENT");

  return (
    <div className="flex items-center justify-between border-b border-border/70 bg-card/95 px-4 py-3.5 sm:px-6 sm:py-4">
      <div className="flex min-w-0 items-center gap-3">
        {conversation?.customerAvatarUrl ? (
          <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full border border-border/70 shadow-sm">
            <Image
              src={cachedCustomerAvatarUrl ?? conversation.customerAvatarUrl}
              alt={displayName}
              fill
              unoptimized
              className="object-cover"
            />
            <span
              className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-card ${
                avatarPresenceActive ? "bg-emerald-500" : "bg-slate-300"
              }`}
              title={avatarPresenceActive ? "Active recently" : "No recent activity"}
            />
          </div>
        ) : (
          <div
            className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold shadow-sm ${toAvatarTone(
              `${conversation?.customerPhoneE164 ?? ""}:${displayName}`
            )}`}
          >
            {(conversation ? displayName : "I").slice(0, 1).toUpperCase()}
            {conversation ? (
              <span
                className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-card ${
                  avatarPresenceActive ? "bg-emerald-500" : "bg-slate-300"
                }`}
                title={avatarPresenceActive ? "Active recently" : "No recent activity"}
              />
            ) : null}
          </div>
        )}
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold text-foreground sm:text-xl">
            {conversation ? displayName : "Belum ada chat dipilih"}
          </h2>
          {conversation ? (
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span
                className={`inline-flex items-center rounded-full border px-2 py-0.5 ${
                  isOpen ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                }`}
                title={conversation.status === "OPEN" ? "Conversation is open" : "Conversation is closed"}
              >
                {conversation.status === "OPEN" ? "Open" : "Closed"}
              </span>
              <span className="truncate">{conversation.customerPhoneE164}</span>
              {isCustomerTyping ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-emerald-600 dark:text-emerald-400">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                  Sedang mengetik...
                </span>
              ) : null}
              <span className="inline-flex items-center gap-1 rounded-full border border-border/80 bg-background/80 px-2 py-0.5">
                <CheckCheck className="h-3 w-3" />
                {conversation.assignedToMemberId ? "Assigned" : "Unassigned"}
              </span>
              {isLatestMessageProofReady ? (
                <span
                  className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-emerald-600 dark:text-emerald-400"
                  title="Latest inbound media/document can be used as payment proof"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Proof ready
                </span>
              ) : null}
              <span
                className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-primary"
                title="Customer lead status"
              >
                {formatLeadSettingLabel(conversation.customerLeadStatus ?? "NEW_LEAD")}
              </span>
            </div>
          ) : <p className="text-xs text-muted-foreground">Pilih percakapan di panel kiri untuk mulai membalas customer.</p>}
        </div>
      </div>
      <div className="flex items-center gap-1.5 rounded-2xl border border-border/80 bg-background/55 p-1">
        <IndicatorLegend compact />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="rounded-lg border border-border/70"
          disabled={!conversation}
          title="Search in messages"
          onClick={onOpenSearch}
        >
          <Search className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={!conversation}
          className="rounded-lg border border-border/70"
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
          className="rounded-lg border border-border/70"
          title="Resolve conversation"
          onClick={onOpenResolve}
        >
          <ShieldCheck className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={!conversation}
          className="rounded-lg border border-border/70 text-destructive hover:text-destructive"
          title="Delete chat"
          onClick={onDeleteConversation}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={!conversation}
          className="rounded-lg border border-border/70"
          title="Keluar dari chat (Esc)"
          onClick={onUnselectConversation}
        >
          <X className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={!conversation || isUpdatingConversationStatus}
          className="rounded-lg border border-border/70"
          title={isCrmPanelOpen ? "Hide CRM panel" : "Show CRM panel"}
          onClick={onToggleCrmPanel}
        >
          <Ellipsis className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
