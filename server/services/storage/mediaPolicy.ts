import { ServiceError } from "@/server/services/serviceError";

export const IMAGE_AND_DOCUMENT_SIZE_LIMIT_BYTES = 10 * 1024 * 1024;
export const VIDEO_SIZE_LIMIT_BYTES = 50 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set<string>([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "video/mp4",
  "video/3gpp",
  "audio/ogg",
  "audio/mpeg",
  "audio/aac",
  "audio/mp4"
]);

export function normalizeMimeType(mimeType: string | undefined): string | null {
  const normalized = (mimeType ?? "").trim().toLowerCase();
  return normalized || null;
}

export function isAllowedInboundMimeType(mimeType: string | undefined): boolean {
  const normalized = normalizeMimeType(mimeType);
  if (!normalized) {
    return false;
  }

  return ALLOWED_MIME_TYPES.has(normalized);
}

export function assertAllowedInboundMimeType(mimeType: string | undefined): void {
  if (!isAllowedInboundMimeType(mimeType)) {
    throw new ServiceError(
      400,
      "UNSUPPORTED_MEDIA_TYPE",
      `Unsupported media type: ${mimeType ?? "unknown"}. Allowed: ${Array.from(ALLOWED_MIME_TYPES).join(", ")}.`
    );
  }
}

export function maxAllowedSizeByMimeType(mimeType: string | undefined): number {
  const normalized = normalizeMimeType(mimeType);
  if (normalized === "video/mp4" || normalized === "video/3gpp") {
    return VIDEO_SIZE_LIMIT_BYTES;
  }

  return IMAGE_AND_DOCUMENT_SIZE_LIMIT_BYTES;
}

export function assertAllowedInboundFileSize(mimeType: string | undefined, fileSize: number | undefined): void {
  if (!fileSize || fileSize <= 0) {
    return;
  }

  const maxSize = maxAllowedSizeByMimeType(mimeType);
  if (fileSize > maxSize) {
    throw new ServiceError(
      400,
      "MEDIA_FILE_TOO_LARGE",
      `Media file exceeds size limit for ${mimeType ?? "unknown"} (${fileSize} bytes).`
    );
  }
}
