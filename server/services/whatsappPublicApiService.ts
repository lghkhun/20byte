import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";
import { lookup as dnsLookup } from "dns/promises";
import type { LookupAddress } from "dns";
import { isIP } from "net";

import { Role, WhatsAppPublicScheduleStatus } from "@prisma/client";

import { getAuthSecret } from "@/lib/env";
import { prisma } from "@/lib/db/prisma";
import { normalizePossibleE164, normalizeWhatsAppDestination } from "@/lib/whatsapp/e164";
import { assertOrgBillingAccess, calculateBillingPlanPricing } from "@/server/services/billingService";
import {
  checkBaileysContactNumber,
  disconnectBaileysSessionForOrg,
  ensureBaileysConnectedForOrg,
  getBaileysQrStatusForOrg,
  listBaileysGroupMembersForOrg,
  listBaileysGroupsForOrg,
  sendBaileysMediaMessage,
  sendBaileysTextMessage,
  startBaileysQrSessionForOrg
} from "@/server/services/baileysService";
import { writeAuditLogSafe } from "@/server/services/auditLogService";
import { ServiceError } from "@/server/services/serviceError";
import { enqueueWhatsAppPublicScheduleJob } from "@/server/queues/whatsappPublicScheduleQueue";
import { enqueueWhatsAppPublicWebhookEventJob } from "@/server/queues/whatsappPublicWebhookQueue";

const API_KEY_PREFIX = "twapi";
const ENC_VERSION = "v1";
const DEFAULT_EVENT_FILTERS = ["message.inbound", "message.outbound.status", "device.connection"] as const;
const WEBHOOK_MAX_ATTEMPTS = 6;
const MEDIA_DOWNLOAD_TIMEOUT_MS = 10_000;
const MEDIA_DOWNLOAD_MAX_BYTES = 10 * 1024 * 1024;

export type PublicApiActorContext = {
  orgId: string;
  apiKeyId: string;
};

export type OrgWhatsAppApiKeyView = {
  id: string;
  status: "ACTIVE" | "REVOKED";
  maskedKey: string;
  createdAt: string;
  rotatedAt: string | null;
  revokedAt: string | null;
};

export type OrgWhatsAppPublicWebhookView = {
  url: string | null;
  enabled: boolean;
  eventFilters: string[];
  updatedAt: string | null;
  hasSecret: boolean;
};

export type PublicWhatsAppApiKeyGenerateResult = {
  key: string;
  keyInfo: OrgWhatsAppApiKeyView;
};

function normalize(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function normalizeOptional(value: string | null | undefined): string | null {
  const normalized = normalize(value);
  return normalized || null;
}

function isPrivateOrLocalIpv4(ip: string): boolean {
  const parts = ip.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return true;
  }

  const [a, b] = parts;
  if (a === 10 || a === 127 || a === 0) {
    return true;
  }
  if (a === 169 && b === 254) {
    return true;
  }
  if (a === 172 && b >= 16 && b <= 31) {
    return true;
  }
  if (a === 192 && b === 168) {
    return true;
  }
  if (a >= 224) {
    return true;
  }
  return false;
}

function isPrivateOrLocalIpv6(ip: string): boolean {
  const normalized = ip.toLowerCase().split("%")[0];
  if (normalized === "::" || normalized === "::1") {
    return true;
  }
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) {
    return true;
  }
  if (normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb")) {
    return true;
  }
  if (normalized.startsWith("ff")) {
    return true;
  }

  if (normalized.startsWith("::ffff:")) {
    const mapped = normalized.slice("::ffff:".length);
    if (isIP(mapped) === 4) {
      return isPrivateOrLocalIpv4(mapped);
    }
  }

  return false;
}

export function isPrivateOrLocalIp(input: string): boolean {
  const normalized = input.trim();
  const family = isIP(normalized);
  if (family === 4) {
    return isPrivateOrLocalIpv4(normalized);
  }
  if (family === 6) {
    return isPrivateOrLocalIpv6(normalized);
  }
  return false;
}

export function validatePublicMediaUrl(rawUrl: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new ServiceError(400, "INVALID_MEDIA_URL", "mediaUrl must be a valid URL.");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new ServiceError(400, "INVALID_MEDIA_URL", "mediaUrl must use http/https.");
  }

  const hostname = parsed.hostname.trim().toLowerCase();
  if (!hostname || hostname === "localhost" || hostname.endsWith(".localhost")) {
    throw new ServiceError(400, "INVALID_MEDIA_URL", "mediaUrl host is not allowed.");
  }

  if (isIP(hostname) !== 0 && isPrivateOrLocalIp(hostname)) {
    throw new ServiceError(400, "INVALID_MEDIA_URL", "mediaUrl host is not allowed.");
  }

  return parsed;
}

async function ensureMediaHostnameIsPublic(hostname: string): Promise<void> {
  let addresses: LookupAddress[];
  try {
    addresses = (await dnsLookup(hostname, { all: true, verbatim: true })) as LookupAddress[];
  } catch {
    throw new ServiceError(400, "INVALID_MEDIA_URL", "mediaUrl host could not be resolved.");
  }

  if (addresses.length === 0) {
    throw new ServiceError(400, "INVALID_MEDIA_URL", "mediaUrl host could not be resolved.");
  }

  for (const address of addresses) {
    if (isPrivateOrLocalIp(address.address)) {
      throw new ServiceError(400, "INVALID_MEDIA_URL", "mediaUrl host is not allowed.");
    }
  }
}

function ensureUrl(value: string | null): string | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("invalid");
    }
    return parsed.toString();
  } catch {
    throw new ServiceError(400, "INVALID_WEBHOOK_URL", "Webhook URL must be a valid http/https URL.");
  }
}

