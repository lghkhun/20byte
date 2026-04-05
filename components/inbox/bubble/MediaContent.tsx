import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { createPortal } from "react-dom";
import { Download, FileText, PlayCircle, X } from "lucide-react";

import type { MessageItem } from "@/components/inbox/types";
import { Button } from "@/components/ui/button";
import { useLocalImageCache } from "@/lib/client/localImageCache";
import { useModalAccessibility } from "@/lib/a11y/useModalAccessibility";

type MediaOrientation = "portrait" | "landscape" | "square" | "unknown";

function resolveOrientation(width?: number, height?: number): MediaOrientation {
  if (!width || !height || width <= 0 || height <= 0) {
    return "unknown";
  }
  const ratio = width / height;
  if (ratio > 1.15) {
    return "landscape";
  }
  if (ratio < 0.87) {
    return "portrait";
  }
  return "square";
}

function bubbleMediaClass(orientation: MediaOrientation): string {
  if (orientation === "portrait") {
    return "max-h-[520px] w-auto max-w-[min(68vw,360px)] object-contain";
  }
  if (orientation === "landscape") {
    return "max-h-[420px] w-auto max-w-[min(78vw,520px)] object-contain";
  }
  if (orientation === "square") {
    return "max-h-[420px] w-auto max-w-[min(72vw,420px)] object-contain";
  }
  return "max-h-[460px] w-auto max-w-[min(74vw,420px)] object-contain";
}

function FullscreenMediaModal({
  open,
  onClose,
  mediaUrl,
  fileName,
  mimeType,
  mode
}: {
  open: boolean;
  onClose: () => void;
  mediaUrl: string;
  fileName?: string | null;
  mimeType?: string | null;
  mode: "image" | "video";
}) {
  const isClient = typeof window !== "undefined";
  const containerRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  useModalAccessibility({
    open,
    onClose,
    containerRef,
    initialFocusRef: closeButtonRef
  });

  useEffect(() => {
    if (!open || !isClient) {
      return;
    }

    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleEsc);
    return () => {
      window.removeEventListener("keydown", handleEsc);
    };
  }, [isClient, onClose, open]);

  if (!open || !isClient) {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[90] bg-black/90 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label="Media preview"
      onClick={onClose}
    >
      <div className="absolute inset-x-0 top-0 z-10 flex h-14 items-center justify-between border-b border-white/10 bg-black/35 px-3 backdrop-blur-sm">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-white">{fileName?.trim() || "Media"}</p>
          <p className="truncate text-[11px] text-white/60">{mimeType?.trim() || "-"}</p>
        </div>
        <div className="ml-3 flex items-center gap-1.5">
          <Button asChild variant="ghost" size="icon" className="h-8 w-8 rounded-full text-white/90 hover:bg-white/10 hover:text-white">
            <a href={mediaUrl} download={fileName ?? undefined} target="_blank" rel="noreferrer" aria-label="Unduh media">
              <Download className="h-4 w-4" />
            </a>
          </Button>
          <Button ref={closeButtonRef} type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-full text-white/90 hover:bg-white/10 hover:text-white" onClick={onClose} aria-label="Tutup preview">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div
        ref={containerRef}
        className="flex h-full w-full items-center justify-center px-4 pb-6 pt-16"
        onClick={(event) => event.stopPropagation()}
      >
        {mode === "image" ? (
          <Image
            src={mediaUrl}
            alt={fileName ?? "Image attachment"}
            width={1600}
            height={1200}
            unoptimized
            className="max-h-[calc(100vh-96px)] w-auto max-w-[calc(100vw-32px)] rounded-md object-contain"
          />
        ) : (
          <video controls autoPlay preload="metadata" className="max-h-[calc(100vh-96px)] w-auto max-w-[calc(100vw-32px)] rounded-md bg-black object-contain">
            <source src={mediaUrl} type={mimeType ?? undefined} />
            Browser tidak mendukung pemutaran video.
          </video>
        )}
      </div>
    </div>,
    window.document.body
  );
}

function ImagePreview({ message }: { message: MessageItem }) {
  const cachedMediaUrl = useLocalImageCache(message.mediaUrl, {
    cacheKey: message.id ? `chat-media:${message.id}` : undefined,
    ttlMs: 12 * 60 * 60 * 1000,
    maxBytes: 2 * 1024 * 1024
  });
  const [failed, setFailed] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [orientation, setOrientation] = useState<MediaOrientation>("unknown");
  const mediaUrl = cachedMediaUrl ?? message.mediaUrl ?? null;

  if (!mediaUrl || failed) {
    return (
      <div className="mb-2 rounded-lg border border-border bg-background/40 px-3 py-2 text-xs text-muted-foreground">
        Image unavailable
      </div>
    );
  }

  return (
    <>
      <button type="button" className="mb-2 block" onClick={() => setIsOpen(true)}>
        <Image
          src={mediaUrl}
          alt={message.fileName ?? "Image attachment"}
          width={720}
          height={720}
          unoptimized
          className={`rounded-xl border border-border bg-black/10 ${bubbleMediaClass(
            message.mimeType === "image/webp" ? "portrait" : orientation
          )}`}
          onLoadingComplete={(image) => {
            setOrientation(resolveOrientation(image.naturalWidth, image.naturalHeight));
          }}
          onError={() => setFailed(true)}
        />
      </button>
      <FullscreenMediaModal
        open={isOpen}
        onClose={() => setIsOpen(false)}
        mediaUrl={mediaUrl}
        fileName={message.fileName}
        mimeType={message.mimeType}
        mode="image"
      />
    </>
  );
}

