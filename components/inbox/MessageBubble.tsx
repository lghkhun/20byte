"use client";

import { MediaContent } from "@/components/inbox/bubble/MediaContent";
import { formatTime, normalizeRuntimeUrl, renderMediaLabel } from "@/components/inbox/bubble/utils";
import type { MessageItem } from "@/components/inbox/types";
import { Button } from "@/components/ui/button";

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
            ? `max-w-[90%] sm:max-w-[78%] rounded-2xl rounded-br-md border border-primary/35 bg-primary/[0.14] ${
                density === "compact" ? "px-3 py-2.5" : "px-4 py-3"
              } ${isEmphasized ? "inbox-pop-in" : ""} shadow-sm transition-all duration-150`
            : `max-w-[90%] sm:max-w-[78%] rounded-2xl rounded-bl-md border border-border/80 bg-card/95 ${
                density === "compact" ? "px-3 py-2.5" : "px-4 py-3"
              } ${isEmphasized ? "inbox-pop-in" : ""} shadow-sm transition-all duration-150`
        }
      >
        {message.type === "SYSTEM" ? <p className="mb-1 text-[11px] uppercase tracking-wide text-primary">System</p> : null}

        {message.templateName ? (
          <p className="mb-1 text-xs text-muted-foreground">
            Template: {message.templateName}
            {message.templateCategory ? ` (${message.templateCategory})` : ""}
          </p>
        ) : null}

        {isOutbound && message.sendStatus ? (
          <div className="mb-1">
            <span className="inline-flex rounded-full border border-border/70 bg-background/60 px-2 py-0.5 text-[11px] text-muted-foreground">
              {message.sendStatus}
              {message.sendAttemptCount > 0 ? ` • attempt ${message.sendAttemptCount}` : ""}
            </span>
          </div>
        ) : null}

        <MediaContent message={message} />

        {mediaLabel && message.type !== "IMAGE" && message.type !== "VIDEO" && message.type !== "AUDIO" && message.type !== "DOCUMENT" ? (
          <p className="mb-1 text-xs text-muted-foreground">
            {mediaLabel}
            {message.mediaUrl ? ` - ${message.mediaUrl}` : ""}
          </p>
        ) : null}

        {message.text ? <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">{renderTextWithLinks(message.text)}</p> : null}

        {canUseAsProof ? (
          <div className="mt-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => onSelectProofMessage?.(message.id)}
              className="h-7 rounded-md border border-border/70 px-2.5 text-[11px]"
            >
              Use as payment proof
            </Button>
          </div>
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
      </article>
    </div>
  );
}