function buildEncryptionKey(): Buffer {
  return createHash("sha256").update(getAuthSecret()).digest();
}

function encryptSecret(value: string): string {
  const key = buildEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${ENC_VERSION}:${iv.toString("base64url")}:${tag.toString("base64url")}:${encrypted.toString("base64url")}`;
}

function decryptSecret(value: string): string {
  const [version, ivPart, tagPart, encryptedPart] = value.split(":");
  if (version !== ENC_VERSION || !ivPart || !tagPart || !encryptedPart) {
    throw new ServiceError(500, "WEBHOOK_SECRET_DECRYPT_FAILED", "Stored webhook secret format is invalid.");
  }

  const decipher = createDecipheriv("aes-256-gcm", buildEncryptionKey(), Buffer.from(ivPart, "base64url"));
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(encryptedPart, "base64url")), decipher.final()]);
  return decrypted.toString("utf8");
}

function hashApiKey(rawKey: string): string {
  return createHash("sha256").update(rawKey).digest("hex");
}

function hashSafeEqual(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  if (leftBytes.length !== rightBytes.length) {
    return false;
  }
  return timingSafeEqual(leftBytes, rightBytes);
}

function maskApiKey(prefix: string, lastFour: string): string {
  return `${API_KEY_PREFIX}_${prefix}...${lastFour}`;
}

function mapApiKeyRow(row: {
  id: string;
  keyPrefix: string;
  lastFour: string;
  createdAt: Date;
  rotatedAt: Date | null;
  revokedAt: Date | null;
}): OrgWhatsAppApiKeyView {
  return {
    id: row.id,
    status: row.revokedAt ? "REVOKED" : "ACTIVE",
    maskedKey: maskApiKey(row.keyPrefix, row.lastFour),
    createdAt: row.createdAt.toISOString(),
    rotatedAt: row.rotatedAt?.toISOString() ?? null,
    revokedAt: row.revokedAt?.toISOString() ?? null
  };
}

async function requireOrgMembership(userId: string, orgId: string): Promise<Role> {
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
    throw new ServiceError(403, "ORG_ACCESS_DENIED", "You do not have access to this business.");
  }

  await assertOrgBillingAccess(orgId, "read");
  return membership.role;
}

async function requireOwnerRole(userId: string, orgId: string): Promise<void> {
  const role = await requireOrgMembership(userId, orgId);
  if (role !== Role.OWNER) {
    throw new ServiceError(403, "FORBIDDEN_OWNER_ONLY", "Only owner can manage WhatsApp Public API.");
  }
}

async function requireOwnerOrAdminRole(userId: string, orgId: string): Promise<Role> {
  const role = await requireOrgMembership(userId, orgId);
  if (role !== Role.OWNER && role !== Role.ADMIN) {
    throw new ServiceError(403, "FORBIDDEN_SETTINGS_ACCESS", "Only owner/admin can access WhatsApp Public API settings.");
  }
  return role;
}

function validatePlanMonths(value: unknown): 1 | 3 | 12 {
  const parsed = Number(value);
  if (parsed === 1 || parsed === 3 || parsed === 12) {
    return parsed;
  }
  return 1;
}

export async function getPricingPlansForPublicDocs(): Promise<Array<{
  months: 1 | 3 | 12;
  label: string;
  totalAmountCents: number;
  baseAmountCents: number;
  gatewayFeeCents: number;
  discountBps: number;
}>> {
  const planMonths = [1, 3, 12] as const;
  return planMonths.map((months) => {
    const pricing = calculateBillingPlanPricing({
      baseAmountCents: 99_000,
      gatewayFeeBps: 200,
      planMonths: months
    });

    return {
      months,
      label: pricing.label,
      totalAmountCents: pricing.totalAmountCents,
      baseAmountCents: pricing.netBaseAmountCents,
      gatewayFeeCents: pricing.gatewayFeeCents,
      discountBps: pricing.discountBps
    };
  });
}

export async function getOrgWhatsAppPublicApiKey(input: {
  actorUserId: string;
  orgId: string;
}): Promise<{ role: Role; key: OrgWhatsAppApiKeyView | null }> {
  const orgId = normalize(input.orgId);
  if (!orgId) {
    throw new ServiceError(400, "MISSING_ORG_ID", "orgId is required.");
  }

  const role = await requireOwnerOrAdminRole(input.actorUserId, orgId);
  const row = await prisma.orgWhatsAppApiKey.findUnique({
    where: { orgId },
    select: {
      id: true,
      keyPrefix: true,
      lastFour: true,
      createdAt: true,
      rotatedAt: true,
      revokedAt: true
    }
  });

  return {
    role,
    key: row ? mapApiKeyRow(row) : null
  };
}

export async function generateOrRotateOrgWhatsAppPublicApiKey(input: {
  actorUserId: string;
  orgId: string;
}): Promise<PublicWhatsAppApiKeyGenerateResult> {
  const orgId = normalize(input.orgId);
  if (!orgId) {
    throw new ServiceError(400, "MISSING_ORG_ID", "orgId is required.");
  }

  await requireOwnerRole(input.actorUserId, orgId);

  const prefix = randomBytes(4).toString("hex");
  const secret = randomBytes(24).toString("base64url");
  const key = `${API_KEY_PREFIX}_${prefix}_${secret}`;
  const keyHash = hashApiKey(key);
  const lastFour = secret.slice(-4);

  const saved = await prisma.orgWhatsAppApiKey.upsert({
    where: { orgId },
    update: {
      keyPrefix: prefix,
      keyHash,
      lastFour,
      createdByUserId: input.actorUserId,
      rotatedAt: new Date(),
      revokedAt: null
    },
    create: {
      orgId,
      keyPrefix: prefix,
      keyHash,
      lastFour,
      createdByUserId: input.actorUserId,
      rotatedAt: null,
      revokedAt: null
    },
    select: {
      id: true,
      keyPrefix: true,
      lastFour: true,
      createdAt: true,
      rotatedAt: true,
      revokedAt: true
    }
  });

  await writeAuditLogSafe({
    orgId,
    actorUserId: input.actorUserId,
    action: "public_api.key.rotated",
    entityType: "whatsapp_public_api_key",
    entityId: saved.id,
    meta: {
      prefix
    }
  });

  return {
    key,
    keyInfo: mapApiKeyRow(saved)
  };
}

export async function revokeOrgWhatsAppPublicApiKey(input: {
  actorUserId: string;
  orgId: string;
}): Promise<{ revoked: boolean }> {
  const orgId = normalize(input.orgId);
  if (!orgId) {
    throw new ServiceError(400, "MISSING_ORG_ID", "orgId is required.");
  }

  await requireOwnerRole(input.actorUserId, orgId);
  const result = await prisma.orgWhatsAppApiKey.updateMany({
    where: {
      orgId,
      revokedAt: null
    },
    data: {
      revokedAt: new Date()
    }
  });

  await writeAuditLogSafe({
    orgId,
    actorUserId: input.actorUserId,
    action: "public_api.key.revoked",
    entityType: "whatsapp_public_api_key",
    entityId: orgId,
    meta: {
      count: result.count
    }
  });

  return {
    revoked: result.count > 0
  };
}

function parseEventFilters(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [...DEFAULT_EVENT_FILTERS];
  }

  const normalized = value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0)
    .slice(0, 12);

  return normalized.length > 0 ? normalized : [...DEFAULT_EVENT_FILTERS];
}

export async function getOrgWhatsAppPublicWebhook(input: {
  actorUserId: string;
  orgId: string;
}): Promise<{ role: Role; webhook: OrgWhatsAppPublicWebhookView | null }> {
  const orgId = normalize(input.orgId);
  if (!orgId) {
    throw new ServiceError(400, "MISSING_ORG_ID", "orgId is required.");
  }

  const role = await requireOwnerOrAdminRole(input.actorUserId, orgId);
  const row = await prisma.orgWhatsAppPublicWebhook.findUnique({
    where: { orgId },
    select: {
      url: true,
      enabled: true,
      eventFiltersJson: true,
      secretEnc: true,
      updatedAt: true
    }
  });

  if (!row) {
    return {
      role,
      webhook: null
    };
  }

  let eventFilters: string[] = [...DEFAULT_EVENT_FILTERS];
  try {
    const parsed = JSON.parse(row.eventFiltersJson ?? "[]") as unknown;
    eventFilters = parseEventFilters(parsed);
  } catch {
    eventFilters = [...DEFAULT_EVENT_FILTERS];
  }

  return {
    role,
    webhook: {
      url: normalizeOptional(row.url),
      enabled: Boolean(row.enabled),
      eventFilters,
      updatedAt: row.updatedAt?.toISOString() ?? null,
      hasSecret: Boolean(row.secretEnc)
    }
  };
}

export async function upsertOrgWhatsAppPublicWebhook(input: {
  actorUserId: string;
  orgId: string;
  url?: unknown;
  enabled?: unknown;
  eventFilters?: unknown;
  regenerateSecret?: unknown;
}): Promise<OrgWhatsAppPublicWebhookView & { secret?: string }> {
  const orgId = normalize(input.orgId);
  if (!orgId) {
    throw new ServiceError(400, "MISSING_ORG_ID", "orgId is required.");
  }

  await requireOwnerRole(input.actorUserId, orgId);

  const url = ensureUrl(typeof input.url === "string" ? input.url.trim() : null);
  const enabled = Boolean(input.enabled);
  const eventFilters = parseEventFilters(input.eventFilters);
  const shouldRegenerateSecret = Boolean(input.regenerateSecret);

  const generatedSecret = shouldRegenerateSecret ? randomBytes(24).toString("base64url") : null;
  const row = await prisma.orgWhatsAppPublicWebhook.upsert({
    where: { orgId },
    update: {
      url,
      enabled,
      eventFiltersJson: JSON.stringify(eventFilters),
      ...(shouldRegenerateSecret ? { secretEnc: encryptSecret(generatedSecret as string) } : {})
    },
    create: {
      orgId,
      url,
      enabled,
      eventFiltersJson: JSON.stringify(eventFilters),
      secretEnc: generatedSecret ? encryptSecret(generatedSecret) : null
    },
    select: {
      url: true,
      enabled: true,
      eventFiltersJson: true,
      secretEnc: true,
      updatedAt: true
    }
  });

  await writeAuditLogSafe({
    orgId,
    actorUserId: input.actorUserId,
    action: "public_api.webhook.updated",
    entityType: "whatsapp_public_webhook",
    entityId: orgId,
    meta: {
      enabled,
      hasUrl: Boolean(url),
      filters: eventFilters,
      regeneratedSecret: shouldRegenerateSecret
    }
  });

  return {
    url: normalizeOptional(row.url),
    enabled: Boolean(row.enabled),
    eventFilters,
    updatedAt: row.updatedAt?.toISOString() ?? null,
    hasSecret: Boolean(row.secretEnc),
    ...(generatedSecret ? { secret: generatedSecret } : {})
  };
}

export async function deleteOrgWhatsAppPublicWebhook(input: {
  actorUserId: string;
  orgId: string;
}): Promise<{ deleted: boolean }> {
  const orgId = normalize(input.orgId);
  if (!orgId) {
    throw new ServiceError(400, "MISSING_ORG_ID", "orgId is required.");
  }

  await requireOwnerRole(input.actorUserId, orgId);
  const result = await prisma.orgWhatsAppPublicWebhook.deleteMany({
    where: {
      orgId
    }
  });

  await writeAuditLogSafe({
    orgId,
    actorUserId: input.actorUserId,
    action: "public_api.webhook.deleted",
    entityType: "whatsapp_public_webhook",
    entityId: orgId,
    meta: {
      count: result.count
    }
  });

  return {
    deleted: result.count > 0
  };
}

export function parsePublicApiBearerToken(authHeader: string | null | undefined): string {
  const raw = normalize(authHeader);
  if (!raw) {
    throw new ServiceError(401, "UNAUTHORIZED", "Missing Authorization header.");
  }

  const [scheme, token] = raw.split(/\s+/, 2);
  if (!scheme || !token || scheme.toLowerCase() !== "bearer") {
    throw new ServiceError(401, "UNAUTHORIZED", "Authorization header must use Bearer token.");
  }

  if (!token.startsWith(`${API_KEY_PREFIX}_`)) {
    throw new ServiceError(401, "INVALID_API_KEY", "Invalid API key.");
  }

  return token;
}

export function assertPublicApiKeyHashMatch(storedKeyHash: string | null | undefined, tokenHash: string): void {
  if (!storedKeyHash || !hashSafeEqual(storedKeyHash, tokenHash)) {
    throw new ServiceError(401, "INVALID_API_KEY", "Invalid API key.");
  }
}

export async function authenticatePublicWhatsAppApiKey(authHeader: string | null | undefined): Promise<PublicApiActorContext> {
  const token = parsePublicApiBearerToken(authHeader);
  const tokenHash = hashApiKey(token);

  const row = await prisma.orgWhatsAppApiKey.findFirst({
    where: {
      keyHash: tokenHash,
      revokedAt: null
    },
    select: {
      id: true,
      orgId: true,
      keyHash: true
    }
  });

  assertPublicApiKeyHashMatch(row?.keyHash, tokenHash);
  if (!row) {
    throw new ServiceError(401, "INVALID_API_KEY", "Invalid API key.");
  }

  await assertOrgBillingAccess(row.orgId, "read");

  return {
    orgId: row.orgId,
    apiKeyId: row.id
  };
}

function requireText(value: unknown, field: string): string {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized) {
    throw new ServiceError(400, "INVALID_REQUEST", `${field} is required.`);
  }
  return normalized;
}

function resolveTargetJid(to: string): { toPhoneE164: string; toJid?: string } {
  const normalized = normalize(to);
  if (!normalized) {
    throw new ServiceError(400, "INVALID_TO", "Destination is required.");
  }

  if (normalized.includes("@g.us")) {
    return {
      toPhoneE164: "+620000000000",
      toJid: normalized
    };
  }

  const phone = normalizeWhatsAppDestination(normalized);
  if (!phone) {
    throw new ServiceError(400, "INVALID_TO", "Destination phone number is invalid.");
  }

  return {
    toPhoneE164: phone
  };
}

export async function publicSendTextMessage(input: {
  orgId: string;
  to: string;
  text: string;
}): Promise<{ messageId: string | null; sentAt: string }> {
  await ensureBaileysConnectedForOrg(input.orgId);
  const target = resolveTargetJid(input.to);
  const waMessageId = await sendBaileysTextMessage({
    orgId: input.orgId,
    toPhoneE164: target.toPhoneE164,
    toJid: target.toJid,
    text: requireText(input.text, "text")
  });

  await writeAuditLogSafe({
    orgId: input.orgId,
    actorUserId: "system:public-api",
    action: "public_api.messages.send",
    entityType: "public_api_message",
    entityId: waMessageId ?? randomBytes(8).toString("hex"),
    meta: {
      to: input.to,
      type: "text",
      waMessageId
    }
  });

  await emitPublicWebhookEvent({
    orgId: input.orgId,
    type: "message.outbound.status",
    payload: {
      status: "SENT",
      messageId: waMessageId,
      to: input.to,
      type: "text",
      sentAt: new Date().toISOString()
    }
  });

  return {
    messageId: waMessageId,
    sentAt: new Date().toISOString()
  };
}

async function downloadMediaAsBuffer(mediaUrl: string): Promise<{ buffer: Buffer; mimeType: string }> {
  const parsed = validatePublicMediaUrl(mediaUrl);
  await ensureMediaHostnameIsPublic(parsed.hostname);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), MEDIA_DOWNLOAD_TIMEOUT_MS);

  try {
    const response = await fetch(parsed.toString(), {
      method: "GET",
      redirect: "manual",
      signal: controller.signal
    });

    if (response.status >= 300 && response.status < 400) {
      throw new ServiceError(400, "INVALID_MEDIA_URL", "Redirect is not allowed for mediaUrl.");
    }

    if (!response.ok) {
      throw new ServiceError(400, "INVALID_MEDIA_URL", "Failed to fetch media URL.");
    }

    const contentLength = Number(response.headers.get("content-length") ?? "");
    if (Number.isFinite(contentLength) && contentLength > MEDIA_DOWNLOAD_MAX_BYTES) {
      throw new ServiceError(413, "MEDIA_TOO_LARGE", "Media file exceeds maximum allowed size.");
    }

    if (!response.body) {
      throw new ServiceError(400, "INVALID_MEDIA_URL", "Media response body is empty.");
    }

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      const chunk = value ?? new Uint8Array();
      totalBytes += chunk.byteLength;
      if (totalBytes > MEDIA_DOWNLOAD_MAX_BYTES) {
        throw new ServiceError(413, "MEDIA_TOO_LARGE", "Media file exceeds maximum allowed size.");
      }
      chunks.push(chunk);
    }

    const mimeType = normalize(response.headers.get("content-type")) || "application/octet-stream";
    return {
      buffer: Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))),
      mimeType
    };
  } catch (error) {
    if (error instanceof ServiceError) {
      throw error;
    }
    if (error instanceof Error && error.name === "AbortError") {
      throw new ServiceError(408, "MEDIA_DOWNLOAD_TIMEOUT", "Media download timed out.");
    }
    throw new ServiceError(400, "INVALID_MEDIA_URL", "Failed to fetch media URL.");
  } finally {
    clearTimeout(timeout);
  }
}

function mapMediaType(mimeType: string): "IMAGE" | "VIDEO" | "AUDIO" | "DOCUMENT" {
  if (mimeType.startsWith("image/")) {
    return "IMAGE";
  }
  if (mimeType.startsWith("video/")) {
    return "VIDEO";
  }
  if (mimeType.startsWith("audio/")) {
    return "AUDIO";
  }
  return "DOCUMENT";
}

export async function publicSendMediaByUrl(input: {
  orgId: string;
  to: string;
  mediaUrl: string;
  caption?: string;
  fileName?: string;
  mimeType?: string;
}): Promise<{ messageId: string | null; sentAt: string }> {
  await ensureBaileysConnectedForOrg(input.orgId);
  const target = resolveTargetJid(input.to);
  const mediaUrl = requireText(input.mediaUrl, "mediaUrl");
  const downloaded = await downloadMediaAsBuffer(mediaUrl);
  const resolvedMime = normalize(input.mimeType) || downloaded.mimeType;
  const waMessageId = await sendBaileysMediaMessage({
    orgId: input.orgId,
    toPhoneE164: target.toPhoneE164,
    toJid: target.toJid,
    type: mapMediaType(resolvedMime),
    fileName: normalize(input.fileName) || "attachment",
    mimeType: resolvedMime,
    caption: normalizeOptional(input.caption) ?? undefined,
    buffer: downloaded.buffer
  });

  await writeAuditLogSafe({
    orgId: input.orgId,
    actorUserId: "system:public-api",
    action: "public_api.messages.send_media",
    entityType: "public_api_message",
    entityId: waMessageId ?? randomBytes(8).toString("hex"),
    meta: {
      to: input.to,
      type: "media_url",
      mediaUrl,
      waMessageId
    }
  });

  await emitPublicWebhookEvent({
    orgId: input.orgId,
    type: "message.outbound.status",
    payload: {
      status: "SENT",
      messageId: waMessageId,
      to: input.to,
      type: "media_url",
      sentAt: new Date().toISOString()
    }
  });

  return {
    messageId: waMessageId,
    sentAt: new Date().toISOString()
  };
}

export async function createPublicSendSchedule(input: {
  orgId: string;
  actorUserId?: string | null;
  targetType: "contact" | "group";
  to: string;
  messageType: "text" | "media_url";
  text?: string;
  mediaUrl?: string;
  caption?: string;
  fileName?: string;
  mimeType?: string;
  dueAt?: string | Date;
}): Promise<{ scheduleId: string; status: string; dueAt: string }> {
  const dueAt = input.dueAt ? new Date(input.dueAt) : new Date();
  if (Number.isNaN(dueAt.getTime())) {
    throw new ServiceError(400, "INVALID_DUE_AT", "dueAt must be a valid datetime.");
  }

  const target = resolveTargetJid(input.to);
  const schedule = await prisma.orgWhatsAppPublicSchedule.create({
    data: {
      orgId: input.orgId,
      createdByUserId: normalizeOptional(input.actorUserId),
      status: WhatsAppPublicScheduleStatus.PENDING,
      targetType: input.targetType,
      target: target.toJid ?? target.toPhoneE164,
      messageType: input.messageType,
      text: input.messageType === "text" ? requireText(input.text, "text") : normalizeOptional(input.caption),
      mediaUrl: input.messageType === "media_url" ? requireText(input.mediaUrl, "mediaUrl") : null,
      fileName: normalizeOptional(input.fileName),
      mimeType: normalizeOptional(input.mimeType),
      dueAt
    },
    select: {
      id: true,
      status: true,
      dueAt: true
    }
  });

  await enqueueWhatsAppPublicScheduleJob({
    scheduleId: schedule.id,
    dueAt: schedule.dueAt.toISOString(),
    orgId: input.orgId
  });

  await writeAuditLogSafe({
    orgId: input.orgId,
    actorUserId: normalizeOptional(input.actorUserId) ?? "system:public-api",
    action: "public_api.schedule.created",
    entityType: "whatsapp_public_schedule",
    entityId: schedule.id,
    meta: {
      targetType: input.targetType,
      messageType: input.messageType,
      dueAt: schedule.dueAt.toISOString()
    }
  });

  return {
    scheduleId: schedule.id,
    status: schedule.status,
    dueAt: schedule.dueAt.toISOString()
  };
}

export async function getPublicSchedule(input: {
  orgId: string;
  scheduleId: string;
}): Promise<{
  id: string;
  status: string;
  targetType: string;
  target: string;
  messageType: string;
  dueAt: string;
  sentAt: string | null;
  failedAt: string | null;
  canceledAt: string | null;
  failureCode: string | null;
  failureMessage: string | null;
}> {
  const schedule = await prisma.orgWhatsAppPublicSchedule.findFirst({
    where: {
      id: normalize(input.scheduleId),
      orgId: input.orgId
    },
    select: {
      id: true,
      status: true,
      targetType: true,
      target: true,
      messageType: true,
      dueAt: true,
      sentAt: true,
      failedAt: true,
      canceledAt: true,
      failureCode: true,
      failureMessage: true
    }
  });

  if (!schedule) {
    throw new ServiceError(404, "SCHEDULE_NOT_FOUND", "Schedule not found.");
  }

  return {
    id: schedule.id,
    status: schedule.status,
    targetType: schedule.targetType,
    target: schedule.target,
    messageType: schedule.messageType,
    dueAt: schedule.dueAt.toISOString(),
    sentAt: schedule.sentAt?.toISOString() ?? null,
    failedAt: schedule.failedAt?.toISOString() ?? null,
    canceledAt: schedule.canceledAt?.toISOString() ?? null,
    failureCode: schedule.failureCode,
    failureMessage: schedule.failureMessage
  };
}

export async function cancelPublicSchedule(input: {
  orgId: string;
  scheduleId: string;
}): Promise<{ canceled: boolean }> {
  const result = await prisma.orgWhatsAppPublicSchedule.updateMany({
    where: {
      id: normalize(input.scheduleId),
      orgId: input.orgId,
      status: WhatsAppPublicScheduleStatus.PENDING
    },
    data: {
      status: WhatsAppPublicScheduleStatus.CANCELED,
      canceledAt: new Date()
    }
  });

  return {
    canceled: result.count > 0
  };
}

export async function processPublicScheduleJob(input: {
  scheduleId: string;
}): Promise<void> {
  const schedule = await prisma.orgWhatsAppPublicSchedule.findUnique({
    where: { id: input.scheduleId }
  });

  if (!schedule || schedule.status !== WhatsAppPublicScheduleStatus.PENDING) {
    return;
  }

  const now = new Date();
  if (schedule.dueAt.getTime() > now.getTime()) {
    await enqueueWhatsAppPublicScheduleJob({
      scheduleId: schedule.id,
      orgId: schedule.orgId,
      dueAt: schedule.dueAt.toISOString()
    });
    return;
  }

  try {
    if (schedule.messageType === "text") {
      await publicSendTextMessage({
        orgId: schedule.orgId,
        to: schedule.target,
        text: schedule.text ?? ""
      });
    } else {
      await publicSendMediaByUrl({
        orgId: schedule.orgId,
        to: schedule.target,
        mediaUrl: schedule.mediaUrl ?? "",
        caption: schedule.text ?? undefined,
        fileName: schedule.fileName ?? undefined,
        mimeType: schedule.mimeType ?? undefined
      });
    }

    await prisma.orgWhatsAppPublicSchedule.update({
      where: { id: schedule.id },
      data: {
        status: WhatsAppPublicScheduleStatus.SENT,
        sentAt: new Date(),
        failureCode: null,
        failureMessage: null
      }
    });
  } catch (error) {
    const currentRetry = schedule.retryCount + 1;
    const message = error instanceof Error ? error.message : "Failed to send scheduled message.";
    const code = error instanceof ServiceError ? error.code : "SCHEDULE_SEND_FAILED";
    const shouldRetry = currentRetry < 4;

    await prisma.orgWhatsAppPublicSchedule.update({
      where: { id: schedule.id },
      data: {
        status: shouldRetry ? WhatsAppPublicScheduleStatus.PENDING : WhatsAppPublicScheduleStatus.FAILED,
        retryCount: currentRetry,
        nextRetryAt: shouldRetry ? new Date(Date.now() + Math.min(30_000 * currentRetry, 180_000)) : null,
        failedAt: shouldRetry ? null : new Date(),
        failureCode: code,
        failureMessage: message
      }
    });

    if (shouldRetry) {
      await enqueueWhatsAppPublicScheduleJob({
        scheduleId: schedule.id,
        orgId: schedule.orgId,
        dueAt: new Date(Date.now() + Math.min(30_000 * currentRetry, 180_000)).toISOString()
      });
    }
  }
}

export async function emitPublicWebhookEvent(input: {
  orgId: string;
  type: string;
  payload: Record<string, unknown>;
}): Promise<void> {
  const webhookConfig = await prisma.orgWhatsAppPublicWebhook.findUnique({
    where: {
      orgId: input.orgId
    },
    select: {
      enabled: true,
      eventFiltersJson: true
    }
  });

  if (!webhookConfig?.enabled) {
    return;
  }

  let eventFilters = [...DEFAULT_EVENT_FILTERS] as string[];
  try {
    const parsed = JSON.parse(webhookConfig.eventFiltersJson ?? "[]") as unknown;
    eventFilters = parseEventFilters(parsed);
  } catch {
    eventFilters = [...DEFAULT_EVENT_FILTERS];
  }

  if (!eventFilters.includes(input.type)) {
    return;
  }

  const eventId = randomBytes(12).toString("hex");
  await prisma.orgWhatsAppPublicWebhookEvent.create({
    data: {
      eventId,
      orgId: input.orgId,
      type: input.type,
      payloadJson: JSON.stringify({
        eventId,
        type: input.type,
        occurredAt: new Date().toISOString(),
        data: input.payload
      }),
      status: "PENDING",
      attempts: 0,
      nextAttemptAt: new Date()
    }
  });

  await enqueueWhatsAppPublicWebhookEventJob({
    orgId: input.orgId,
    eventId,
    dueAt: new Date().toISOString()
  });
}

function buildWebhookSignature(secret: string, timestamp: string, payload: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
}

export async function processPublicWebhookEventDelivery(input: {
  eventId: string;
}): Promise<void> {
  const event = await prisma.orgWhatsAppPublicWebhookEvent.findUnique({
    where: {
      eventId: input.eventId
    }
  });

  if (!event || event.status === "DELIVERED") {
    return;
  }

  const webhook = await prisma.orgWhatsAppPublicWebhook.findUnique({
    where: {
      orgId: event.orgId
    }
  });
  if (!webhook?.enabled || !webhook.url || !webhook.secretEnc) {
    await prisma.orgWhatsAppPublicWebhookEvent.update({
      where: { id: event.id },
      data: {
        status: "SKIPPED",
        lastError: "Webhook is not configured.",
        attempts: event.attempts + 1
      }
    });
    return;
  }

  const timestamp = String(Date.now());
  const payload = event.payloadJson;
  const secret = decryptSecret(webhook.secretEnc);
  const signature = buildWebhookSignature(secret, timestamp, payload);

  try {
    const response = await fetch(webhook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-20byte-signature": signature,
        "x-20byte-timestamp": timestamp,
        "x-20byte-event-id": event.eventId
      },
      body: payload
    });

    if (!response.ok) {
      throw new Error(`Webhook responded ${response.status}`);
    }

    await prisma.orgWhatsAppPublicWebhookEvent.update({
      where: { id: event.id },
      data: {
        status: "DELIVERED",
        deliveredAt: new Date(),
        attempts: event.attempts + 1,
        lastError: null,
        nextAttemptAt: null
      }
    });
  } catch (error) {
    const attempts = event.attempts + 1;
    const shouldRetry = attempts < WEBHOOK_MAX_ATTEMPTS;
    const nextAttemptAt = shouldRetry ? new Date(Date.now() + Math.min(2 ** attempts * 1000, 120_000)) : null;
    await prisma.orgWhatsAppPublicWebhookEvent.update({
      where: { id: event.id },
      data: {
        status: shouldRetry ? "PENDING" : "FAILED",
        attempts,
        nextAttemptAt,
        lastError: error instanceof Error ? error.message : "Webhook delivery failed."
      }
    });

    if (shouldRetry && nextAttemptAt) {
      await enqueueWhatsAppPublicWebhookEventJob({
        orgId: event.orgId,
        eventId: event.eventId,
        dueAt: nextAttemptAt.toISOString()
      });
    }
  }
}

export function verifyPublicWebhookSignature(input: {
  secret: string;
  timestamp: string;
  payload: string;
  signature: string;
}): boolean {
  const expected = buildWebhookSignature(input.secret, input.timestamp, input.payload);
  return hashSafeEqual(expected, input.signature);
}

export async function publicGetDeviceInfo(orgId: string): Promise<{
  orgId: string;
  connected: boolean;
  connectionStatus: string;
  qrCodeExpiresAt: string | null;
}> {
  const status = await getBaileysQrStatusForOrg(orgId);
  return {
    orgId: status.orgId,
    connected: status.connected,
    connectionStatus: status.connectionStatus,
    qrCodeExpiresAt: status.qrCodeExpiresAt?.toISOString() ?? null
  };
}

export async function publicGenerateQr(orgId: string): Promise<{
  orgId: string;
  connectionStatus: string;
  qrCode: string;
  expiresInSeconds: number;
}> {
  const qr = await startBaileysQrSessionForOrg(orgId);
  await emitPublicWebhookEvent({
    orgId,
    type: "device.connection",
    payload: {
      status: qr.connectionStatus,
      action: "generate_qr"
    }
  });
  return qr;
}

export async function publicGenerateQrLink(orgId: string): Promise<{
  orgId: string;
  qrCode: string;
  expiresInSeconds: number;
  qrImageUrl: string;
}> {
  const qr = await startBaileysQrSessionForOrg(orgId);
  const encoded = encodeURIComponent(qr.qrCode);
  return {
    orgId: qr.orgId,
    qrCode: qr.qrCode,
    expiresInSeconds: qr.expiresInSeconds,
    qrImageUrl: `https://api.qrserver.com/v1/create-qr-code/?size=512x512&data=${encoded}`
  };
}

