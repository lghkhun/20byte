"use client";

import { ChevronDown, Copy, CornerUpLeft, Info, Receipt } from "lucide-react";

import { MediaContent } from "@/components/inbox/bubble/MediaContent";
import { formatTime, normalizeRuntimeUrl, renderMediaLabel } from "@/components/inbox/bubble/utils";
import type { MessageItem } from "@/components/inbox/types";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";

function renderTextWithLinks(text: string) {
  const urlRegex = /(https?:\/\/[^\s]+)/gi;
  const parts = text.split(urlRegex);

  return parts.map((part, index) => {
    if (/^https?:\/\//i.test(part)) {
      const normalizedUrl = normalizeRuntimeUrl(part);
      return (
        <a
          key={`${part}-${index}`}
          href={normalizedUrl}
          target="_blank"
          rel="noreferrer"
          className="break-all text-primary underline underline-offset-2"
        >
          {normalizedUrl}
        </a>
      );
    }

    return <span key={`${part}-${index}`}>{part}</span>;
  });
}

type MessageBubbleProps = {
  density?: "compact" | "comfy";
  isEmphasized?: boolean;
  message: MessageItem;
  onReplyMessage?: (message: MessageItem) => void;
  onSelectProofMessage?: (messageId: string) => void;
  onRetryOutboundMessage?: (messageId: string) => void;
};

function resolveDeliveryIndicator(
  message: MessageItem
): { icon: string; className: string; title: string } | null {
  if (message.direction !== "OUTBOUND") {
    return null;
  }

  if (message.sendStatus === "FAILED") {
    return {
      icon: "!",
      className: "text-destructive",
      title: "Gagal terkirim"
    };
  }

  if (message.sendStatus !== "SENT") {
    return {
      icon: "○",
      className: "text-muted-foreground",
      title: "Sedang mengirim"
    };
  }

  if (message.deliveryStatus === "READ") {
    return {
      icon: "✓✓",
      className: "text-sky-500",
      title: "Sudah dibaca customer"
    };
  }

  if (message.deliveryStatus === "DELIVERED") {
    return {
      icon: "✓✓",
      className: "text-muted-foreground",
      title: "Terkirim ke perangkat customer"
    };
  }

  return {
    icon: "✓",
    className: "text-muted-foreground",
    title: "Terkirim ke server WhatsApp"
  };
}

export function MessageBubble({
  density = "comfy",
  isEmphasized = false,
  message,
  onReplyMessage,
  onSelectProofMessage,
  onRetryOutboundMessage
}: MessageBubbleProps) {
  const isOutbound = message.direction === "OUTBOUND";
  const mediaLabel = renderMediaLabel(message);
  const canUseAsProof =
    !isOutbound && (message.type === "IMAGE" || message.type === "DOCUMENT") && Boolean(message.mediaUrl) && Boolean(onSelectProofMessage);
  const deliveryIndicator = resolveDeliveryIndicator(message);

  return (
    <div className={isOutbound ? "flex justify-end" : "flex justify-start"}>
      <article
        className={
          isOutbound
            ? `max-w-[90%] sm:max-w-[78%] rounded-[20px] rounded-br-[4px] border border-primary/20 bg-gradient-to-br from-primary/[0.15] to-primary/[0.05] shadow-sm backdrop-blur-sm ${
                density === "compact" ? "px-3 py-2.5" : "px-4 py-3"
              } ${isEmphasized ? "inbox-pop-in" : ""} transition-all duration-150 relative overflow-hidden group`
            : `max-w-[90%] sm:max-w-[78%] rounded-[20px] rounded-bl-[4px] border border-border/60 bg-gradient-to-br from-card/95 to-muted/40 shadow-sm backdrop-blur-sm ${
                density === "compact" ? "px-3 py-2.5" : "px-4 py-3"
              } ${isEmphasized ? "inbox-pop-in" : ""} transition-all duration-150 relative overflow-hidden group`
        }
      >
        {message.type === "SYSTEM" ? <div className="mb-2 inline-flex rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-primary">System Notice</div> : null}

        {message.templateName ? (
          <p className="mb-1 text-xs text-muted-foreground">
            Template: {message.templateName}
            {message.templateCategory ? ` (${message.templateCategory})` : ""}
          </p>
        ) : null}

        {message.replyToMessageId || message.replyToWaMessageId ? (
          <div className="mb-2 rounded-lg border border-border/70 bg-background/60 px-2.5 py-1.5">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {isOutbound ? "Membalas" : "Balasan"}
            </p>
            <p className="line-clamp-2 break-words text-xs text-foreground/90">
              {message.replyPreviewText?.trim() || "Pesan yang dibalas"}
            </p>
          </div>
        ) : null}

        <MediaContent message={message} />

        {mediaLabel && message.type !== "IMAGE" && message.type !== "VIDEO" && message.type !== "AUDIO" && message.type !== "DOCUMENT" ? (
          <p className="mb-1 text-xs text-muted-foreground">
            {mediaLabel}
            {message.mediaUrl ? ` - ${message.mediaUrl}` : ""}
          </p>
        ) : null}

        {message.text ? (
          <p className="emoji-render whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">
            {renderTextWithLinks(message.text)}
          </p>
        ) : null}

        {isOutbound && message.sendStatus === "FAILED" ? (
          <div className="mt-2 space-y-1">
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1 text-[11px] text-destructive">
              {message.sendError ?? "Failed to send message."}
            </p>
            {message.retryable ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onRetryOutboundMessage?.(message.id)}
                className="h-7 rounded-md border-destructive/40 px-2.5 text-[11px] text-destructive hover:bg-destructive/10"
              >
                Retry send
              </Button>
            ) : null}
          </div>
        ) : null}

        <div className="mt-1 flex items-center justify-end gap-1 text-[11px] text-muted-foreground">
          <span>{formatTime(message.createdAt)}</span>
          {deliveryIndicator ? (
            <span className={`font-semibold ${deliveryIndicator.className}`} title={deliveryIndicator.title}>
              {deliveryIndicator.icon}
            </span>
          ) : null}
        </div>

        <div className="absolute right-1.5 top-1.5 opacity-0 transition-opacity group-hover:opacity-100">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" size="icon" variant="ghost" className="h-6 w-6 rounded-full text-muted-foreground/90">
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align={isOutbound ? "end" : "start"} className="w-44">
              <DropdownMenuItem
                onSelect={() => onReplyMessage?.(message)}
                className="flex items-center gap-2"
              >
                <CornerUpLeft className="h-4 w-4" />
                Balas
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => {
                  const text = message.text?.trim() || message.replyPreviewText?.trim() || "";
                  if (!text) {
                    return;
                  }
                  void navigator.clipboard?.writeText(text);
                }}
                className="flex items-center gap-2"
              >
                <Copy className="h-4 w-4" />
                Salin
              </DropdownMenuItem>
              {canUseAsProof ? (
                <DropdownMenuItem
                  onSelect={() => onSelectProofMessage?.(message.id)}
                  className="flex items-center gap-2"
                >
                  <Receipt className="h-4 w-4" />
                  Use as payment proof
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem className="flex items-center gap-2 text-muted-foreground">
                <Info className="h-4 w-4" />
                Info pesan
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </article>
    </div>
  );
}
