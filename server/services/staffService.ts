import { Role } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { normalizeAndValidateEmail } from "@/lib/validation/formValidation";
import { normalizeWhatsAppDestination } from "@/lib/whatsapp/e164";
import { sendBaileysTextMessage } from "@/server/services/baileysService";
import { createAccountSetupToken } from "@/server/services/accountSetupService";
import { ServiceError } from "@/server/services/serviceError";

const CREATABLE_STAFF_ROLES = new Set<Role>([Role.CS, Role.ADVERTISER]);

function normalize(value: string): string {
  return value.trim();
}

async function requireOwner(actorUserId: string, orgId: string) {
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

  if (membership.role !== Role.OWNER) {
    throw new ServiceError(403, "FORBIDDEN_OWNER_ONLY", "Only owner can manage staff onboarding.");
  }
}

function buildSetupMessage(name: string | null, setupLink: string): string {
  const displayName = name?.trim() || "tim";
  return `Halo ${displayName}, akun 20byte kamu sudah dibuat. Lanjutkan aktivasi password di link ini: ${setupLink}`;
}

async function sendSetupLinkViaWhatsApp(input: {
  orgId: string;
  phoneE164: string;
  setupLink: string;
  name: string | null;
}): Promise<boolean> {
  try {
    await sendBaileysTextMessage({
      orgId: input.orgId,
      toPhoneE164: input.phoneE164,
      text: buildSetupMessage(input.name, input.setupLink)
    });
    return true;
  } catch {
    return false;
  }
}

export async function createOrganizationStaff(input: {
  actorUserId: string;
  orgId: string;
  name: string;
  email: string;
  phone: string;
  role: Role;
}) {
  const orgId = normalize(input.orgId);
  const name = normalize(input.name);
  if (!orgId) {
    throw new ServiceError(400, "MISSING_ORG_ID", "orgId is required.");
  }
  if (!name) {
    throw new ServiceError(400, "INVALID_NAME", "name is required.");
  }

  await requireOwner(input.actorUserId, orgId);

  if (!CREATABLE_STAFF_ROLES.has(input.role)) {
    throw new ServiceError(400, "INVALID_STAFF_ROLE", "Staff role must be CS or ADVERTISER.");
  }

  const email = normalizeAndValidateEmail(input.email);
  const phoneE164 = normalizeWhatsAppDestination(input.phone);
  if (!phoneE164) {
    throw new ServiceError(400, "INVALID_PHONE", "Valid WhatsApp phone is required.");
  }

  const existingByEmail = await prisma.user.findUnique({
    where: { email },
    select: { id: true }
  });
  if (existingByEmail) {
    throw new ServiceError(409, "EMAIL_ALREADY_REGISTERED", "Email is already registered.");
  }

  const existingByPhone = await prisma.user.findUnique({
    where: { phoneE164 },
    select: { id: true }
  });
  if (existingByPhone) {
    throw new ServiceError(409, "PHONE_ALREADY_REGISTERED", "WhatsApp number is already registered.");
  }

  const created = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email,
        phoneE164,
        name,
        passwordHash: null
      },
      select: {
        id: true,
        email: true,
        phoneE164: true,
        name: true
      }
    });

    await tx.orgMember.create({
      data: {
        orgId,
        userId: user.id,
        role: input.role
      }
    });

    return user;
  });

  const tokenInfo = await createAccountSetupToken({
    userId: created.id,
    orgId,
    createdByUserId: input.actorUserId
  });

  const whatsappDelivery = await sendSetupLinkViaWhatsApp({
    orgId,
    phoneE164,
    setupLink: tokenInfo.setupLink,
    name: created.name
  });

  return {
    staff: {
      id: created.id,
      email: created.email,
      phoneE164: created.phoneE164,
      name: created.name,
      role: input.role
    },
    setup: {
      setupLink: tokenInfo.setupLink,
      expiresAt: tokenInfo.expiresAt,
      whatsappDelivery
    }
  };
}

export async function resendOrganizationStaffSetupLink(input: {
  actorUserId: string;
  orgId: string;
  userId: string;
}) {
  const orgId = normalize(input.orgId);
  const userId = normalize(input.userId);
  if (!orgId || !userId) {
    throw new ServiceError(400, "INVALID_RESEND_INPUT", "orgId and userId are required.");
  }

  await requireOwner(input.actorUserId, orgId);

  const membership = await prisma.orgMember.findUnique({
    where: {
      orgId_userId: {
        orgId,
        userId
      }
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          phoneE164: true,
          name: true
        }
      }
    }
  });

  if (!membership) {
    throw new ServiceError(404, "STAFF_NOT_FOUND", "Staff member not found.");
  }

  if (!CREATABLE_STAFF_ROLES.has(membership.role)) {
    throw new ServiceError(400, "INVALID_STAFF_ROLE", "Only CS or ADVERTISER setup can be resent.");
  }

  if (!membership.user.phoneE164) {
    throw new ServiceError(400, "STAFF_PHONE_MISSING", "Staff phone is not configured.");
  }

  const tokenInfo = await createAccountSetupToken({
    userId,
    orgId,
    createdByUserId: input.actorUserId
  });

  const whatsappDelivery = await sendSetupLinkViaWhatsApp({
    orgId,
    phoneE164: membership.user.phoneE164,
    setupLink: tokenInfo.setupLink,
    name: membership.user.name
  });

  return {
    userId,
    setupLink: tokenInfo.setupLink,
    expiresAt: tokenInfo.expiresAt,
    whatsappDelivery
  };
}
