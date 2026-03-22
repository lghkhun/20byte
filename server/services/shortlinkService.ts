import { prisma } from "@/lib/db/prisma";
import { canAccessOrganizationSettings } from "@/lib/permissions/orgPermissions";
import { deleteCachedKey } from "@/lib/redis/cache";
import {
  assertWhatsAppDestination,
  normalizeShortlinkValue,
  resolveShortlinkAttribution
} from "@/server/services/shortlink/policy";
import { ServiceError } from "@/server/services/serviceError";

type ShortlinkItem = {
  id: string;
  code: string;
  destinationUrl: string;
  waPhone: string | null;
  templateMessage: string | null;
  source: string;
  campaign: string | null;
  adset: string | null;
  ad: string | null;
  adName: string | null;
  platform: string | null;
  medium: string | null;
  isEnabled: boolean;
  disabledAt: Date | null;
  createdAt: Date;
  shortUrl: string;
  visitorCount: number;
};

type CreateShortlinkInput = {
  actorUserId: string;
  orgId: string;
  destinationUrl?: string;
  templateMessage?: string;
  source?: string;
  campaign?: string;
  adset?: string;
  ad?: string;
  adName?: string;
  platform?: string;
  medium?: string;
};

type UpdateShortlinkInput = {
  actorUserId: string;
  orgId: string;
  shortlinkId: string;
  templateMessage?: string;
  source?: string;
  campaign?: string;
  adset?: string;
  ad?: string;
  adName?: string;
  platform?: string;
  medium?: string;
};

const CODE_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
const CODE_LENGTH = 7;

function extractDigits(value: string): string {
  return value.replace(/\D/g, "");
}

