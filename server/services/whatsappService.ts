import { Role } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { canAccessOrganizationSettings } from "@/lib/permissions/orgPermissions";
import { encryptSensitiveToken } from "@/lib/security/tokenCipher";
import { ServiceError } from "@/server/services/serviceError";

type EmbeddedSignupContext = {
  orgId: string;
  appId: string | null;
  configId: string | null;
  callbackPath: string;
  state: string;
  connectedAccount: {
    id: string;
    displayPhone: string;
    phoneNumberId: string;
    connectedAt: Date;
  } | null;
};

type CompleteEmbeddedSignupInput = {
  actorUserId: string;
  orgId: string;
  metaBusinessId: string;
  wabaId: string;
  phoneNumberId: string;
  displayPhone: string;
  accessToken: string;
};

type WaAccountSummary = {
  id: string;
  orgId: string;
  metaBusinessId: string;
  wabaId: string;
  phoneNumberId: string;
  displayPhone: string;
  connectedAt: Date;
};

function sanitize(value: string): string {
  return value.trim();
}

async function requireSettingsAccess(userId: string, orgId: string): Promise<{ role: Role }> {
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

  return membership;
}

function buildEmbeddedSignupState(orgId: string): string {
  return `${orgId}:${Date.now()}`;
}

export async function getEmbeddedSignupContext(
  actorUserId: string,
  orgId: string
): Promise<EmbeddedSignupContext> {
  await requireSettingsAccess(actorUserId, orgId);

  const connectedAccount = await prisma.waAccount.findFirst({
    where: {
      orgId
    },
    select: {
      id: true,
      displayPhone: true,
      phoneNumberId: true,
      connectedAt: true
    },
    orderBy: {
      connectedAt: "desc"
    }
  });

  return {
    orgId,
    appId: process.env.WHATSAPP_EMBEDDED_APP_ID ?? null,
    configId: process.env.WHATSAPP_EMBEDDED_CONFIG_ID ?? null,
    callbackPath: "/api/whatsapp/embedded-signup",
    state: buildEmbeddedSignupState(orgId),
    connectedAccount
  };
}

export async function completeEmbeddedSignup(input: CompleteEmbeddedSignupInput): Promise<WaAccountSummary> {
  const orgId = sanitize(input.orgId);
  const metaBusinessId = sanitize(input.metaBusinessId);
  const wabaId = sanitize(input.wabaId);
  const phoneNumberId = sanitize(input.phoneNumberId);
  const displayPhone = sanitize(input.displayPhone);
  const accessToken = sanitize(input.accessToken);

  if (!orgId || !metaBusinessId || !wabaId || !phoneNumberId || !displayPhone || !accessToken) {
    throw new ServiceError(400, "INVALID_WHATSAPP_CONNECTION_PAYLOAD", "All WhatsApp connection fields are required.");
  }

  await requireSettingsAccess(input.actorUserId, orgId);

  const existingForOrg = await prisma.waAccount.findFirst({
    where: {
      orgId
    },
    select: {
      id: true,
      phoneNumberId: true
    }
  });

  if (existingForOrg && existingForOrg.phoneNumberId !== phoneNumberId) {
    throw new ServiceError(
      400,
      "WHATSAPP_NUMBER_ALREADY_CONNECTED",
      "This organization already has a different WhatsApp number connected."
    );
  }

  const accessTokenEnc = encryptSensitiveToken(accessToken);

  const account = await prisma.waAccount.upsert({
    where: {
      orgId_phoneNumberId: {
        orgId,
        phoneNumberId
      }
    },
    update: {
      metaBusinessId,
      wabaId,
      displayPhone,
      accessTokenEnc,
      connectedAt: new Date()
    },
    create: {
      orgId,
      metaBusinessId,
      wabaId,
      phoneNumberId,
      displayPhone,
      accessTokenEnc
    },
    select: {
      id: true,
      orgId: true,
      metaBusinessId: true,
      wabaId: true,
      phoneNumberId: true,
      displayPhone: true,
      connectedAt: true
    }
  });

  return account;
}
