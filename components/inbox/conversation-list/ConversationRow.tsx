import Image from "next/image";

import type { ConversationItem } from "@/components/inbox/types";
import { formatTimestamp, getSourceBadge, toAvatarTone, toInitials } from "@/components/inbox/conversation-list/utils";
import { useLocalImageCache } from "@/lib/client/localImageCache";

type ConversationRowProps = {
  density: "compact" | "comfy";
  conversation: ConversationItem;
  isSelected: boolean;
  nowMs?: number;
  onSelect: (conversationId: string) => void;
};

export function ConversationRow({ density, conversation, isSelected, nowMs, onSelect }: ConversationRowProps) {
  const cachedCustomerAvatarUrl = useLocalImageCache(conversation.customerAvatarUrl, {
    cacheKey: `customer-avatar:${conversation.id}`,
    ttlMs: 24 * 60 * 60 * 1000,
    maxBytes: 180 * 1024
  });
  const sourceBadge = getSourceBadge(conversation.source);
  const activityTimestamp = conversation.lastMessageAt ?? conversation.updatedAt;
  const avatarPresenceActive =
    conversation.status === "OPEN" &&
    Boolean(activityTimestamp) &&
    nowMs !== undefined &&
    new Date(activityTimestamp).getTime() >= nowMs - 5 * 60 * 1000;
  const isLatestMessageProofReady =
    conversation.lastMessageDirection === "INBOUND" &&
    (conversation.lastMessageType === "IMAGE" || conversation.lastMessageType === "DOCUMENT");
  const tooltipText = [
    `Source: ${conversation.source ?? "-"}`,
    `Campaign: ${conversation.sourceCampaign ?? "-"}`,
    `Adset: ${conversation.sourceAdset ?? conversation.sourcePlatform ?? "-"}`,
    `Ad: ${conversation.sourceAd ?? conversation.sourceMedium ?? "-"}`
  ].join("\n");

  return (
    <button
      type="button"
      onClick={() => onSelect(conversation.id)}
      className={
        isSelected
          ? `w-full border-l-2 border-primary bg-primary/[0.07] px-4 sm:px-5 ${density === "compact" ? "py-3" : "py-4"} text-left transition-all duration-150`
          : `w-full border-l-2 border-transparent px-4 sm:px-5 ${density === "compact" ? "py-3" : "py-4"} text-left transition-all duration-150 hover:bg-accent/40`
      }
    >
      <div className="flex items-start gap-3">
        {conversation.customerAvatarUrl ? (
          <div className={`relative ${density === "compact" ? "h-9 w-9" : "h-11 w-11"} shrink-0 overflow-hidden rounded-full border border-border/70 shadow-sm`}>
            <Image src={cachedCustomerAvatarUrl ?? conversation.customerAvatarUrl} alt={conversation.customerDisplayName ?? conversation.customerPhoneE164} fill unoptimized className="object-cover" />
            <span
              className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-card shadow-sm ${
                avatarPresenceActive ? "bg-emerald-500" : "bg-slate-300"
              }`}
              title={avatarPresenceActive ? "Active recently" : "No recent activity"}
            />
          </div>
        ) : (
          <div
            className={`relative flex ${density === "compact" ? "h-9 w-9 text-xs" : "h-11 w-11 text-sm"} shrink-0 items-center justify-center rounded-full font-semibold shadow-sm ${toAvatarTone(
              `${conversation.customerPhoneE164}:${conversation.customerDisplayName ?? ""}`
            )}`}
          >
            {toInitials(conversation.customerDisplayName, conversation.customerPhoneE164)}
            <span
              className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-card shadow-sm ${
                avatarPresenceActive ? "bg-emerald-500" : "bg-slate-300"
              }`}
              title={avatarPresenceActive ? "Active recently" : "No recent activity"}
            />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <span className="truncate text-sm font-semibold text-foreground">
              {conversation.customerDisplayName ?? conversation.customerPhoneE164}
            </span>
            <span className="text-[11px] text-muted-foreground">{formatTimestamp(activityTimestamp, nowMs)}</span>
          </div>
          <div className={`${density === "compact" ? "mt-1" : "mt-1.5"} flex items-center gap-1`}>
            <span className="line-clamp-1 text-xs text-muted-foreground">{conversation.lastMessagePreview ?? "No message preview yet"}</span>
          </div>
          <div className={`${density === "compact" ? "mt-2" : "mt-2.5"} flex items-center justify-between gap-2`}>
            <div className="flex min-w-0 items-center gap-2">
              <span className={sourceBadge.className} title={tooltipText}>
                {sourceBadge.label}
              </span>
              <span className="truncate text-[11px] text-muted-foreground">
                {conversation.assignedToMemberId ? "Assigned" : "Unassigned"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`h-2 w-2 rounded-full ${conversation.status === "OPEN" ? "bg-emerald-500" : "bg-slate-300"}`}
                title={conversation.status === "OPEN" ? "Conversation open" : "Conversation closed"}
                aria-label={conversation.status === "OPEN" ? "Conversation open" : "Conversation closed"}
              />
              {isLatestMessageProofReady ? (
                <span
                  className="inline-flex h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-emerald-100"
                  title="Latest message is ready for payment proof"
                  aria-label="Latest message is ready for payment proof"
                />
              ) : null}
              {conversation.unreadCount > 0 ? (
                <span
                  className="inline-flex min-w-6 items-center justify-center rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground"
                  title={`${conversation.unreadCount} unread message${conversation.unreadCount > 1 ? "s" : ""}`}
                  aria-label={`${conversation.unreadCount} unread message${conversation.unreadCount > 1 ? "s" : ""}`}
                >
                  {conversation.unreadCount > 99 ? "99+" : conversation.unreadCount}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}