function parseWhatsAppDestination(
  destinationUrl: string
): {
  waPhone: string | null;
  templateMessage: string | null;
} {
  const normalized = normalizeShortlinkValue(destinationUrl);
  if (!normalized) {
    return { waPhone: null, templateMessage: null };
  }

  try {
    const parsed = new URL(normalized);
    const host = parsed.hostname.toLowerCase();
    let waPhone = "";
    if (host === "wa.me") {
      waPhone = extractDigits(parsed.pathname.replace(/\//g, ""));
    } else if (host === "api.whatsapp.com") {
      waPhone = extractDigits(parsed.searchParams.get("phone") ?? "");
    }

    const templateMessage = normalizeShortlinkValue(parsed.searchParams.get("text") ?? "") || null;
    return {
      waPhone: waPhone || null,
      templateMessage
    };
  } catch {
    return { waPhone: null, templateMessage: null };
  }
}

function buildWhatsAppDestination(waPhone: string, templateMessage: string): string {
  const baseUrl = `https://wa.me/${waPhone}`;
  const normalizedTemplate = normalizeShortlinkValue(templateMessage);
  if (!normalizedTemplate) {
    return baseUrl;
  }

  return `${baseUrl}?text=${encodeURIComponent(normalizedTemplate)}`;
}

function normalizeDestinationToWaMe(destinationUrl: string): string {
  const normalized = normalizeShortlinkValue(destinationUrl);
  if (!normalized) {
    return normalized;
  }

  try {
    const url = new URL(normalized);
    const host = url.hostname.toLowerCase();
    if (host === "wa.me") {
      const waPhone = extractDigits(url.pathname.replace(/\//g, ""));
      if (!waPhone) {
        return normalized;
      }

      const text = normalizeShortlinkValue(url.searchParams.get("text") ?? "");
      return buildWhatsAppDestination(waPhone, text);
    }

    if (host === "api.whatsapp.com") {
      const waPhone = extractDigits(url.searchParams.get("phone") ?? "");
      if (!waPhone) {
        return normalized;
      }

      const text = normalizeShortlinkValue(url.searchParams.get("text") ?? "");
      return buildWhatsAppDestination(waPhone, text);
    }

    return normalized;
  } catch {
    return normalized;
  }
}

function getAppUrl(): string {
  const value = normalizeShortlinkValue(process.env.APP_URL) || normalizeShortlinkValue(process.env.NEXTAUTH_URL);
  return value || "http://localhost:3000";
}

function getShortlinkBaseUrl(): string {
  const configured = normalizeShortlinkValue(process.env.SHORTLINK_BASE_URL);
  if (configured) {
    return configured.replace(/\/$/, "");
  }

  return `${getAppUrl().replace(/\/$/, "")}/r`;
}

function buildShortUrl(code: string): string {
  return `${getShortlinkBaseUrl()}/${code}`;
}

function generateCode(): string {
  let output = "";
  for (let index = 0; index < CODE_LENGTH; index += 1) {
    const randomIndex = Math.floor(Math.random() * CODE_ALPHABET.length);
    output += CODE_ALPHABET[randomIndex];
  }

  return output;
}

async function requireShortlinkAccess(actorUserId: string, orgId: string): Promise<void> {
  const membership = await prisma.orgMember.findUnique({
    where: {
      orgId_userId: {
        orgId,
        userId: actorUserId
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
    throw new ServiceError(403, "FORBIDDEN_SHORTLINK_ACCESS", "Your role cannot manage shortlinks.");
  }
}

function mapShortlink(row: {
  id: string;
  code: string;
  destinationUrl: string;
  source: string;
  campaign: string | null;
  adset: string | null;
  adName: string | null;
  platform: string | null;
  medium: string | null;
  isEnabled: boolean;
  disabledAt: Date | null;
  createdAt: Date;
  _count: {
    clicks: number;
  };
}): ShortlinkItem {
  const parsedDestination = parseWhatsAppDestination(row.destinationUrl);
  return {
    id: row.id,
    code: row.code,
    destinationUrl: row.destinationUrl,
    waPhone: parsedDestination.waPhone,
    templateMessage: parsedDestination.templateMessage,
    source: row.source,
    campaign: row.campaign,
    adset: row.adset,
    ad: row.adName,
    adName: row.adName,
    platform: row.platform,
    medium: row.medium,
    isEnabled: row.isEnabled,
    disabledAt: row.disabledAt,
    createdAt: row.createdAt,
    shortUrl: buildShortUrl(row.code),
    visitorCount: row._count.clicks
  };
}

const shortlinkSelect = {
  id: true,
  code: true,
  destinationUrl: true,
  source: true,
  campaign: true,
  adset: true,
  adName: true,
  platform: true,
  medium: true,
  isEnabled: true,
  disabledAt: true,
  createdAt: true,
  _count: {
    select: {
      clicks: true
    }
  }
} as const;

async function findShortlinkByIdInOrg(orgId: string, shortlinkId: string) {
  return prisma.shortlink.findFirst({
    where: {
      orgId,
      id: shortlinkId
    },
    select: shortlinkSelect
  });
}

async function clearShortlinkCache(code: string): Promise<void> {
  const variants = Array.from(new Set([code, code.toLowerCase(), code.toUpperCase()]));
  await Promise.all(variants.map((candidate) => deleteCachedKey(`cache:shortlink:${candidate}`)));
}

export async function listShortlinks(actorUserId: string, orgIdInput: string): Promise<ShortlinkItem[]> {
  const orgId = normalizeShortlinkValue(orgIdInput);
  if (!orgId) {
    throw new ServiceError(400, "MISSING_ORG_ID", "orgId is required.");
  }

  await requireShortlinkAccess(actorUserId, orgId);

  const rows = await prisma.shortlink.findMany({
    where: {
      orgId
    },
    orderBy: {
      createdAt: "desc"
    },
    select: shortlinkSelect
  });

  return rows.map(mapShortlink);
}

export async function createShortlink(input: CreateShortlinkInput): Promise<ShortlinkItem> {
  const orgId = normalizeShortlinkValue(input.orgId);
  const requestedDestinationUrl = normalizeShortlinkValue(input.destinationUrl);
  const templateMessage = normalizeShortlinkValue(input.templateMessage);
  const attribution = resolveShortlinkAttribution({
    source: input.source,
    campaign: input.campaign,
    adset: input.adset,
    ad: input.ad,
    adName: input.adName,
    platform: input.platform,
    medium: input.medium
  });

  if (!orgId) {
    throw new ServiceError(400, "MISSING_ORG_ID", "orgId is required.");
  }

  await requireShortlinkAccess(input.actorUserId, orgId);

  let destinationUrl = requestedDestinationUrl;
  if (!destinationUrl) {
    const connectedAccount = await prisma.waAccount.findFirst({
      where: {
        orgId,
        metaBusinessId: "baileys",
        wabaId: "baileys"
      },
      orderBy: { connectedAt: "desc" },
      select: {
        displayPhone: true
      }
    });

    const waPhone = extractDigits(connectedAccount?.displayPhone ?? "");
    if (!waPhone) {
      throw new ServiceError(
        400,
        "BAILEYS_NUMBER_NOT_CONNECTED",
        "Connect a Baileys WhatsApp number first to generate wa.me shortlinks automatically."
      );
    }

    destinationUrl = buildWhatsAppDestination(waPhone, templateMessage);
  }

  assertWhatsAppDestination(destinationUrl);
  destinationUrl = normalizeDestinationToWaMe(destinationUrl);

  let code = "";
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = generateCode();
    const existing = await prisma.shortlink.findUnique({
      where: {
        code: candidate
      },
      select: {
        id: true
      }
    });

    if (!existing) {
      code = candidate;
      break;
    }
  }

  if (!code) {
    throw new ServiceError(500, "SHORTLINK_CODE_GENERATION_FAILED", "Failed to generate unique shortlink code.");
  }

  const created = await prisma.shortlink.create({
    data: {
      orgId,
      code,
      destinationUrl,
      source: attribution.source,
      campaign: attribution.campaign,
      adset: attribution.adset,
      adName: attribution.adName,
      platform: attribution.platform,
      medium: attribution.medium
    },
    select: shortlinkSelect
  });

  return mapShortlink(created);
}

export async function updateShortlink(input: UpdateShortlinkInput): Promise<ShortlinkItem> {
  const orgId = normalizeShortlinkValue(input.orgId);
  const shortlinkId = normalizeShortlinkValue(input.shortlinkId);
  if (!orgId) {
    throw new ServiceError(400, "MISSING_ORG_ID", "orgId is required.");
  }
  if (!shortlinkId) {
    throw new ServiceError(400, "MISSING_SHORTLINK_ID", "shortlinkId is required.");
  }

  await requireShortlinkAccess(input.actorUserId, orgId);
  const existing = await findShortlinkByIdInOrg(orgId, shortlinkId);
  if (!existing) {
    throw new ServiceError(404, "SHORTLINK_NOT_FOUND", "Shortlink does not exist.");
  }

  const attribution = resolveShortlinkAttribution({
    source: input.source ?? existing.source,
    campaign: input.campaign ?? existing.campaign ?? undefined,
    adset: input.adset ?? existing.adset ?? undefined,
    ad: input.ad ?? undefined,
    adName: input.adName ?? existing.adName ?? undefined,
    platform: input.platform ?? existing.platform ?? undefined,
    medium: input.medium ?? existing.medium ?? undefined
  });

  const existingDestination = parseWhatsAppDestination(existing.destinationUrl);
  const waPhone = existingDestination.waPhone;
  if (!waPhone) {
    throw new ServiceError(400, "INVALID_DESTINATION_URL", "Existing shortlink destination is invalid.");
  }

  const resolvedTemplate =
    input.templateMessage !== undefined
      ? normalizeShortlinkValue(input.templateMessage)
      : normalizeShortlinkValue(existingDestination.templateMessage ?? "");
  const destinationUrl = buildWhatsAppDestination(waPhone, resolvedTemplate);

  const updated = await prisma.shortlink.update({
    where: {
      id: existing.id
    },
    data: {
      destinationUrl,
      source: attribution.source,
      campaign: attribution.campaign,
      adset: attribution.adset,
      adName: attribution.adName,
      platform: attribution.platform,
      medium: attribution.medium
    },
    select: shortlinkSelect
  });

  await clearShortlinkCache(updated.code);
  return mapShortlink(updated);
}

export async function setShortlinkEnabled(
  actorUserId: string,
  orgIdInput: string,
  shortlinkIdInput: string,
  isEnabled: boolean
): Promise<ShortlinkItem> {
  const orgId = normalizeShortlinkValue(orgIdInput);
  const shortlinkId = normalizeShortlinkValue(shortlinkIdInput);

  if (!orgId) {
    throw new ServiceError(400, "MISSING_ORG_ID", "orgId is required.");
  }

  if (!shortlinkId) {
    throw new ServiceError(400, "MISSING_SHORTLINK_ID", "shortlinkId is required.");
  }

  await requireShortlinkAccess(actorUserId, orgId);

  const existing = await findShortlinkByIdInOrg(orgId, shortlinkId);

  if (!existing) {
    throw new ServiceError(404, "SHORTLINK_NOT_FOUND", "Shortlink does not exist.");
  }

  const updateResult = await prisma.shortlink.updateMany({
    where: {
      id: existing.id,
      orgId
    },
    data: {
      isEnabled,
      disabledAt: isEnabled ? null : new Date()
    }
  });

  if (updateResult.count !== 1) {
    throw new ServiceError(404, "SHORTLINK_NOT_FOUND", "Shortlink does not exist.");
  }

  const updated = await findShortlinkByIdInOrg(orgId, existing.id);

  if (!updated) {
    throw new ServiceError(404, "SHORTLINK_NOT_FOUND", "Shortlink does not exist.");
  }

  await clearShortlinkCache(updated.code);

  return mapShortlink(updated);
}

export async function disableShortlink(actorUserId: string, orgIdInput: string, shortlinkIdInput: string): Promise<ShortlinkItem> {
  return setShortlinkEnabled(actorUserId, orgIdInput, shortlinkIdInput, false);
}

export async function deleteShortlink(actorUserId: string, orgIdInput: string, shortlinkIdInput: string): Promise<void> {
  const orgId = normalizeShortlinkValue(orgIdInput);
  const shortlinkId = normalizeShortlinkValue(shortlinkIdInput);

  if (!orgId) {
    throw new ServiceError(400, "MISSING_ORG_ID", "orgId is required.");
  }
  if (!shortlinkId) {
    throw new ServiceError(400, "MISSING_SHORTLINK_ID", "shortlinkId is required.");
  }

  await requireShortlinkAccess(actorUserId, orgId);
  const existing = await findShortlinkByIdInOrg(orgId, shortlinkId);
  if (!existing) {
    throw new ServiceError(404, "SHORTLINK_NOT_FOUND", "Shortlink does not exist.");
  }

  await prisma.shortlinkClick.deleteMany({
    where: {
      shortlinkId: existing.id
    }
  });
  await prisma.shortlink.delete({
    where: {
      id: existing.id
    }
  });
  await clearShortlinkCache(existing.code);
}
