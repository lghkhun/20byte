import { useState } from "react";
import Image from "next/image";
import { FileText, PlayCircle, X } from "lucide-react";

import type { MessageItem } from "@/components/inbox/types";
import { Button } from "@/components/ui/button";

function ImagePreview({ message }: { message: MessageItem }) {
  const [failed, setFailed] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  if (!message.mediaUrl || failed) {
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
          src={message.mediaUrl}
          alt={message.fileName ?? "Image attachment"}
          width={640}
          height={480}
          unoptimized
          className={`rounded-lg border border-border ${message.mimeType === "image/webp" ? "max-h-64 w-auto max-w-[220px] bg-transparent object-contain" : "max-h-64 w-full object-cover"}`}
          onError={() => setFailed(true)}
        />
      </button>
      {isOpen ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <button type="button" className="absolute right-4 top-4 rounded-full bg-black/40 p-2 text-white" onClick={() => setIsOpen(false)}>
            <X className="h-5 w-5" />
          </button>
          <Image src={message.mediaUrl} alt={message.fileName ?? "Image attachment"} width={1200} height={900} unoptimized className="max-h-[88vh] w-auto max-w-full rounded-2xl object-contain" />
        </div>
      ) : null}
    </>
  );
}

function VideoPreview({ message }: { message: MessageItem }) {
  const [failed, setFailed] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  if (!message.mediaUrl || failed) {
    return (
      <div className="mb-2 rounded-lg border border-border bg-background/40 px-3 py-2 text-xs text-muted-foreground">
        Video unavailable
      </div>
    );
  }

  return (
    <>
      <button type="button" className="mb-2 block w-full" onClick={() => setIsOpen(true)}>
        <video
          preload="metadata"
          className="max-h-72 w-full rounded-lg border border-border bg-black/50"
          onError={() => setFailed(true)}
        >
          <source src={message.mediaUrl} type={message.mimeType ?? undefined} />
        </video>
      </button>
      {isOpen ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <button type="button" className="absolute right-4 top-4 rounded-full bg-black/40 p-2 text-white" onClick={() => setIsOpen(false)}>
            <X className="h-5 w-5" />
          </button>
          <video controls autoPlay preload="metadata" className="max-h-[88vh] max-w-full rounded-2xl bg-black">
            <source src={message.mediaUrl} type={message.mimeType ?? undefined} />
            Your browser does not support video playback.
          </video>
        </div>
      ) : null}
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
      Your browser does not support audio playback.
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
            Download
          </a>
        </Button>
        <Button asChild variant="ghost" size="sm" className="h-8 rounded-lg border border-border/80 px-3 text-xs">
          <a href={message.mediaUrl} target="_blank" rel="noreferrer">
            Preview
          </a>
        </Button>
      </div>
    </div>
  );
}

function VideoPlaceholder({ message }: { message: MessageItem }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="group relative mb-2 block w-full overflow-hidden rounded-xl border border-border bg-background/60 text-left"
      >
      <div className="flex h-44 items-center justify-center bg-gradient-to-br from-muted/50 via-background/70 to-muted/30">
        <PlayCircle className="h-12 w-12 text-foreground/80 transition group-hover:scale-105" />
      </div>
      <div className="absolute right-2 top-2 rounded-md bg-black/55 px-1.5 py-0.5 text-[11px] font-medium text-white">VIDEO</div>
      </button>
      {isOpen && message.mediaUrl ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <button type="button" className="absolute right-4 top-4 rounded-full bg-black/40 p-2 text-white" onClick={() => setIsOpen(false)}>
            <X className="h-5 w-5" />
          </button>
          <video controls autoPlay preload="metadata" className="max-h-[88vh] max-w-full rounded-2xl bg-black">
            <source src={message.mediaUrl} type={message.mimeType ?? undefined} />
            Your browser does not support video playback.
          </video>
        </div>
      ) : null}
    </>
  );
}

export function MediaContent({ message }: { message: MessageItem }) {
  if (message.type === "IMAGE") {
    return <ImagePreview message={message} />;
  }

  if (message.type === "VIDEO") {
    if (!message.mediaUrl) {
      return <VideoPreview message={message} />;
    }

    return <VideoPlaceholder message={message} />;
  }

  if (message.type === "AUDIO") {
    return <AudioPreview message={message} />;
  }

  if (message.type === "DOCUMENT") {
    return <DocumentDownload message={message} />;
  }

  return null;
}
