import type { Role } from "@prisma/client";
import { randomUUID } from "crypto";

import { prisma } from "@/lib/db/prisma";
import { canAccessOrganizationSettings } from "@/lib/permissions/orgPermissions";
import { encryptSensitiveToken } from "@/lib/security/tokenCipher";
import { decryptSensitiveToken } from "@/lib/security/tokenCipher";
import { isWhatsAppMockModeEnabled } from "@/lib/whatsapp/mockMode";
import { enqueueWhatsAppWebhookJob } from "@/server/queues/webhookQueue";
import { writeAuditLogSafe } from "@/server/services/auditLogService";
import { ServiceError } from "@/server/services/serviceError";
import { sendWhatsAppTextMessage } from "@/server/services/whatsappApiService";

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
  postConnect: {
    webhookVerified: boolean;
    testEventTriggered: boolean;
  };
};

type SendOnboardingTestMessageInput = {
  actorUserId: string;
  orgId: string;
  toPhoneE164: string;
};

type TestMessageResult = {
  orgId: string;
  toPhoneE164: string;
  waMessageId: string | null;
  sentAt: Date;
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

  const existingAcrossOrg = await prisma.waAccount.findFirst({
    where: {
      phoneNumberId,
      NOT: {
        orgId
      }
    },
    select: {
      id: true,
      orgId: true
    }
  });

  if (existingAcrossOrg) {
    throw new ServiceError(
      400,
      "WHATSAPP_NUMBER_USED_BY_OTHER_ORG",
      "This WhatsApp phone number is already connected to another organization."
    );
  }

  const accessTokenEnc = encryptSensitiveToken(accessToken);

  let account: {
    id: string;
    orgId: string;
    metaBusinessId: string;
    wabaId: string;
    phoneNumberId: string;
    displayPhone: string;
    connectedAt: Date;
  };
  if (existingForOrg) {
    const updated = await prisma.waAccount.updateMany({
      where: {
        id: existingForOrg.id,
        orgId
      },
      data: {
        metaBusinessId,
        wabaId,
        phoneNumberId,
        displayPhone,
        accessTokenEnc,
        connectedAt: new Date()
      }
    });
    if (updated.count !== 1) {
      throw new ServiceError(404, "WHATSAPP_ACCOUNT_NOT_FOUND", "WhatsApp account does not exist.");
    }

    const refreshed = await prisma.waAccount.findFirst({
      where: {
        id: existingForOrg.id,
        orgId
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

    if (!refreshed) {
      throw new ServiceError(404, "WHATSAPP_ACCOUNT_NOT_FOUND", "WhatsApp account does not exist.");
    }
    account = refreshed;
  } else {
    account = await prisma.waAccount.create({
        data: {
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
  }

  const webhookVerified = Boolean(process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN?.trim() && process.env.WHATSAPP_APP_SECRET?.trim());
  let testEventTriggered = false;
  try {
    await enqueueWhatsAppWebhookJob({
      object: "whatsapp_business_account",
      entry: [
        {
          changes: [
            {
              value: {
                metadata: {
                  phone_number_id: phoneNumberId
                },
                messages: [
                  {
                    id: `post-connect-${randomUUID()}`,
                    from: "+10000000000",
                    type: "text",
                    text: {
                      body: "post-connect-health-check"
                    }
                  }
                ]
              }
            }
          ]
        }
      ]
    });
    testEventTriggered = true;
  } catch {
    testEventTriggered = false;
  }

  await writeAuditLogSafe({
    orgId,
    actorUserId: input.actorUserId,
    action: "whatsapp.connected",
    entityType: "wa_account",
    entityId: account.id,
    meta: {
      phoneNumberId: account.phoneNumberId,
      displayPhone: account.displayPhone,
      wabaId: account.wabaId,
      metaBusinessId: account.metaBusinessId
    }
  });

  return {
    ...account,
    postConnect: {
      webhookVerified,
      testEventTriggered
    }
  };
}

const PHONE_E164_REGEX = /^\+[1-9]\d{7,14}$/;

export async function sendOnboardingTestMessage(input: SendOnboardingTestMessageInput): Promise<TestMessageResult> {
  const orgId = sanitize(input.orgId);
  const toPhoneE164 = sanitize(input.toPhoneE164);

  if (!orgId) {
    throw new ServiceError(400, "MISSING_ORG_ID", "orgId is required.");
  }

  if (!PHONE_E164_REGEX.test(toPhoneE164)) {
    throw new ServiceError(400, "INVALID_PHONE_E164", "toPhoneE164 must be E.164 format (example: +628123456789).");
  }

  await requireSettingsAccess(input.actorUserId, orgId);

  const waAccount = await prisma.waAccount.findFirst({
    where: {
      orgId
    },
    orderBy: {
      connectedAt: "desc"
    },
    select: {
      phoneNumberId: true,
      accessTokenEnc: true
    }
  });

  if (!waAccount) {
    if (!isWhatsAppMockModeEnabled()) {
      throw new ServiceError(400, "WHATSAPP_NOT_CONNECTED", "WhatsApp account is not connected for this organization.");
    }
  }

  const accessToken = waAccount ? decryptSensitiveToken(waAccount.accessTokenEnc) : "mock-access-token";
  const phoneNumberId = waAccount?.phoneNumberId ?? "mock-phone-number-id";
  const sentAt = new Date();
  const waMessageId = await sendWhatsAppTextMessage({
    accessToken,
    phoneNumberId,
    to: toPhoneE164,
    text: "20byte onboarding verification message. [Automated]"
  });

  return {
    orgId,
    toPhoneE164,
    waMessageId,
    sentAt
  };
}