function VideoPreview({ message }: { message: MessageItem }) {
  const cachedMediaUrl = useLocalImageCache(message.mediaUrl, {
    cacheKey: message.id ? `chat-media:${message.id}` : undefined,
    ttlMs: 12 * 60 * 60 * 1000,
    maxBytes: 4 * 1024 * 1024
  });
  const [failed, setFailed] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [orientation, setOrientation] = useState<MediaOrientation>("unknown");
  const mediaUrl = cachedMediaUrl ?? message.mediaUrl ?? null;

  if (!mediaUrl || failed) {
    return (
      <div className="mb-2 rounded-lg border border-border bg-background/40 px-3 py-2 text-xs text-muted-foreground">
        Video unavailable
      </div>
    );
  }

  return (
    <>
      <button type="button" className="group relative mb-2 block overflow-hidden rounded-xl border border-border bg-background/60 text-left" onClick={() => setIsOpen(true)}>
        <div className={`${bubbleMediaClass(orientation)} flex items-center justify-center bg-gradient-to-br from-muted/50 via-background/70 to-muted/30`}>
          <video
            preload="metadata"
            className="pointer-events-none max-h-[460px] w-auto max-w-full object-contain opacity-80"
            onLoadedMetadata={(event) => {
              setOrientation(resolveOrientation(event.currentTarget.videoWidth, event.currentTarget.videoHeight));
            }}
            onError={() => setFailed(true)}
          >
            <source src={mediaUrl} type={message.mimeType ?? undefined} />
          </video>
          <div className="absolute inset-0 flex items-center justify-center">
            <PlayCircle className="h-14 w-14 text-white/90 drop-shadow-lg transition group-hover:scale-105" />
          </div>
          <div className="absolute right-2 top-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[11px] font-medium text-white">VIDEO</div>
        </div>
      </button>
      <FullscreenMediaModal
        open={isOpen}
        onClose={() => setIsOpen(false)}
        mediaUrl={mediaUrl}
        fileName={message.fileName}
        mimeType={message.mimeType}
        mode="video"
      />
    </>
  );
}

function AudioPreview({ message }: { message: MessageItem }) {
  const [failed, setFailed] = useState(false);
  if (!message.mediaUrl || failed) {
    return (
      <div className="mb-2 rounded-lg border border-border bg-background/40 px-3 py-2 text-xs text-muted-foreground">
        Audio unavailable
      </div>
    );
  }

  return (
    <audio
      controls
      preload="metadata"
      className="mb-2 w-full rounded-lg border border-border bg-background/50"
      onError={() => setFailed(true)}
    >
      <source src={message.mediaUrl} type={message.mimeType ?? undefined} />
      Browser tidak mendukung audio.
    </audio>
  );
}

function DocumentDownload({ message }: { message: MessageItem }) {
  if (!message.mediaUrl) {
    return (
      <div className="mb-2 rounded-lg border border-border bg-background/40 px-3 py-2 text-xs text-muted-foreground">
        Document unavailable
      </div>
    );
  }

  return (
    <div className="mb-2 flex items-center gap-3 rounded-xl border border-border/80 bg-background/70 px-3 py-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-card/80">
        <FileText className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{message.fileName ?? "Document"}</p>
        <p className="truncate text-xs text-muted-foreground">{message.mimeType ?? "Unknown type"}</p>
      </div>
      <div className="flex items-center gap-2">
        <Button asChild variant="secondary" size="sm" className="h-8 rounded-lg border border-border/70 px-3 text-xs">
          <a href={message.mediaUrl} target="_blank" rel="noreferrer" download={message.fileName ?? undefined}>
            Unduh
          </a>
        </Button>
      </div>
    </div>
  );
}

export function MediaContent({ message }: { message: MessageItem }) {
  const mediaType = useMemo(() => message.type, [message.type]);

  if (mediaType === "IMAGE") {
    return <ImagePreview message={message} />;
  }

  if (mediaType === "VIDEO") {
    return <VideoPreview message={message} />;
  }

  if (mediaType === "AUDIO") {
    return <AudioPreview message={message} />;
  }

  if (mediaType === "DOCUMENT") {
    return <DocumentDownload message={message} />;
  }

  return null;
}