export async function publicLogoutDevice(orgId: string): Promise<{ disconnected: boolean }> {
  await disconnectBaileysSessionForOrg(orgId);
  await emitPublicWebhookEvent({
    orgId,
    type: "device.connection",
    payload: {
      status: "DISCONNECTED",
      action: "logout"
    }
  });
  return {
    disconnected: true
  };
}

export async function publicCheckNumber(orgId: string, phone: string): Promise<{
  phoneE164: string;
  jid: string;
  exists: boolean;
}> {
  await ensureBaileysConnectedForOrg(orgId);
  const normalizedPhone = normalizeWhatsAppDestination(phone);
  if (!normalizedPhone) {
    throw new ServiceError(400, "INVALID_PHONE_NUMBER", "Invalid phone number.");
  }
  const result = await checkBaileysContactNumber({
    orgId,
    phoneE164: normalizedPhone
  });
  return {
    phoneE164: result.phoneE164,
    jid: result.jid,
    exists: result.exists
  };
}

export async function publicListGroups(orgId: string) {
  await ensureBaileysConnectedForOrg(orgId);
  return listBaileysGroupsForOrg(orgId);
}

export async function publicListGroupMembers(orgId: string, groupId: string) {
  await ensureBaileysConnectedForOrg(orgId);
  return listBaileysGroupMembersForOrg({ orgId, groupId });
}

