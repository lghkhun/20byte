import Image from "next/image";

import type { ConversationItem } from "@/components/inbox/types";
import { formatTimestamp, getSourceBadge, toAvatarTone, toInitials } from "@/components/inbox/conversation-list/utils";

type ConversationRowProps = {
  density: "compact" | "comfy";
  conversation: ConversationItem;
  isSelected: boolean;
  onSelect: (conversationId: string) => void;
};

export function ConversationRow({ density, conversation, isSelected, onSelect }: ConversationRowProps) {
  const sourceBadge = getSourceBadge(conversation.source);
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
            <Image src={conversation.customerAvatarUrl} alt={conversation.customerDisplayName ?? conversation.customerPhoneE164} fill unoptimized className="object-cover" />
            <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-card bg-emerald-500 shadow-sm" />
          </div>
        ) : (
          <div
            className={`relative flex ${density === "compact" ? "h-9 w-9 text-xs" : "h-11 w-11 text-sm"} shrink-0 items-center justify-center rounded-full font-semibold shadow-sm ${toAvatarTone(
              `${conversation.customerPhoneE164}:${conversation.customerDisplayName ?? ""}`
            )}`}
          >
            {toInitials(conversation.customerDisplayName, conversation.customerPhoneE164)}
            <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-card bg-emerald-500 shadow-sm" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <span className="truncate text-sm font-semibold text-foreground">
              {conversation.customerDisplayName ?? conversation.customerPhoneE164}
            </span>
            <span className="text-[11px] text-muted-foreground">{formatTimestamp(conversation.lastMessageAt)}</span>
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
              {conversation.status === "OPEN" ? <span className="h-2 w-2 rounded-full bg-emerald-500" /> : null}
              {conversation.unreadCount > 0 ? (
                <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
                  {conversation.unreadCount}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}
