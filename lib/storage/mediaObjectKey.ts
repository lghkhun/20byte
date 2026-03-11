const MIME_EXTENSION_MAP: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/3gpp": "3gp",
  "audio/ogg": "ogg",
  "audio/mpeg": "mp3",
  "audio/aac": "aac",
  "audio/mp4": "m4a",
  "application/pdf": "pdf"
};

function normalizePathPart(value: string): string {
  return value.trim();
}

function extensionFromFileName(fileName: string | undefined): string | null {
  if (!fileName) {
    return null;
  }

  const normalized = fileName.trim();
  const index = normalized.lastIndexOf(".");
  if (index < 0 || index === normalized.length - 1) {
    return null;
  }

  return normalized.slice(index + 1).toLowerCase();
}

function extensionFromMimeType(mimeType: string | undefined): string | null {
  if (!mimeType) {
    return null;
  }

  const normalized = mimeType.trim().toLowerCase();
  const mapped = MIME_EXTENSION_MAP[normalized];
  if (mapped) {
    return mapped;
  }

  const slashIndex = normalized.indexOf("/");
  if (slashIndex < 0 || slashIndex === normalized.length - 1) {
    return null;
  }

  return normalized.slice(slashIndex + 1).replace(/[^a-z0-9]/g, "").slice(0, 10) || null;
}

function resolveExtension(mimeType: string | undefined, fileName: string | undefined): string {
  const fromMimeType = extensionFromMimeType(mimeType);
  if (fromMimeType) {
    return fromMimeType;
  }

  const fromFileName = extensionFromFileName(fileName);
  if (fromFileName) {
    return fromFileName;
  }

  return "bin";
}

type BuildChatMediaObjectKeyInput = {
  orgId: string;
  conversationId: string;
  messageId: string;
  mimeType?: string;
  fileName?: string;
};

export function buildChatMediaObjectKey(input: BuildChatMediaObjectKeyInput): string {
  const orgId = normalizePathPart(input.orgId);
  const conversationId = normalizePathPart(input.conversationId);
  const messageId = normalizePathPart(input.messageId);

  if (!orgId || !conversationId || !messageId) {
    throw new Error("Missing required identifiers for media object key.");
  }

  const extension = resolveExtension(input.mimeType, input.fileName);
  return `media/${orgId}/${conversationId}/${messageId}.${extension}`;
}

type BuildInvoicePdfObjectKeyInput = {
  orgId: string;
  invoiceId: string;
};

export function buildInvoicePdfObjectKey(input: BuildInvoicePdfObjectKeyInput): string {
  const orgId = normalizePathPart(input.orgId);
  const invoiceId = normalizePathPart(input.invoiceId);
  if (!orgId || !invoiceId) {
    throw new Error("Missing required identifiers for invoice PDF object key.");
  }

  return `invoice/${orgId}/${invoiceId}.pdf`;
}
