import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { Prisma } from "@prisma/client";
import type { Role } from "@prisma/client";

import { getAuthSecret } from "@/lib/env";
import { prisma } from "@/lib/db/prisma";
import { canAccessOrganizationSettings } from "@/lib/permissions/orgPermissions";
import { resolvePrimaryOrganizationIdForUser } from "@/server/services/organizationService";
import { ServiceError } from "@/server/services/serviceError";

type MetaIntegrationRow = {
  id: string;
  orgId: string;
  pixelId: string;
  accessTokenEnc: string;
  testEventCode: string | null;
  isEnabled: number | boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type MetaIntegrationView = {
  orgId: string;
  pixelId: string;
  testEventCode: string | null;
  enabled: boolean;
  hasAccessToken: boolean;
  updatedAt: string | null;
};

type UpsertMetaIntegrationInput = {
  actorUserId: string;
  orgId?: string;
  pixelId: string;
  accessToken?: string;
  testEventCode?: string | null;
  enabled: boolean;
};

const ENC_VERSION = "v1";

function normalizeOptional(value: string | null | undefined): string | null {
  const normalized = value?.trim() ?? "";
  return normalized ? normalized : null;
}

function normalizeRequired(value: string, fieldName: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new ServiceError(400, "INVALID_META_CONFIG", `${fieldName} is required.`);
  }
  return normalized;
}

async function requireOrgSettingsAccess(userId: string, orgId: string) {
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

  if (!canAccessOrganizationSettings(membership.role as Role)) {
    throw new ServiceError(403, "FORBIDDEN_SETTINGS_ACCESS", "Your role cannot manage Meta integration.");
  }
}

function getEncryptionKey(): Buffer {
  return createHash("sha256").update(getAuthSecret()).digest();
}

function encryptSecret(value: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${ENC_VERSION}:${iv.toString("base64url")}:${tag.toString("base64url")}:${encrypted.toString("base64url")}`;
}

function decryptSecret(value: string): string {
  const [version, ivPart, tagPart, encryptedPart] = value.split(":");
  if (version !== ENC_VERSION || !ivPart || !tagPart || !encryptedPart) {
    throw new ServiceError(500, "META_SECRET_DECRYPT_FAILED", "Stored secret format is invalid.");
  }

  const key = getEncryptionKey();
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivPart, "base64url"));
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(encryptedPart, "base64url")), decipher.final()]);
  return decrypted.toString("utf8");
}

function mapRowToView(row: MetaIntegrationRow): MetaIntegrationView {
  return {
    orgId: row.orgId,
    pixelId: row.pixelId,
    testEventCode: row.testEventCode,
    enabled: Boolean(row.isEnabled),
    hasAccessToken: Boolean(row.accessTokenEnc),
    updatedAt: row.updatedAt?.toISOString?.() ?? null
  };
}

async function findIntegration(orgId: string): Promise<MetaIntegrationRow | null> {
  const rows = await prisma.$queryRaw<MetaIntegrationRow[]>(Prisma.sql`
    SELECT id, orgId, pixelId, accessTokenEnc, testEventCode, isEnabled, createdAt, updatedAt
    FROM MetaIntegration
    WHERE orgId = ${orgId}
    LIMIT 1
  `);
  return rows[0] ?? null;
}

export async function getMetaIntegration(actorUserId: string, candidateOrgId = ""): Promise<MetaIntegrationView | null> {
  const orgId = await resolvePrimaryOrganizationIdForUser(actorUserId, candidateOrgId);
  await requireOrgSettingsAccess(actorUserId, orgId);
  const row = await findIntegration(orgId);
  return row ? mapRowToView(row) : null;
}

export async function upsertMetaIntegration(input: UpsertMetaIntegrationInput): Promise<MetaIntegrationView> {
  const orgId = await resolvePrimaryOrganizationIdForUser(input.actorUserId, input.orgId?.trim() ?? "");
  await requireOrgSettingsAccess(input.actorUserId, orgId);

  const pixelId = normalizeRequired(input.pixelId, "pixelId");
  const testEventCode = normalizeOptional(input.testEventCode);
  const accessToken = normalizeOptional(input.accessToken);

  const existing = await findIntegration(orgId);
  if (!existing) {
    if (!accessToken) {
      throw new ServiceError(400, "INVALID_META_CONFIG", "accessToken is required for first-time setup.");
    }

    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO MetaIntegration (id, orgId, pixelId, accessTokenEnc, testEventCode, isEnabled, createdAt, updatedAt)
      VALUES (${randomBytes(12).toString("hex")}, ${orgId}, ${pixelId}, ${encryptSecret(accessToken)}, ${testEventCode}, ${input.enabled}, NOW(3), NOW(3))
    `);
  } else {
    const encryptedToken = accessToken ? encryptSecret(accessToken) : existing.accessTokenEnc;
    await prisma.$executeRaw(Prisma.sql`
      UPDATE MetaIntegration
      SET pixelId = ${pixelId},
          accessTokenEnc = ${encryptedToken},
          testEventCode = ${testEventCode},
          isEnabled = ${input.enabled},
          updatedAt = NOW(3)
      WHERE orgId = ${orgId}
    `);
  }

  const saved = await findIntegration(orgId);
  if (!saved) {
    throw new ServiceError(500, "META_CONFIG_SAVE_FAILED", "Failed to save Meta integration settings.");
  }
  return mapRowToView(saved);
}

export async function getMetaAccessToken(actorUserId: string, candidateOrgId = ""): Promise<string | null> {
  const orgId = await resolvePrimaryOrganizationIdForUser(actorUserId, candidateOrgId);
  await requireOrgSettingsAccess(actorUserId, orgId);
  const row = await findIntegration(orgId);
  if (!row?.accessTokenEnc) {
    return null;
  }
  return decryptSecret(row.accessTokenEnc);
}