export async function publicGetMessageStatus(input: {
  orgId: string;
  messageId: string;
}): Promise<{
  messageId: string;
  status: string;
  deliveryStatus: string | null;
  sendError: string | null;
  sentAt: string | null;
  updatedAt: string | null;
}> {
  const messageId = normalize(input.messageId);
  if (!messageId) {
    throw new ServiceError(400, "INVALID_MESSAGE_ID", "messageId is required.");
  }

  const schedule = await prisma.orgWhatsAppPublicSchedule.findFirst({
    where: {
      orgId: input.orgId,
      id: messageId
    },
    select: {
      id: true,
      status: true,
      failureMessage: true,
      createdAt: true,
      updatedAt: true,
      sentAt: true
    }
  });

  if (schedule) {
    return {
      messageId: schedule.id,
      status: schedule.status,
      deliveryStatus: schedule.status === "SENT" ? "SENT" : null,
      sendError: schedule.failureMessage,
      sentAt: schedule.sentAt?.toISOString() ?? null,
      updatedAt: schedule.updatedAt.toISOString()
    };
  }

  const message = await prisma.message.findFirst({
    where: {
      orgId: input.orgId,
      OR: [{ id: messageId }, { waMessageId: messageId }]
    },
    select: {
      id: true,
      waMessageId: true,
      sendStatus: true,
      deliveryStatus: true,
      sendError: true,
      createdAt: true
    }
  });

  if (!message) {
    throw new ServiceError(404, "MESSAGE_NOT_FOUND", "Message not found.");
  }

  return {
    messageId: message.waMessageId ?? message.id,
    status: message.sendStatus ?? "UNKNOWN",
    deliveryStatus: message.deliveryStatus ?? null,
    sendError: message.sendError ?? null,
    sentAt: message.createdAt.toISOString(),
    updatedAt: message.createdAt.toISOString()
  };
}

