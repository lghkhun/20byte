"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Copy, CornerUpLeft, Forward, Info, NotebookPen, Receipt, UserRound } from "lucide-react";

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

type LinkPreviewItem = {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
};

type LinkPreviewResponse = {
  data?: {
    preview?: LinkPreviewItem;
  };
};

const URL_REGEX_GLOBAL = /(https?:\/\/[^\s]+)/gi;
const URL_REGEX_SINGLE = /(https?:\/\/[^\s]+)/i;
const LINK_PREVIEW_CACHE_TTL_MS = 30 * 60 * 1000;
const linkPreviewCache = new Map<string, { expiresAt: number; preview: LinkPreviewItem | null }>();

function normalizeDetectedUrl(raw: string): { url: string; trailing: string } {
  const trimmed = raw.trim();
  const match = trimmed.match(/^(.*?)([),.!?:;"']*)$/);
  if (!match) {
    return {
      url: trimmed,
      trailing: ""
    };
  }

  return {
    url: match[1] ?? trimmed,
    trailing: match[2] ?? ""
  };
}

function extractFirstUrl(text: string | null): string | null {
  if (!text) {
    return null;
  }

  const match = text.match(URL_REGEX_SINGLE);
  if (!match || !match[1]) {
    return null;
  }

  const normalized = normalizeDetectedUrl(match[1]).url;
  return /^https?:\/\//i.test(normalized) ? normalized : null;
}

function safeHostname(value: string): string {
  try {
    return new URL(value).hostname;
  } catch {
    return value;
  }
}

function renderTextWithLinks(text: string) {
  const parts = text.split(URL_REGEX_GLOBAL);

  return parts.map((part, index) => {
    if (/^https?:\/\//i.test(part)) {
      const normalizedPart = normalizeDetectedUrl(part);
      const normalizedUrl = normalizeRuntimeUrl(normalizedPart.url);
      return (
        <span key={`${part}-${index}`}>
          <a
            href={normalizedUrl}
            target="_blank"
            rel="noreferrer"
            className="break-all text-primary underline underline-offset-2"
          >
            {normalizedUrl}
          </a>
          {normalizedPart.trailing}
        </span>
      );
    }

    return <span key={`${part}-${index}`}>{part}</span>;
  });
}

type MessageBubbleProps = {
  density?: "compact" | "comfy";
  isEmphasized?: boolean;
  isGroupChat?: boolean;
  message: MessageItem;
  onReplyMessage?: (message: MessageItem) => void;
  onReplyPrivatelyMessage?: (message: MessageItem) => void;
  onForwardMessage?: (message: MessageItem) => void;
  onCreateNoteFromMessage?: (message: MessageItem) => void;
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
  isGroupChat = false,
  message,
  onReplyMessage,
  onReplyPrivatelyMessage,
  onForwardMessage,
  onCreateNoteFromMessage,
  onSelectProofMessage,
  onRetryOutboundMessage
}: MessageBubbleProps) {
  const isOutbound = message.direction === "OUTBOUND";
  const mediaLabel = renderMediaLabel(message);
  const firstLinkUrl = useMemo(() => extractFirstUrl(message.text), [message.text]);
  const [linkPreview, setLinkPreview] = useState<LinkPreviewItem | null>(null);
  const canUseAsProof =
    !isOutbound && (message.type === "IMAGE" || message.type === "DOCUMENT") && Boolean(message.mediaUrl) && Boolean(onSelectProofMessage);
  const deliveryIndicator = resolveDeliveryIndicator(message);
  const senderLabel = message.senderDisplayName?.trim() || message.senderPhoneE164?.trim() || null;

  useEffect(() => {
    if (!firstLinkUrl) {
      setLinkPreview(null);
      return;
    }

    const cached = linkPreviewCache.get(firstLinkUrl);
    if (cached && cached.expiresAt > Date.now()) {
      setLinkPreview(cached.preview);
      return;
    }

    const controller = new AbortController();
    void (async () => {
      try {
        const params = new URLSearchParams({ url: firstLinkUrl });
        const response = await fetch(`/api/link-preview?${params.toString()}`, {
          signal: controller.signal
        });
        if (!response.ok) {
          linkPreviewCache.set(firstLinkUrl, {
            expiresAt: Date.now() + LINK_PREVIEW_CACHE_TTL_MS,
            preview: null
          });
          setLinkPreview(null);
          return;
        }

        const payload = (await response.json().catch(() => null)) as LinkPreviewResponse | null;
        const preview = payload?.data?.preview ?? null;
        linkPreviewCache.set(firstLinkUrl, {
          expiresAt: Date.now() + LINK_PREVIEW_CACHE_TTL_MS,
          preview
        });
        setLinkPreview(preview);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        linkPreviewCache.set(firstLinkUrl, {
          expiresAt: Date.now() + LINK_PREVIEW_CACHE_TTL_MS,
          preview: null
        });
        setLinkPreview(null);
      }
    })();

    return () => controller.abort();
  }, [firstLinkUrl]);

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
        {isGroupChat && senderLabel ? (
          <p className="mb-1 text-xs font-semibold text-foreground/80">~ {senderLabel}</p>
        ) : null}

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
            {isGroupChat && message.replyPreviewSenderName ? (
              <p className="mb-0.5 text-[11px] font-semibold text-foreground/80">~ {message.replyPreviewSenderName}</p>
            ) : null}
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
        {linkPreview ? (
          <a
            href={linkPreview.url}
            target="_blank"
            rel="noreferrer"
            className="mt-2 block overflow-hidden rounded-xl border border-border/70 bg-background/70 transition hover:border-primary/40"
          >
            {linkPreview.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={linkPreview.image} alt={linkPreview.title ?? "Link preview"} className="h-32 w-full object-cover" loading="lazy" />
            ) : null}
            <div className="space-y-1 px-3 py-2">
              <p className="line-clamp-2 text-xs font-semibold text-foreground">{linkPreview.title || linkPreview.url}</p>
              {linkPreview.description ? (
                <p className="line-clamp-3 text-xs text-muted-foreground">{linkPreview.description}</p>
              ) : null}
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground/80">{linkPreview.siteName || safeHostname(linkPreview.url)}</p>
            </div>
          </a>
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
              {onReplyPrivatelyMessage && message.direction === "INBOUND" && message.senderPhoneE164 ? (
                <DropdownMenuItem
                  onSelect={() => onReplyPrivatelyMessage(message)}
                  className="flex items-center gap-2"
                >
                  <UserRound className="h-4 w-4" />
                  Balas secara pribadi
                </DropdownMenuItem>
              ) : null}
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
              {onForwardMessage ? (
                <DropdownMenuItem
                  onSelect={() => onForwardMessage(message)}
                  className="flex items-center gap-2"
                >
                  <Forward className="h-4 w-4" />
                  Teruskan
                </DropdownMenuItem>
              ) : null}
              {onCreateNoteFromMessage ? (
                <DropdownMenuItem
                  onSelect={() => onCreateNoteFromMessage(message)}
                  className="flex items-center gap-2"
                >
                  <NotebookPen className="h-4 w-4" />
                  Catat
                </DropdownMenuItem>
              ) : null}
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
