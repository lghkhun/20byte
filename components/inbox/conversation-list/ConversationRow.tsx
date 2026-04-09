import Image from "next/image";
import { useEffect, useState } from "react";

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
  const [avatarError, setAvatarError] = useState(false);
  const cachedCustomerAvatarUrl = useLocalImageCache(conversation.customerAvatarUrl, {
    cacheKey: `customer-avatar:${conversation.id}`,
    ttlMs: 24 * 60 * 60 * 1000,
    maxBytes: 180 * 1024
  });
  const avatarSrc = !avatarError ? cachedCustomerAvatarUrl ?? conversation.customerAvatarUrl ?? undefined : undefined;
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
  const isGroup = conversation.waChatJid?.endsWith("@g.us");
  const tooltipText = [
    `Source: ${conversation.source ?? "-"}`,
    `Campaign: ${conversation.sourceCampaign ?? "-"}`,
    `Adset: ${conversation.sourceAdset ?? conversation.sourcePlatform ?? "-"}`,
    `Ad: ${conversation.sourceAd ?? conversation.sourceMedium ?? "-"}`
  ].join("\n");

  const displaySourceBadge = conversation.shortlinkId
    ? {
        label: "Shortlink",
        className:
          "rounded border border-indigo-500/40 bg-indigo-500/10 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700 dark:text-indigo-300"
      }
    : sourceBadge;

  useEffect(() => {
    setAvatarError(false);
  }, [conversation.customerAvatarUrl]);

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
      <div className="flex items-start gap-3 relative">
        {avatarSrc ? (
          <div className={`relative ${density === "compact" ? "h-9 w-9" : "h-11 w-11"} shrink-0 overflow-hidden rounded-full border border-border/70 shadow-sm`}>
            <Image
              src={avatarSrc}
              alt={conversation.customerDisplayName ?? conversation.customerPhoneE164}
              fill
              unoptimized
              className="object-cover"
              onError={() => setAvatarError(true)}
            />
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

        {isGroup && (
          <div className="absolute top-7 left-7 flex h-5 w-5 items-center justify-center rounded-full bg-background p-1 shadow-sm ring-1 ring-border shadow-indigo-500/20">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2.5}
              stroke="currentColor"
              className="h-3 w-3 text-indigo-600"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z"
              />
            </svg>
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
            <span className="line-clamp-1 text-xs text-muted-foreground font-medium">
              {isGroup && conversation.lastMessageSenderName && (
                <span className="text-foreground/70">~{conversation.lastMessageSenderName}: </span>
              )}
              {conversation.lastMessagePreview ?? "No message preview yet"}
            </span>
          </div>
          <div className={`${density === "compact" ? "mt-2" : "mt-2.5"} flex items-center justify-between gap-2`}>
            <div className="flex min-w-0 items-center gap-2">
              <span className={displaySourceBadge.className} title={tooltipText}>
                {displaySourceBadge.label}
              </span>
              <span className="truncate text-[11px] text-muted-foreground max-w-[100px]" title={conversation.assignedToMemberName ?? undefined}>
                {conversation.assignedToMemberName ? conversation.assignedToMemberName : "Unassigned"}
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
