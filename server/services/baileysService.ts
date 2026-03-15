import { mkdir, readdir, readFile, rm, stat, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

import makeWASocket, {
  Browsers,
  DisconnectReason,
  bindWaitForConnectionUpdate,
  downloadMediaMessage,
  fetchLatestWaWebVersion,
  isJidGroup,
  isJidStatusBroadcast,
  jidNormalizedUser,
  useMultiFileAuthState,
  type WAVersion,
  type WASocket,
  type WAMessage
} from "baileys";

import { prisma } from "@/lib/db/prisma";
import { canAccessOrganizationSettings } from "@/lib/permissions/orgPermissions";
import { normalizePossibleE164 } from "@/lib/whatsapp/e164";
import { storeInboundMessage } from "@/server/services/message/inbound";
import { ServiceError } from "@/server/services/serviceError";
import { writeAuditLogSafe } from "@/server/services/auditLogService";

type BaileysConnectionStatus = "DISCONNECTED" | "CONNECTING" | "PAIRING" | "CONNECTED" | "ERROR";

type ConnectedAccountSummary = {
  id: string;
  displayPhone: string;
  phoneNumberId: string;
  connectedAt: Date;
};

type PairingCodeResult = {
  orgId: string;
  connectionStatus: BaileysConnectionStatus;
  pairingCode: string;
  expiresInSeconds: number;
};

type ConnectionContext = {
  orgId: string;
  provider: "BAILEYS";
  connectionStatus: BaileysConnectionStatus;
  lastError: string | null;
  qrCode: string | null;
  qrCodeExpiresAt: Date | null;
  pairingCode: string | null;
  pairingCodeExpiresAt: Date | null;
  connectedAccount: ConnectedAccountSummary | null;
};

type BaileysAccountReport = {
  connectedAccount: ConnectedAccountSummary | null;
  metrics: {
    incomingToday: number;
    outgoingToday: number;
    failedToday: number;
    broadcastMonth: number;
  };
  agentActivity: Array<{
    memberId: string;
    agentName: string;
    role: string;
    messagesSent: number;
    performance: string;
  }>;
  technical: {
    sessionId: string;
    connectedSince: string | null;
    uptimeLabel: string;
    status: BaileysConnectionStatus;
    lastError: string | null;
  };
};

type SessionEntry = {
  orgId: string;
  socket: WASocket | null;
  status: BaileysConnectionStatus;
  lastError: string | null;
  qrCode: string | null;
  qrCodeExpiresAt: Date | null;
  pairingCode: string | null;
  pairingCodeExpiresAt: Date | null;
  initPromise: Promise<WASocket> | null;
  allowReconnect: boolean;
};

const BAILEYS_PAIRING_TTL_MS = 3 * 60 * 1000;
const BAILEYS_QR_TTL_MS = 60 * 1000;
const BAILEYS_QR_GENERATION_TIMEOUT_MS = 30 * 1000;
const BAILEYS_VERSION_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const BAILEYS_RUNTIME_DIR = path.join(process.cwd(), ".runtime");
const BAILEYS_AUTH_DIR = path.join(BAILEYS_RUNTIME_DIR, "baileys-auth");
const BAILEYS_MEDIA_DIR = path.join(BAILEYS_RUNTIME_DIR, "baileys-media");

declare global {
  var __twentyByteBaileysSessions: Map<string, SessionEntry> | undefined;
  var __twentyByteBaileysVersionCache:
    | {
        version: WAVersion;
        expiresAt: number;
      }
    | undefined;
}

function getSessionsStore(): Map<string, SessionEntry> {
  if (!globalThis.__twentyByteBaileysSessions) {
    globalThis.__twentyByteBaileysSessions = new Map();
  }

  return globalThis.__twentyByteBaileysSessions;
}

function normalize(value: string | undefined): string {
  return (value ?? "").trim();
}

function getSessionEntry(orgId: string): SessionEntry {
  const sessions = getSessionsStore();
  const existing = sessions.get(orgId);
  if (existing) {
    return existing;
  }

  const created: SessionEntry = {
    orgId,
    socket: null,
    status: "DISCONNECTED",
    lastError: null,
    qrCode: null,
    qrCodeExpiresAt: null,
    pairingCode: null,
    pairingCodeExpiresAt: null,
    initPromise: null,
    allowReconnect: true
  };
  sessions.set(orgId, created);
  return created;
}

function getAuthFolder(orgId: string): string {
  return path.join(BAILEYS_AUTH_DIR, orgId);
}

function getMediaFolder(orgId: string): string {
  return path.join(BAILEYS_MEDIA_DIR, orgId);
}

function isSocketOpen(socket: WASocket | null): boolean {
  return Boolean(socket?.ws?.isOpen);
}

function isSocketConnecting(socket: WASocket | null): boolean {
  return Boolean(socket?.ws?.isConnecting);
}

async function getPreferredBaileysVersion(): Promise<WAVersion | undefined> {
  const cache = globalThis.__twentyByteBaileysVersionCache;
  if (cache && cache.expiresAt > Date.now()) {
    return cache.version;
  }

  try {
    const latest = await fetchLatestWaWebVersion();
    globalThis.__twentyByteBaileysVersionCache = {
      version: latest.version,
      expiresAt: Date.now() + BAILEYS_VERSION_CACHE_TTL_MS
    };
    return latest.version;
  } catch {
    return cache?.version;
  }
}

async function ensureDirectory(dirPath: string): Promise<void> {
  await mkdir(dirPath, { recursive: true });
}

async function requireSettingsAccess(userId: string, orgId: string): Promise<void> {
  const membership = await prisma.orgMember.findUnique({
    where: {
      orgId_userId: {
        orgId,
        userId
      }
    },
    select: {
      role: true
    }
  });

  if (!membership) {
    throw new ServiceError(403, "ORG_ACCESS_DENIED", "You do not have access to this organization.");
  }

  if (!canAccessOrganizationSettings(membership.role)) {
    throw new ServiceError(403, "FORBIDDEN_SETTINGS_ACCESS", "Your role cannot manage WhatsApp settings.");
  }
}

async function getConnectedAccount(orgId: string): Promise<ConnectedAccountSummary | null> {
  return prisma.waAccount.findFirst({
    where: {
      orgId,
      metaBusinessId: "baileys",
      wabaId: "baileys"
    },
    orderBy: { connectedAt: "desc" },
    select: {
      id: true,
      displayPhone: true,
      phoneNumberId: true,
      connectedAt: true
    }
  });
}

function extractDigits(raw: string | undefined): string {
  return normalize(raw).replace(/\D/g, "");
}

function formatDisplayPhone(digits: string): string {
  return digits ? `+${digits}` : "Connected via Baileys";
}

function unwrapMessageContent(message: WAMessage["message"]): WAMessage["message"] {
  if (!message) {
    return message;
  }

  if ("ephemeralMessage" in message && message.ephemeralMessage?.message) {
    return unwrapMessageContent(message.ephemeralMessage.message);
  }

  if ("viewOnceMessage" in message && message.viewOnceMessage?.message) {
    return unwrapMessageContent(message.viewOnceMessage.message);
  }

  if ("viewOnceMessageV2" in message && message.viewOnceMessageV2?.message) {
    return unwrapMessageContent(message.viewOnceMessageV2.message);
  }

  if ("documentWithCaptionMessage" in message && message.documentWithCaptionMessage?.message) {
    return unwrapMessageContent(message.documentWithCaptionMessage.message);
  }

  return message;
}

function resolveMessageKind(content: WAMessage["message"]): {
  type: "TEXT" | "IMAGE" | "VIDEO" | "AUDIO" | "DOCUMENT" | null;
  text?: string;
  mimeType?: string;
  fileName?: string;
  fileLength?: number;
  durationSec?: number;
} {
  const normalized = unwrapMessageContent(content);
  if (!normalized) {
    return { type: null };
  }

  if (typeof normalized.conversation === "string" && normalized.conversation.trim()) {
    return { type: "TEXT", text: normalized.conversation.trim() };
  }

  if (normalized.extendedTextMessage?.text?.trim()) {
    return { type: "TEXT", text: normalized.extendedTextMessage.text.trim() };
  }

  if (normalized.imageMessage) {
    return {
      type: "IMAGE",
      text: normalize(normalized.imageMessage.caption ?? undefined),
      mimeType: normalize(normalized.imageMessage.mimetype ?? "image/jpeg"),
      fileName: "image",
      fileLength: Number(normalized.imageMessage.fileLength ?? 0) || undefined
    };
  }

  if (normalized.videoMessage) {
    return {
      type: "VIDEO",
      text: normalize(normalized.videoMessage.caption ?? undefined),
      mimeType: normalize(normalized.videoMessage.mimetype ?? "video/mp4"),
      fileName: "video",
      fileLength: Number(normalized.videoMessage.fileLength ?? 0) || undefined,
      durationSec: Number(normalized.videoMessage.seconds ?? 0) || undefined
    };
  }

  if (normalized.audioMessage) {
    return {
      type: "AUDIO",
      mimeType: normalize(normalized.audioMessage.mimetype ?? "audio/ogg"),
      fileName: "audio",
      fileLength: Number(normalized.audioMessage.fileLength ?? 0) || undefined,
      durationSec: Number(normalized.audioMessage.seconds ?? 0) || undefined
    };
  }

  if (normalized.documentMessage) {
    return {
      type: "DOCUMENT",
      text: normalize(normalized.documentMessage.caption ?? undefined),
      mimeType: normalize(normalized.documentMessage.mimetype ?? "application/octet-stream"),
      fileName: normalize(normalized.documentMessage.fileName ?? "document"),
      fileLength: Number(normalized.documentMessage.fileLength ?? 0) || undefined
    };
  }

  if (normalized.stickerMessage) {
    return {
      type: "IMAGE",
      mimeType: normalize(normalized.stickerMessage.mimetype ?? "image/webp"),
      fileName: "sticker",
      fileLength: Number(normalized.stickerMessage.fileLength ?? 0) || undefined
    };
  }

  return { type: null };
}

function toMediaExtension(mimeType: string | undefined, fallback: string): string {
  const normalized = normalize(mimeType).toLowerCase();
  if (normalized.includes("jpeg")) return "jpg";
  if (normalized.includes("png")) return "png";
  if (normalized.includes("webp")) return "webp";
  if (normalized.includes("mp4")) return "mp4";
  if (normalized.includes("mpeg")) return "mp3";
  if (normalized.includes("ogg")) return "ogg";
  if (normalized.includes("pdf")) return "pdf";
  return fallback;
}

function startOfLocalDay(date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfLocalMonth(date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function formatUptimeLabel(connectedAt: Date | null, status: BaileysConnectionStatus): string {
  if (!connectedAt || status !== "CONNECTED") {
    return "Not connected";
  }

  const diffMs = Math.max(0, Date.now() - connectedAt.getTime());
  const totalMinutes = Math.floor(diffMs / 60_000);
  const days = Math.floor(totalMinutes / 1_440);
  const hours = Math.floor((totalMinutes % 1_440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return `${days}d ${hours}h`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${Math.max(1, minutes)}m`;
}

function toPerformanceLabel(messagesSent: number): string {
  if (messagesSent >= 100) return "High";
  if (messagesSent >= 25) return "Active";
  if (messagesSent > 0) return "Light";
  return "Idle";
}

async function downloadInboundMedia(orgId: string, message: WAMessage, mimeType?: string): Promise<{
  mediaPath: string;
  mediaUrl: string;
}> {
  const mediaFolder = getMediaFolder(orgId);
  await ensureDirectory(mediaFolder);

  const extension = toMediaExtension(mimeType, "bin");
  const fileName = `${Date.now()}-${randomUUID()}.${extension}`;
  const diskPath = path.join(mediaFolder, fileName);
  const mediaBuffer = await downloadMediaMessage(message, "buffer", {});
  await writeFile(diskPath, mediaBuffer);

  return {
    mediaPath: fileName,
    mediaUrl: `/api/media/${encodeURIComponent(orgId)}/${encodeURIComponent(fileName)}`
  };
}

export async function storeBaileysMediaBuffer(input: {
  orgId: string;
  fileName: string;
  mimeType?: string;
  buffer: Buffer;
}): Promise<{
  mediaPath: string;
  mediaUrl: string;
}> {
  const mediaFolder = getMediaFolder(input.orgId);
  await ensureDirectory(mediaFolder);

  const rawExtension = path.extname(input.fileName).toLowerCase().replace(".", "");
  const extension = rawExtension || toMediaExtension(input.mimeType, "bin");
  const safeBaseName = path.basename(input.fileName, path.extname(input.fileName)).replace(/[^a-zA-Z0-9_-]/g, "-") || "upload";
  const fileName = `${Date.now()}-${safeBaseName}-${randomUUID()}.${extension}`;
  const diskPath = path.join(mediaFolder, fileName);

  await writeFile(diskPath, input.buffer);

  return {
    mediaPath: fileName,
    mediaUrl: `/api/media/${encodeURIComponent(input.orgId)}/${encodeURIComponent(fileName)}`
  };
}

async function persistConnectedAccount(orgId: string, socket: WASocket): Promise<void> {
  const normalizedJid = jidNormalizedUser(socket.user?.id ?? undefined);
  const phoneDigits = extractDigits(normalizedJid.split("@")[0]);
  const displayPhone = formatDisplayPhone(phoneDigits);
  const placeholderValue = "baileys-session";

  await prisma.waAccount.upsert({
    where: {
      orgId
    },
    create: {
      orgId,
      metaBusinessId: "baileys",
      wabaId: "baileys",
      phoneNumberId: phoneDigits || `baileys-${orgId}`,
      displayPhone,
      accessTokenEnc: placeholderValue,
      connectedAt: new Date()
    },
    update: {
      metaBusinessId: "baileys",
      wabaId: "baileys",
      phoneNumberId: phoneDigits || `baileys-${orgId}`,
      displayPhone,
      accessTokenEnc: placeholderValue,
      connectedAt: new Date()
    }
  });
}

async function clearConnectedAccount(orgId: string): Promise<void> {
  await prisma.waAccount.deleteMany({
    where: {
      orgId
    }
  });
}

async function clearRuntimeFiles(orgId: string): Promise<void> {
  await Promise.all([
    rm(getAuthFolder(orgId), { recursive: true, force: true }),
    rm(getMediaFolder(orgId), { recursive: true, force: true })
  ]);
}

async function resetBaileysLinkState(orgId: string): Promise<void> {
  const entry = getSessionEntry(orgId);
  entry.allowReconnect = false;
  if (entry.socket) {
    try {
      entry.socket.end(undefined);
    } catch {
      // ignore
    }
  }

  entry.socket = null;
  entry.status = "DISCONNECTED";
  entry.lastError = null;
  entry.qrCode = null;
  entry.qrCodeExpiresAt = null;
  entry.pairingCode = null;
  entry.pairingCodeExpiresAt = null;
  entry.initPromise = null;
  entry.allowReconnect = true;

  await clearRuntimeFiles(orgId);
}

async function processInboundMessage(orgId: string, message: WAMessage, socket: WASocket): Promise<void> {
  const remoteJid = jidNormalizedUser(message.key.remoteJid ?? undefined);
  if (!remoteJid || isJidGroup(remoteJid) || isJidStatusBroadcast(remoteJid)) {
    return;
  }

  if (message.key.fromMe) {
    return;
  }

  const phoneDigits = extractDigits(remoteJid.split("@")[0]);
  const customerPhoneE164 = normalizePossibleE164(phoneDigits);
  if (!customerPhoneE164) {
    return;
  }

  let customerAvatarUrl: string | undefined;
  try {
    customerAvatarUrl = normalize(await socket.profilePictureUrl(remoteJid, "image"));
  } catch {
    customerAvatarUrl = undefined;
  }

  const kind = resolveMessageKind(message.message);
  if (!kind.type) {
    return;
  }

  let mediaPath: string | undefined;
  let mediaUrl: string | undefined;
  if (kind.type !== "TEXT") {
    try {
      const downloaded = await downloadInboundMedia(orgId, message, kind.mimeType);
      mediaPath = downloaded.mediaPath;
      mediaUrl = downloaded.mediaUrl;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown download error";
      console.error(`[baileys] failed to download media for org ${orgId}: ${errorMessage}`);
    }
  }

  await storeInboundMessage({
    orgId,
    customerPhoneE164,
    customerDisplayName: normalize(message.pushName ?? undefined),
    customerAvatarUrl,
    waMessageId: normalize(message.key.id ?? undefined),
    type: kind.type,
    text: kind.text,
    mediaId: mediaPath,
    mediaUrl,
    mimeType: kind.mimeType,
    fileName: kind.fileName,
    fileSize: kind.fileLength,
    durationSec: kind.durationSec
  });
}

async function createSocketForOrg(orgId: string, entry: SessionEntry): Promise<WASocket> {
  await ensureDirectory(getAuthFolder(orgId));
  await ensureDirectory(getMediaFolder(orgId));

  const { state, saveCreds } = await useMultiFileAuthState(getAuthFolder(orgId));
  const version = await getPreferredBaileysVersion();
  const socket = makeWASocket({
    auth: state,
    browser: Browsers.macOS("20byte"),
    markOnlineOnConnect: false,
    printQRInTerminal: false,
    syncFullHistory: false,
    version,
    getMessage: async () => undefined
  });

  entry.socket = socket;
  entry.status = state.creds.registered ? "CONNECTING" : "PAIRING";
  entry.lastError = null;
  entry.allowReconnect = true;

  socket.ev.on("creds.update", () => {
    void saveCreds();
  });

  socket.ev.on("connection.update", (update) => {
    if (entry.socket !== socket) {
      return;
    }

    const connection = update.connection;
    if (update.qr) {
      entry.status = "PAIRING";
      entry.qrCode = update.qr;
      entry.qrCodeExpiresAt = new Date(Date.now() + BAILEYS_QR_TTL_MS);
      entry.pairingCode = null;
      entry.pairingCodeExpiresAt = null;
    }

    if (connection === "connecting") {
      entry.status = state.creds.registered ? "CONNECTING" : "PAIRING";
      return;
    }

    if (connection === "open") {
      entry.status = "CONNECTED";
      entry.lastError = null;
      entry.qrCode = null;
      entry.qrCodeExpiresAt = null;
      entry.pairingCode = null;
      entry.pairingCodeExpiresAt = null;
      void persistConnectedAccount(orgId, socket);
      return;
    }

    if (connection === "close") {
      const statusCode = (update.lastDisconnect?.error as { output?: { statusCode?: number } } | undefined)?.output?.statusCode;
      entry.socket = null;

      if (statusCode === DisconnectReason.loggedOut) {
        entry.allowReconnect = false;
        entry.status = "DISCONNECTED";
        entry.lastError = "WhatsApp session logged out.";
        entry.qrCode = null;
        entry.qrCodeExpiresAt = null;
        entry.pairingCode = null;
        entry.pairingCodeExpiresAt = null;
        void clearConnectedAccount(orgId);
        void clearRuntimeFiles(orgId);
        return;
      }

      if (statusCode === DisconnectReason.restartRequired) {
        entry.status = state.creds.registered ? "CONNECTING" : "PAIRING";
        entry.lastError = null;
        entry.qrCode = null;
        entry.qrCodeExpiresAt = null;
        entry.pairingCode = null;
        entry.pairingCodeExpiresAt = null;

        setTimeout(() => {
          void ensureBaileysSocket(orgId, true).catch(() => {
            const latestEntry = getSessionEntry(orgId);
            latestEntry.status = "DISCONNECTED";
            latestEntry.lastError = "Failed to restart WhatsApp session.";
          });
        }, 250);
        return;
      }

      entry.status = "DISCONNECTED";
      entry.lastError = statusCode ? `Connection closed (${statusCode}).` : "Connection closed.";
    }
  });

  socket.ev.on("messages.upsert", async (event) => {
    for (const message of event.messages ?? []) {
      await processInboundMessage(orgId, message, socket);
    }
  });

  return socket;
}

async function ensureBaileysSocket(orgId: string, forceRestart = false): Promise<WASocket> {
  const normalizedOrgId = normalize(orgId);
  if (!normalizedOrgId) {
    throw new ServiceError(400, "MISSING_ORG_ID", "orgId is required.");
  }

  const entry = getSessionEntry(normalizedOrgId);
  if (forceRestart && entry.socket) {
    entry.allowReconnect = false;
    try {
      entry.socket.end(undefined);
    } catch {
      // ignore
    }
    entry.socket = null;
    entry.allowReconnect = true;
  }

  if (entry.socket && !forceRestart) {
    if (isSocketOpen(entry.socket) || isSocketConnecting(entry.socket) || entry.status === "PAIRING") {
      return entry.socket;
    }

    entry.socket = null;
  }

  if (entry.initPromise) {
    return entry.initPromise;
  }

  entry.initPromise = createSocketForOrg(normalizedOrgId, entry)
    .catch((error) => {
      entry.status = "ERROR";
      entry.lastError = error instanceof Error ? error.message : "Failed to initialize Baileys socket.";
      throw error;
    })
    .finally(() => {
      entry.initPromise = null;
    });

  return entry.initPromise;
}

export async function getBaileysConnectionContext(
  actorUserId: string,
  orgId: string,
  options?: { refresh?: boolean }
): Promise<ConnectionContext> {
  const normalizedOrgId = normalize(orgId);
  if (!normalizedOrgId) {
    throw new ServiceError(400, "MISSING_ORG_ID", "orgId is required.");
  }

  await requireSettingsAccess(actorUserId, normalizedOrgId);
  const connectedAccount = await getConnectedAccount(normalizedOrgId);
  if (options?.refresh && connectedAccount) {
    try {
      await ensureConnectedSocketForOrg(normalizedOrgId);
    } catch {
      // surface latest state via entry.lastError
    }
  }

  const entry = getSessionEntry(normalizedOrgId);
  return {
    orgId: normalizedOrgId,
    provider: "BAILEYS",
    connectionStatus: entry.status,
    lastError: entry.lastError,
    qrCode: entry.qrCode,
    qrCodeExpiresAt: entry.qrCodeExpiresAt,
    pairingCode: entry.pairingCode,
    pairingCodeExpiresAt: entry.pairingCodeExpiresAt,
    connectedAccount
  };
}

export async function startBaileysQrSession(input: {
  actorUserId: string;
  orgId: string;
}): Promise<{
  orgId: string;
  connectionStatus: BaileysConnectionStatus;
  qrCode: string;
  expiresInSeconds: number;
}> {
  const orgId = normalize(input.orgId);
  if (!orgId) {
    throw new ServiceError(400, "MISSING_ORG_ID", "orgId is required.");
  }

  await requireSettingsAccess(input.actorUserId, orgId);
  const connectedAccount = await getConnectedAccount(orgId);
  if (connectedAccount) {
    const entry = getSessionEntry(orgId);
    if (entry.status === "CONNECTED") {
      return {
        orgId,
        connectionStatus: entry.status,
        qrCode: "ALREADY_CONNECTED",
        expiresInSeconds: 0
      };
    }
  }

  await resetBaileysLinkState(orgId);
  await ensureBaileysSocket(orgId, true);
  const entry = getSessionEntry(orgId);

  const deadline = Date.now() + BAILEYS_QR_GENERATION_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (entry.qrCode) {
      return {
        orgId,
        connectionStatus: entry.status,
        qrCode: entry.qrCode,
        expiresInSeconds: Math.max(
          1,
          Math.floor(((entry.qrCodeExpiresAt?.getTime() ?? Date.now() + BAILEYS_QR_TTL_MS) - Date.now()) / 1000)
        )
      };
    }

    if (entry.status === "ERROR" && entry.lastError) {
      throw new ServiceError(500, "BAILEYS_QR_FAILED", entry.lastError);
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new ServiceError(
    504,
    "BAILEYS_QR_TIMEOUT",
    entry.lastError ? `QR code was not generated in time. ${entry.lastError}` : "QR code was not generated in time. Please retry."
  );
}

export async function startBaileysPairing(input: {
  actorUserId: string;
  orgId: string;
  phoneNumber: string;
}): Promise<PairingCodeResult> {
  const orgId = normalize(input.orgId);
  const phoneNumber = extractDigits(input.phoneNumber);
  if (!orgId) {
    throw new ServiceError(400, "MISSING_ORG_ID", "orgId is required.");
  }

  if (!phoneNumber) {
    throw new ServiceError(400, "INVALID_PHONE_NUMBER", "Phone number is required to generate a pairing code.");
  }

  await requireSettingsAccess(input.actorUserId, orgId);
  const connectedAccount = await getConnectedAccount(orgId);
  if (connectedAccount) {
    const existingEntry = getSessionEntry(orgId);
    if (existingEntry.status === "CONNECTED") {
      return {
        orgId,
        connectionStatus: existingEntry.status,
        pairingCode: "ALREADY_CONNECTED",
        expiresInSeconds: 0
      };
    }
  }

  await resetBaileysLinkState(orgId);
  const socket = await ensureBaileysSocket(orgId, true);
  const entry = getSessionEntry(orgId);

  const waitForConnectionUpdate = bindWaitForConnectionUpdate(socket.ev);
  await waitForConnectionUpdate(
    async (update) => update.connection === "connecting" || typeof update.qr === "string",
    15_000
  ).catch((error) => {
    const message = error instanceof Error ? error.message : "Baileys socket did not become ready for pairing.";
    throw new ServiceError(504, "BAILEYS_PAIRING_PREP_TIMEOUT", message);
  });

  const pairingCode = await socket.requestPairingCode(phoneNumber);
  entry.status = "PAIRING";
  entry.qrCode = null;
  entry.qrCodeExpiresAt = null;
  entry.pairingCode = pairingCode;
  entry.pairingCodeExpiresAt = new Date(Date.now() + BAILEYS_PAIRING_TTL_MS);
  entry.lastError = null;

  return {
    orgId,
    connectionStatus: entry.status,
    pairingCode,
    expiresInSeconds: BAILEYS_PAIRING_TTL_MS / 1000
  };
}

export async function disconnectBaileysSession(input: {
  actorUserId: string;
  orgId: string;
}): Promise<void> {
  const orgId = normalize(input.orgId);
  if (!orgId) {
    throw new ServiceError(400, "MISSING_ORG_ID", "orgId is required.");
  }

  await requireSettingsAccess(input.actorUserId, orgId);
  const entry = getSessionEntry(orgId);
  entry.allowReconnect = false;
  if (entry.socket) {
    try {
      entry.socket.end(undefined);
    } catch {
      // ignore
    }
  }

  entry.socket = null;
  entry.status = "DISCONNECTED";
  entry.lastError = null;
  entry.qrCode = null;
  entry.qrCodeExpiresAt = null;
  entry.pairingCode = null;
  entry.pairingCodeExpiresAt = null;
  entry.initPromise = null;

  await clearConnectedAccount(orgId);
  await clearRuntimeFiles(orgId);
}

async function waitForSocketOpen(socket: WASocket, timeoutMs: number): Promise<void> {
  if (isSocketOpen(socket)) {
    return;
  }

  const waitForConnectionUpdate = bindWaitForConnectionUpdate(socket.ev);
  await waitForConnectionUpdate(async (update) => update.connection === "open", timeoutMs);
}

async function ensureConnectedSocketForOrg(
  orgId: string,
  options?: { forceRestart?: boolean }
): Promise<WASocket> {
  let socket = await ensureBaileysSocket(orgId, options?.forceRestart ?? false);
  let entry = getSessionEntry(orgId);

  if (isSocketOpen(socket)) {
    entry.status = "CONNECTED";
    entry.lastError = null;
    return socket;
  }

  try {
    await waitForSocketOpen(socket, 15_000);
    entry = getSessionEntry(orgId);
    if (isSocketOpen(entry.socket)) {
      entry.status = "CONNECTED";
      entry.lastError = null;
      return entry.socket as WASocket;
    }
  } catch {
    // fall through to hard reconnect
  }

  socket = await ensureBaileysSocket(orgId, true);
  entry = getSessionEntry(orgId);

  try {
    await waitForSocketOpen(socket, 15_000);
  } catch {
    const detail = entry.lastError ? ` ${entry.lastError}` : "";
    throw new ServiceError(400, "WHATSAPP_NOT_CONNECTED", `Baileys session is not connected for this business.${detail}`);
  }

  entry = getSessionEntry(orgId);
  if (!isSocketOpen(entry.socket)) {
    const detail = entry.lastError ? ` ${entry.lastError}` : "";
    throw new ServiceError(400, "WHATSAPP_NOT_CONNECTED", `Baileys session is not connected for this business.${detail}`);
  }

  entry.status = "CONNECTED";
  entry.lastError = null;
  return entry.socket as WASocket;
}

function toJid(phoneE164: string): string {
  const digits = extractDigits(phoneE164);
  if (!digits) {
    throw new ServiceError(400, "INVALID_PHONE_NUMBER", "Valid destination phone number is required.");
  }

  return `${digits}@s.whatsapp.net`;
}

export async function sendBaileysTextMessage(input: {
  orgId: string;
  toPhoneE164: string;
  text: string;
}): Promise<string | null> {
  const send = async (socket: WASocket) =>
    socket.sendMessage(toJid(input.toPhoneE164), {
      text: input.text
    });

  let socket = await ensureConnectedSocketForOrg(input.orgId);

  try {
    const response = await send(socket);
    return normalize(response?.key?.id ?? undefined);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (!/closed|disconnect|not open|428|440/i.test(message)) {
      throw error;
    }

    socket = await ensureConnectedSocketForOrg(input.orgId, { forceRestart: true });
    const response = await send(socket);
    return normalize(response?.key?.id ?? undefined);
  }
}

export async function sendBaileysMediaMessage(input: {
  orgId: string;
  toPhoneE164: string;
  type: "IMAGE" | "VIDEO" | "AUDIO" | "DOCUMENT";
  fileName: string;
  mimeType?: string;
  caption?: string;
  buffer: Buffer;
}): Promise<string | null> {
  const send = async (socket: WASocket) => {
    const jid = toJid(input.toPhoneE164);
    if (input.type === "IMAGE") {
      const response = await socket.sendMessage(jid, {
        image: input.buffer,
        caption: normalize(input.caption ?? undefined) || undefined,
        mimetype: normalize(input.mimeType ?? "image/jpeg")
      });
      return normalize(response?.key?.id ?? undefined);
    }

    if (input.type === "VIDEO") {
      const response = await socket.sendMessage(jid, {
        video: input.buffer,
        caption: normalize(input.caption ?? undefined) || undefined,
        mimetype: normalize(input.mimeType ?? "video/mp4")
      });
      return normalize(response?.key?.id ?? undefined);
    }

    if (input.type === "AUDIO") {
      const response = await socket.sendMessage(jid, {
        audio: input.buffer,
        mimetype: normalize(input.mimeType ?? "audio/ogg"),
        ptt: false
      });
      return normalize(response?.key?.id ?? undefined);
    }

    const response = await socket.sendMessage(jid, {
      document: input.buffer,
      fileName: normalize(input.fileName) || "document",
      caption: normalize(input.caption ?? undefined) || undefined,
      mimetype: normalize(input.mimeType ?? "application/octet-stream")
    });
    return normalize(response?.key?.id ?? undefined);
  };

  let socket = await ensureConnectedSocketForOrg(input.orgId);

  try {
    return await send(socket);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (!/closed|disconnect|not open|428|440/i.test(message)) {
      throw error;
    }

    socket = await ensureConnectedSocketForOrg(input.orgId, { forceRestart: true });
    return send(socket);
  }
}

export async function sendBaileysTemplateLikeMessage(input: {
  orgId: string;
  toPhoneE164: string;
  templateName: string;
  languageCode: string;
  components: Array<Record<string, unknown>>;
}): Promise<string | null> {
  const renderedComponents = input.components.length > 0 ? `\n\n${JSON.stringify(input.components)}` : "";
  return sendBaileysTextMessage({
    orgId: input.orgId,
    toPhoneE164: input.toPhoneE164,
    text: `[Template:${input.templateName}][${input.languageCode}]${renderedComponents}`
  });
}

export async function sendBaileysTestMessage(input: {
  actorUserId: string;
  orgId: string;
  toPhoneE164: string;
}): Promise<{
  orgId: string;
  toPhoneE164: string;
  waMessageId: string | null;
  sentAt: Date;
}> {
  const orgId = normalize(input.orgId);
  const toPhoneE164 = normalizePossibleE164(input.toPhoneE164);
  if (!orgId || !toPhoneE164) {
    throw new ServiceError(400, "INVALID_TEST_MESSAGE_INPUT", "orgId and valid destination phone are required.");
  }

  await requireSettingsAccess(input.actorUserId, orgId);
  const waMessageId = await sendBaileysTextMessage({
    orgId,
    toPhoneE164,
    text: "20byte Baileys connection test. Jika pesan ini masuk, pairing berhasil."
  });

  return {
    orgId,
    toPhoneE164,
    waMessageId,
    sentAt: new Date()
  };
}

export async function ensureBaileysConnectedForOrg(orgId: string): Promise<void> {
  const connectedAccount = await getConnectedAccount(orgId);
  if (!connectedAccount) {
    throw new ServiceError(400, "WHATSAPP_NOT_CONNECTED", "Baileys session is not connected for this organization.");
  }

  await ensureConnectedSocketForOrg(orgId);
}

export async function getBaileysAccountReport(actorUserId: string, orgId: string): Promise<BaileysAccountReport> {
  const normalizedOrgId = normalize(orgId);
  if (!normalizedOrgId) {
    throw new ServiceError(400, "MISSING_ORG_ID", "orgId is required.");
  }

  await requireSettingsAccess(actorUserId, normalizedOrgId);

  const connectedAccount = await getConnectedAccount(normalizedOrgId);
  const entry = getSessionEntry(normalizedOrgId);
  const todayStart = startOfLocalDay();
  const monthStart = startOfLocalMonth();
  const lastThirtyDays = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [incomingToday, outgoingToday, failedToday, broadcastMonth, outboundMessages] = await Promise.all([
    prisma.message.count({
      where: {
        orgId: normalizedOrgId,
        direction: "INBOUND",
        createdAt: { gte: todayStart }
      }
    }),
    prisma.message.count({
      where: {
        orgId: normalizedOrgId,
        direction: "OUTBOUND",
        sendStatus: "SENT",
        createdAt: { gte: todayStart }
      }
    }),
    prisma.message.count({
      where: {
        orgId: normalizedOrgId,
        direction: "OUTBOUND",
        sendStatus: "FAILED",
        createdAt: { gte: todayStart }
      }
    }),
    prisma.message.count({
      where: {
        orgId: normalizedOrgId,
        direction: "OUTBOUND",
        type: "TEMPLATE",
        createdAt: { gte: monthStart }
      }
    }),
    prisma.message.findMany({
      where: {
        orgId: normalizedOrgId,
        direction: "OUTBOUND",
        sendStatus: "SENT",
        createdAt: { gte: lastThirtyDays }
      },
      select: {
        conversation: {
          select: {
            assignedToMemberId: true
          }
        }
      }
    })
  ]);

  const memberCounts = new Map<string, number>();
  for (const message of outboundMessages) {
    const memberId = message.conversation.assignedToMemberId;
    if (!memberId) {
      continue;
    }

    memberCounts.set(memberId, (memberCounts.get(memberId) ?? 0) + 1);
  }

  const members = memberCounts.size
    ? await prisma.orgMember.findMany({
        where: {
          orgId: normalizedOrgId,
          id: {
            in: [...memberCounts.keys()]
          }
        },
        select: {
          id: true,
          role: true,
          user: {
            select: {
              name: true,
              email: true
            }
          }
        }
      })
    : [];

  const agentActivity = members
    .map((member) => {
      const messagesSent = memberCounts.get(member.id) ?? 0;
      return {
        memberId: member.id,
        agentName: normalize(member.user.name ?? undefined) || normalize(member.user.email ?? undefined) || "Agent",
        role: member.role,
        messagesSent,
        performance: toPerformanceLabel(messagesSent)
      };
    })
    .sort((left, right) => right.messagesSent - left.messagesSent)
    .slice(0, 8);

  return {
    connectedAccount,
    metrics: {
      incomingToday,
      outgoingToday,
      failedToday,
      broadcastMonth
    },
    agentActivity,
    technical: {
      sessionId: connectedAccount?.id ?? normalizedOrgId,
      connectedSince: connectedAccount?.connectedAt.toISOString() ?? null,
      uptimeLabel: formatUptimeLabel(connectedAccount?.connectedAt ?? null, entry.status),
      status: entry.status,
      lastError: entry.lastError
    }
  };
}

export async function listBaileysRuntimeMedia(orgId: string): Promise<string[]> {
  const mediaFolder = getMediaFolder(orgId);
  try {
    return await readdir(mediaFolder);
  } catch {
    return [];
  }
}

export async function readBaileysMediaFile(orgId: string, fileName: string): Promise<Buffer> {
  const safeFileName = path.basename(fileName);
  const diskPath = path.join(getMediaFolder(orgId), safeFileName);
  const fileStats = await stat(diskPath);
  if (!fileStats.isFile()) {
    throw new ServiceError(404, "MEDIA_FILE_NOT_FOUND", "Media file does not exist.");
  }

  return readFile(diskPath);
}

export async function writeBaileysAuditLog(actorUserId: string, orgId: string, action: string, entityId: string, meta?: Record<string, unknown>) {
  await writeAuditLogSafe({
    actorUserId,
    orgId,
    action,
    entityType: "baileys_session",
    entityId,
    meta
  });
}