export async function publicGetWebhook(orgId: string): Promise<OrgWhatsAppPublicWebhookView> {
  const row = await prisma.orgWhatsAppPublicWebhook.findUnique({
    where: { orgId },
    select: {
      url: true,
      enabled: true,
      eventFiltersJson: true,
      secretEnc: true,
      updatedAt: true
    }
  });

  if (!row) {
    return {
      url: null,
      enabled: false,
      eventFilters: [...DEFAULT_EVENT_FILTERS],
      updatedAt: null,
      hasSecret: false
    };
  }

  let eventFilters = [...DEFAULT_EVENT_FILTERS] as string[];
  try {
    const parsed = JSON.parse(row.eventFiltersJson ?? "[]") as unknown;
    eventFilters = parseEventFilters(parsed);
  } catch {
    eventFilters = [...DEFAULT_EVENT_FILTERS];
  }

  return {
    url: normalizeOptional(row.url),
    enabled: Boolean(row.enabled),
    eventFilters,
    updatedAt: row.updatedAt?.toISOString() ?? null,
    hasSecret: Boolean(row.secretEnc)
  };
}

export async function publicPutWebhook(input: {
  orgId: string;
  url?: unknown;
  enabled?: unknown;
  eventFilters?: unknown;
  regenerateSecret?: unknown;
}): Promise<OrgWhatsAppPublicWebhookView & { secret?: string }> {
  const url = ensureUrl(typeof input.url === "string" ? input.url.trim() : null);
  const enabled = Boolean(input.enabled);
  const eventFilters = parseEventFilters(input.eventFilters);
  const shouldRegenerateSecret = Boolean(input.regenerateSecret);
  const generatedSecret = shouldRegenerateSecret ? randomBytes(24).toString("base64url") : null;

  const row = await prisma.orgWhatsAppPublicWebhook.upsert({
    where: { orgId: input.orgId },
    update: {
      url,
      enabled,
      eventFiltersJson: JSON.stringify(eventFilters),
      ...(shouldRegenerateSecret ? { secretEnc: encryptSecret(generatedSecret as string) } : {})
    },
    create: {
      orgId: input.orgId,
      url,
      enabled,
      eventFiltersJson: JSON.stringify(eventFilters),
      secretEnc: generatedSecret ? encryptSecret(generatedSecret) : null
    },
    select: {
      url: true,
      enabled: true,
      eventFiltersJson: true,
      secretEnc: true,
      updatedAt: true
    }
  });

  return {
    url: normalizeOptional(row.url),
    enabled: Boolean(row.enabled),
    eventFilters,
    updatedAt: row.updatedAt?.toISOString() ?? null,
    hasSecret: Boolean(row.secretEnc),
    ...(generatedSecret ? { secret: generatedSecret } : {})
  };
}

