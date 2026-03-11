import { useState } from "react";
import Image from "next/image";
import { FileText, PlayCircle } from "lucide-react";

import type { MessageItem } from "@/components/inbox/types";
import { Button } from "@/components/ui/button";

function ImagePreview({ message }: { message: MessageItem }) {
  const [failed, setFailed] = useState(false);
  if (!message.mediaUrl || failed) {
    return (
      <div className="mb-2 rounded-lg border border-border bg-background/40 px-3 py-2 text-xs text-muted-foreground">
        Image unavailable
      </div>
    );
  }

  return (
    <Image
      src={message.mediaUrl}
      alt={message.fileName ?? "Image attachment"}
      width={640}
      height={480}
      unoptimized
      className="mb-2 max-h-64 w-full rounded-lg border border-border object-cover"
      onError={() => setFailed(true)}
    />
  );
}

function VideoPreview({ message }: { message: MessageItem }) {
  const [failed, setFailed] = useState(false);
  if (!message.mediaUrl || failed) {
    return (
      <div className="mb-2 rounded-lg border border-border bg-background/40 px-3 py-2 text-xs text-muted-foreground">
        Video unavailable
      </div>
    );
  }

  return (
    <video
      controls
      preload="metadata"
      className="mb-2 max-h-72 w-full rounded-lg border border-border bg-black/50"
      onError={() => setFailed(true)}
    >
      <source src={message.mediaUrl} type={message.mimeType ?? undefined} />
      Your browser does not support video playback.
    </video>
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
  return (
    <a
      href={message.mediaUrl ?? "#"}
      target="_blank"
      rel="noreferrer"
      className="group relative mb-2 block overflow-hidden rounded-xl border border-border bg-background/60"
    >
      <div className="flex h-44 items-center justify-center bg-gradient-to-br from-muted/50 via-background/70 to-muted/30">
        <PlayCircle className="h-12 w-12 text-foreground/80 transition group-hover:scale-105" />
      </div>
      <div className="absolute right-2 top-2 rounded-md bg-black/55 px-1.5 py-0.5 text-[11px] font-medium text-white">VIDEO</div>
    </a>
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
