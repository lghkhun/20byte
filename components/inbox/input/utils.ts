export const TEMPLATE_COST: Record<"MARKETING" | "UTILITY" | "AUTHENTICATION" | "SERVICE", string> = {
  MARKETING: "Rp 818",
  UTILITY: "Rp 498",
  AUTHENTICATION: "Rp 498",
  SERVICE: "Rp 0"
};

const ALLOWED_MIME_PREFIXES = ["image/", "video/"];
const ALLOWED_EXACT_MIME_TYPES = ["application/pdf"];

export function isAllowedAttachmentType(mimeType: string): boolean {
  if (ALLOWED_EXACT_MIME_TYPES.includes(mimeType)) {
    return true;
  }

  return ALLOWED_MIME_PREFIXES.some((prefix) => mimeType.startsWith(prefix));
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