export async function publicGetQrStatus(orgId: string): Promise<{
  orgId: string;
  connectionStatus: string;
  connected: boolean;
  qrCode: string | null;
  qrCodeExpiresAt: string | null;
}> {
  const status = await getBaileysQrStatusForOrg(orgId);
  return {
    orgId: status.orgId,
    connectionStatus: status.connectionStatus,
    connected: status.connected,
    qrCode: status.qrCode,
    qrCodeExpiresAt: status.qrCodeExpiresAt?.toISOString() ?? null
  };
}

export async function publicDeleteWebhook(orgId: string): Promise<{ deleted: boolean }> {
  const deleted = await prisma.orgWhatsAppPublicWebhook.deleteMany({
    where: { orgId }
  });
  return { deleted: deleted.count > 0 };
}

export async function ensurePublicApiConnectedOrThrow(orgId: string): Promise<void> {
  await ensureBaileysConnectedForOrg(orgId);
}

export function coercePublicScheduleDueAt(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  return new Date().toISOString();
}

export function parsePublicSendPayload(body: Record<string, unknown>): {
  to: string;
  text?: string;
  mediaUrl?: string;
  caption?: string;
  fileName?: string;
  mimeType?: string;
} {
  return {
    to: requireText(body.to, "to"),
    text: typeof body.text === "string" ? body.text : undefined,
    mediaUrl: typeof body.mediaUrl === "string" ? body.mediaUrl : undefined,
    caption: typeof body.caption === "string" ? body.caption : undefined,
    fileName: typeof body.fileName === "string" ? body.fileName : undefined,
    mimeType: typeof body.mimeType === "string" ? body.mimeType : undefined
  };
}
