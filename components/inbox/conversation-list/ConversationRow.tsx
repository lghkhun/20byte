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

function MetaBadgeLogo() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5 shrink-0"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="12" cy="12" r="12" className="fill-sky-500 dark:fill-sky-400" />
      <path
        d="M4.92 12.48C4.92 9.34 6.52 7.22 8.78 7.22C10.27 7.22 11.45 8.12 12.86 10.16C14.16 8.13 15.36 7.22 16.82 7.22C19.09 7.22 20.68 9.34 20.68 12.48C20.68 15.58 19.09 17.78 16.82 17.78C15.27 17.78 14.05 16.9 12.64 14.84C11.35 16.87 10.15 17.78 8.78 17.78C6.52 17.78 4.92 15.58 4.92 12.48ZM7.01 12.48C7.01 14.44 7.88 16.05 9.23 16.05C10.2 16.05 11 15.38 12.17 13.57L9.95 10.55C9.22 9.57 8.6 8.95 7.95 8.95C7.06 8.95 7.01 10.54 7.01 12.48ZM12.64 10.94L14.84 13.95C15.57 14.94 16.23 16.05 17.1 16.05C18.53 16.05 18.59 14.44 18.59 12.48C18.59 10.53 18.53 8.95 17.1 8.95C16.09 8.95 15.27 9.72 14.12 11.36L13.3 12.54L12.64 10.94Z"
        className="fill-white"
      />
    </svg>
  );
}

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
  const senderLabel = conversation.lastMessageSenderName?.trim() || "Kontak";
  const rawDisplayName = conversation.customerDisplayName?.trim() || null;
  const hasSuspiciousSelfNameOnPersonal =
    !isGroup &&
    Boolean(rawDisplayName) &&
    conversation.lastMessageDirection === "OUTBOUND" &&
    rawDisplayName === (conversation.lastMessageSenderName?.trim() || null);
  const resolvedConversationName = hasSuspiciousSelfNameOnPersonal
    ? conversation.customerPhoneE164
    : rawDisplayName ?? conversation.customerPhoneE164;
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
          "rounded border border-indigo-500/40 bg-indigo-500/10 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700 dark:text-indigo-300",
        isMeta: false
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
              {resolvedConversationName}
            </span>
            <span className="text-[11px] text-muted-foreground">{formatTimestamp(activityTimestamp, nowMs)}</span>
          </div>
          <div className={`${density === "compact" ? "mt-1" : "mt-1.5"} flex items-center gap-1`}>
            <span className="line-clamp-1 text-xs text-muted-foreground font-medium">
              {isGroup && (
                <span className="text-foreground/70">~{senderLabel}: </span>
              )}
              {conversation.lastMessagePreview ?? "No message preview yet"}
            </span>
          </div>
          <div className={`${density === "compact" ? "mt-2" : "mt-2.5"} flex items-center justify-between gap-2`}>
            <div className="flex min-w-0 items-center gap-2">
              {displaySourceBadge ? (
                <span className={displaySourceBadge.className} title={tooltipText}>
                  {displaySourceBadge.isMeta ? <MetaBadgeLogo /> : null}
                  <span>{displaySourceBadge.label}</span>
                </span>
              ) : null}
              {conversation.assignedToMemberName ? (
                <span className="truncate text-[11px] text-muted-foreground max-w-[100px]" title={conversation.assignedToMemberName}>
                  {conversation.assignedToMemberName}
                </span>
              ) : null}
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
