import { Ellipsis, Phone, Video } from "lucide-react";

import type { ConversationItem } from "@/components/inbox/types";
import { Button } from "@/components/ui/button";
import { toAvatarTone } from "@/components/inbox/chat/chatUtils";

type ChatHeaderProps = {
  conversation: ConversationItem | null;
  displayName: string;
  isOpen: boolean;
  isUpdatingConversationStatus: boolean;
  onToggleConversationStatus: () => void;
};

export function ChatHeader({
  conversation,
  displayName,
  isOpen,
  isUpdatingConversationStatus,
  onToggleConversationStatus
}: ChatHeaderProps) {
  const normalizedPhone = (conversation?.customerPhoneE164 ?? "").replace(/\D/g, "");

  const openWhatsAppIntent = (mode: "call" | "video") => {
    if (!normalizedPhone) {
      return;
    }

    const message =
      mode === "video"
        ? "Hi, we would like to schedule a video call with you."
        : "Hi, we would like to schedule a voice call with you.";
    const url = `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="flex items-center justify-between border-b border-border/80 bg-card/90 px-4 py-3.5 sm:px-6 sm:py-4">
      <div className="flex min-w-0 items-center gap-3">
        <div
          className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${toAvatarTone(
            `${conversation?.customerPhoneE164 ?? ""}:${displayName}`
          )}`}
        >
          {displayName.slice(0, 1).toUpperCase()}
          {conversation ? <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-card bg-emerald-500" /> : null}
        </div>
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold text-foreground sm:text-xl">{displayName}</h2>
          {conversation ? (
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span
                className={`inline-flex items-center rounded-full border px-2 py-0.5 ${
                  isOpen ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500" : "border-amber-500/30 bg-amber-500/10 text-amber-500"
                }`}
              >
                {conversation.status === "OPEN" ? "Online" : "Closed"}
              </span>
              <span className="truncate">{conversation.customerPhoneE164}</span>
            </div>
          ) : null}
        </div>
      </div>
      <div className="flex items-center gap-1.5 rounded-xl border border-border/80 bg-background/40 p-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="rounded-lg border border-border/70"
          disabled={!normalizedPhone}
          title={normalizedPhone ? "Open WhatsApp with video-call note" : "No phone number available"}
          onClick={() => openWhatsAppIntent("video")}
        >
          <Video className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="rounded-lg border border-border/70"
          disabled={!normalizedPhone}
          title={normalizedPhone ? "Open WhatsApp with call note" : "No phone number available"}
          onClick={() => openWhatsAppIntent("call")}
        >
          <Phone className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onToggleConversationStatus}
          disabled={!conversation || isUpdatingConversationStatus}
          className="rounded-lg border border-border/70"
          title={isOpen ? "Close conversation" : "Reopen conversation"}
        >
          <Ellipsis className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
