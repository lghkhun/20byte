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
};

type CreateShortlinkInput = {
  actorUserId: string;
  orgId: string;
  destinationUrl: string;
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
}): ShortlinkItem {
  return {
    id: row.id,
    code: row.code,
    destinationUrl: row.destinationUrl,
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
    shortUrl: buildShortUrl(row.code)
  };
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
    select: {
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
      createdAt: true
    }
  });

  return rows.map(mapShortlink);
}

export async function createShortlink(input: CreateShortlinkInput): Promise<ShortlinkItem> {
  const orgId = normalizeShortlinkValue(input.orgId);
  const destinationUrl = normalizeShortlinkValue(input.destinationUrl);
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

  if (!destinationUrl) {
    throw new ServiceError(400, "MISSING_DESTINATION_URL", "destinationUrl is required.");
  }

  assertWhatsAppDestination(destinationUrl);
  await requireShortlinkAccess(input.actorUserId, orgId);

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
      // Keep schema-v1 compatibility fields in sync.
      platform: attribution.adset,
      medium: attribution.adName
    },
    select: {
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
      createdAt: true
    }
  });

  return mapShortlink(created);
}

export async function disableShortlink(actorUserId: string, orgIdInput: string, shortlinkIdInput: string): Promise<ShortlinkItem> {
  const orgId = normalizeShortlinkValue(orgIdInput);
  const shortlinkId = normalizeShortlinkValue(shortlinkIdInput);

  if (!orgId) {
    throw new ServiceError(400, "MISSING_ORG_ID", "orgId is required.");
  }

  if (!shortlinkId) {
    throw new ServiceError(400, "MISSING_SHORTLINK_ID", "shortlinkId is required.");
  }

  await requireShortlinkAccess(actorUserId, orgId);

  const existing = await prisma.shortlink.findFirst({
    where: {
      id: shortlinkId,
      orgId
    },
    select: {
      id: true
    }
  });

  if (!existing) {
    throw new ServiceError(404, "SHORTLINK_NOT_FOUND", "Shortlink does not exist.");
  }

  const updateResult = await prisma.shortlink.updateMany({
    where: {
      id: existing.id,
      orgId
    },
    data: {
      isEnabled: false,
      disabledAt: new Date()
    }
  });

  if (updateResult.count !== 1) {
    throw new ServiceError(404, "SHORTLINK_NOT_FOUND", "Shortlink does not exist.");
  }

  const updated = await prisma.shortlink.findFirst({
    where: {
      id: existing.id,
      orgId
    },
    select: {
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
      createdAt: true
    }
  });

  if (!updated) {
    throw new ServiceError(404, "SHORTLINK_NOT_FOUND", "Shortlink does not exist.");
  }

  const cacheKey = `cache:shortlink:${updated.code}`;
  await deleteCachedKey(cacheKey);

  return mapShortlink(updated);
}
