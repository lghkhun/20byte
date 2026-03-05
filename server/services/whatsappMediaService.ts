import { buildChatMediaObjectKey } from "@/lib/storage/mediaObjectKey";
import { uploadToR2 } from "@/lib/storage/r2Client";

const IMAGE_AND_DOCUMENT_SIZE_LIMIT_BYTES = 10 * 1024 * 1024;
const VIDEO_SIZE_LIMIT_BYTES = 50 * 1024 * 1024;

type WhatsAppMediaInfo = {
  url: string;
  mimeType?: string;
  fileSize?: number;
};

type TransferWhatsAppMediaInput = {
  accessToken: string;
  orgId: string;
  conversationId: string;
  messageId: string;
  mediaId: string;
  mimeType?: string;
  fileName?: string;
};

type TransferWhatsAppMediaResult = {
  mediaUrl: string;
  mimeType: string | null;
  fileSize: number | null;
};

function normalize(value: string): string {
  return value.trim();
}

function parseJsonObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function parseNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return Math.floor(value);
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return Math.floor(parsed);
    }
  }

  return undefined;
}

function parseWhatsAppErrorMessage(body: unknown): string | null {
  const root = parseJsonObject(body);
  const error = root ? parseJsonObject(root.error) : null;
  const message = error?.message;
  return typeof message === "string" ? message : null;
}

function maxSizeByMimeType(mimeType: string | undefined): number {
  if (mimeType && mimeType.toLowerCase().startsWith("video/")) {
    return VIDEO_SIZE_LIMIT_BYTES;
  }

  return IMAGE_AND_DOCUMENT_SIZE_LIMIT_BYTES;
}

function assertAllowedFileSize(mimeType: string | undefined, fileSize: number | undefined): void {
  if (!fileSize || fileSize <= 0) {
    return;
  }

  const maxSize = maxSizeByMimeType(mimeType);
  if (fileSize > maxSize) {
    throw new Error(`Media file exceeds size limit for ${mimeType ?? "unknown"} (${fileSize} bytes).`);
  }
}

async function getWhatsAppMediaInfo(mediaId: string, accessToken: string): Promise<WhatsAppMediaInfo> {
  const response = await fetch(`https://graph.facebook.com/v20.0/${encodeURIComponent(mediaId)}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message = parseWhatsAppErrorMessage(body) ?? `Failed to get media metadata. HTTP ${response.status}.`;
    throw new Error(message);
  }

  const parsed = parseJsonObject(body);
  const url = typeof parsed?.url === "string" ? normalize(parsed.url) : "";
  if (!url) {
    throw new Error("WhatsApp media metadata does not contain a download URL.");
  }

  return {
    url,
    mimeType: typeof parsed?.mime_type === "string" ? normalize(parsed.mime_type) : undefined,
    fileSize: parseNumber(parsed?.file_size)
  };
}

async function downloadWhatsAppMedia(url: string, accessToken: string): Promise<{
  content: Buffer;
  mimeType?: string;
  fileSize?: number;
}> {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to download WhatsApp media. HTTP ${response.status}.`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const content = Buffer.from(arrayBuffer);
  const mimeType = response.headers.get("content-type") ?? undefined;
  const contentLength = response.headers.get("content-length");
  const fileSize = parseNumber(contentLength) ?? content.length;

  return {
    content,
    mimeType,
    fileSize
  };
}

export async function transferWhatsAppMediaToR2(input: TransferWhatsAppMediaInput): Promise<TransferWhatsAppMediaResult> {
  const mediaId = normalize(input.mediaId);
  const accessToken = normalize(input.accessToken);
  if (!mediaId || !accessToken) {
    throw new Error("Media ID and access token are required.");
  }

  const mediaInfo = await getWhatsAppMediaInfo(mediaId, accessToken);
  const preferredMimeType = mediaInfo.mimeType ?? input.mimeType;
  assertAllowedFileSize(preferredMimeType, mediaInfo.fileSize);

  const downloaded = await downloadWhatsAppMedia(mediaInfo.url, accessToken);
  const resolvedMimeType = downloaded.mimeType ?? preferredMimeType ?? null;
  assertAllowedFileSize(resolvedMimeType ?? undefined, downloaded.fileSize);

  const objectKey = buildChatMediaObjectKey({
    orgId: input.orgId,
    conversationId: input.conversationId,
    messageId: input.messageId,
    mimeType: resolvedMimeType ?? undefined,
    fileName: input.fileName
  });

  const mediaUrl = await uploadToR2({
    objectKey,
    body: downloaded.content,
    contentType: resolvedMimeType ?? undefined
  });

  return {
    mediaUrl,
    mimeType: resolvedMimeType,
    fileSize: downloaded.fileSize ?? mediaInfo.fileSize ?? null
  };
}

