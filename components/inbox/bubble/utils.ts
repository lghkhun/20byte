import type { MessageItem } from "@/components/inbox/types";

export function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

export function renderMediaLabel(message: MessageItem): string | null {
  if (message.type === "IMAGE") {
    return "Gambar";
  }

  if (message.type === "VIDEO") {
    return "Video";
  }

  if (message.type === "AUDIO") {
    return "Audio";
  }

  if (message.type === "DOCUMENT") {
    return message.fileName ? `Dokumen: ${message.fileName}` : "Dokumen";
  }

  return null;
}

export function normalizeRuntimeUrl(rawUrl: string): string {
  if (typeof window === "undefined") {
    return rawUrl;
  }

  try {
    const parsed = new URL(rawUrl);
    const isLegacyLocalhost =
      (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") && parsed.port === "3000";

    if (!isLegacyLocalhost) {
      return rawUrl;
    }

    return `${window.location.origin}${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return rawUrl;
  }
}
