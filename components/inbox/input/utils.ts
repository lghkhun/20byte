export const TEMPLATE_COST: Record<"MARKETING" | "UTILITY" | "AUTHENTICATION" | "SERVICE", string> = {
  MARKETING: "Rp 818",
  UTILITY: "Rp 498",
  AUTHENTICATION: "Rp 498",
  SERVICE: "Rp 0"
};

export function isAllowedAttachmentType(mimeType: string): boolean {
  return typeof mimeType === "string";
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
