export const TEMPLATE_COST: Record<"MARKETING" | "UTILITY" | "AUTHENTICATION" | "SERVICE", string> = {
  MARKETING: "Rp 818",
  UTILITY: "Rp 498",
  AUTHENTICATION: "Rp 498",
  SERVICE: "Rp 0"
};

const ALLOWED_ATTACHMENT_MIME_PREFIXES = ["image/", "video/", "audio/"] as const;
const ALLOWED_ATTACHMENT_EXACT_MIME = new Set(["application/pdf"]);

export function isAllowedAttachmentType(mimeType: string): boolean {
  if (typeof mimeType !== "string") {
    return false;
  }

  const normalized = mimeType.trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  if (ALLOWED_ATTACHMENT_EXACT_MIME.has(normalized)) {
    return true;
  }

  return ALLOWED_ATTACHMENT_MIME_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 1) {
    return "0 B";
  }

  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
