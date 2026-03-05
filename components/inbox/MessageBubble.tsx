"use client";

import { useState } from "react";
import Image from "next/image";

import { MessageItem } from "@/components/inbox/types";

type MessageBubbleProps = {
  message: MessageItem;
};

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function renderMediaLabel(message: MessageItem): string | null {
  if (message.type === "IMAGE") {
    return "Image";
  }

  if (message.type === "VIDEO") {
    return "Video";
  }

  if (message.type === "AUDIO") {
    return "Audio";
  }

  if (message.type === "DOCUMENT") {
    return message.fileName ? `Document: ${message.fileName}` : "Document";
  }

  return null;
}

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
    <a
      href={message.mediaUrl}
      target="_blank"
      rel="noreferrer"
      download={message.fileName ?? undefined}
      className="mb-2 inline-flex rounded-md border border-border bg-background/60 px-3 py-2 text-xs font-medium text-foreground hover:bg-background"
    >
      Download {message.fileName ?? "document"}
    </a>
  );
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isOutbound = message.direction === "OUTBOUND";
  const mediaLabel = renderMediaLabel(message);

  return (
    <div className={isOutbound ? "flex justify-end" : "flex justify-start"}>
      <article
        className={
          isOutbound
            ? "max-w-[78%] rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2"
            : "max-w-[78%] rounded-2xl border border-border bg-background/70 px-3 py-2"
        }
      >
        {message.type === "SYSTEM" ? (
          <p className="mb-1 text-[11px] uppercase tracking-wide text-info">System</p>
        ) : null}

        {message.templateName ? (
          <p className="mb-1 text-xs text-muted-foreground">
            Template: {message.templateName}
            {message.templateCategory ? ` (${message.templateCategory})` : ""}
          </p>
        ) : null}

        {message.type === "IMAGE" ? <ImagePreview message={message} /> : null}
        {message.type === "VIDEO" ? <VideoPreview message={message} /> : null}
        {message.type === "AUDIO" ? <AudioPreview message={message} /> : null}
        {message.type === "DOCUMENT" ? <DocumentDownload message={message} /> : null}

        {mediaLabel &&
        message.type !== "IMAGE" &&
        message.type !== "VIDEO" &&
        message.type !== "AUDIO" &&
        message.type !== "DOCUMENT" ? (
          <p className="mb-1 text-xs text-muted-foreground">
            {mediaLabel}
            {message.mediaUrl ? ` - ${message.mediaUrl}` : ""}
          </p>
        ) : null}

        {message.text ? <p className="text-sm text-foreground whitespace-pre-wrap">{message.text}</p> : null}

        <p className="mt-1 text-[11px] text-muted-foreground">{formatTime(message.createdAt)}</p>
      </article>
    </div>
  );
}
