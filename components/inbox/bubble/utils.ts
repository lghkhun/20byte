import type { MessageItem } from "@/components/inbox/types";

export function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

export function renderMediaLabel(message: MessageItem): string | null {
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
