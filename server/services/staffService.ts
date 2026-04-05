import { Role } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { normalizeAndValidateEmail } from "@/lib/validation/formValidation";
import { normalizeWhatsAppDestination } from "@/lib/whatsapp/e164";
import { sendBaileysTextMessage } from "@/server/services/baileysService";
import { createAccountSetupToken } from "@/server/services/accountSetupService";
import { sendTransactionalEmail } from "@/server/services/emailService";
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

function formatRoleLabel(role: Role): string {
  if (role === Role.ADVERTISER) {
    return "Advertiser";
  }

  return "Customer Service (CS)";
}

function buildSetupMailtoUrl(input: {
  email: string;
  name: string | null;
  orgName: string;
  role: Role;
  setupLink: string;
  expiresAt: Date;
}): string {
  const subject = `Undangan bergabung di ${input.orgName} via 20byte`;
  const expiresAtLabel = new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(input.expiresAt);
  const body = [
    `Halo ${input.name?.trim() || "Tim"},`,
    "",
    `Anda diundang untuk bergabung ke bisnis "${input.orgName}" sebagai ${formatRoleLabel(input.role)}.`,
    "Silakan aktivasi akun melalui link berikut:",
    input.setupLink,
    "",
    `Link berlaku sampai ${expiresAtLabel}.`,
    "",
    "Terima kasih."
  ].join("\n");

  return `mailto:${encodeURIComponent(input.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function buildSetupEmailPayload(input: {
  orgName: string;
  role: Role;
  setupLink: string;
  expiresAt: Date;
  name: string | null;
}): { subject: string; text: string; html: string } {
  const subject = `Undangan bergabung di ${input.orgName} via 20byte`;
  const expiresAtLabel = new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(input.expiresAt);
  const greeting = input.name?.trim() || "Tim";
  const roleLabel = formatRoleLabel(input.role);
  const text = [
    `Halo ${greeting},`,
    "",
    `Anda diundang untuk bergabung ke bisnis "${input.orgName}" sebagai ${roleLabel}.`,
    "Silakan aktivasi akun melalui link berikut:",
    input.setupLink,
    "",
    `Link berlaku sampai ${expiresAtLabel}.`,
    "",
    "Terima kasih."
  ].join("\n");
  const html = `
    <div style="font-family:Arial,sans-serif;color:#111827;line-height:1.6">
      <p>Halo ${greeting},</p>
      <p>Anda diundang untuk bergabung ke bisnis <strong>${input.orgName}</strong> sebagai <strong>${roleLabel}</strong>.</p>
      <p>Silakan aktivasi akun Anda melalui tombol berikut:</p>
      <p>
        <a href="${input.setupLink}" style="display:inline-block;padding:10px 16px;background:#10b981;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600">
          Aktivasi Akun
        </a>
      </p>
      <p>Atau buka link ini langsung:</p>
      <p><a href="${input.setupLink}">${input.setupLink}</a></p>
      <p style="color:#6b7280">Link berlaku sampai ${expiresAtLabel}.</p>
    </div>
  `.trim();

  return { subject, text, html };
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
  const organization = await prisma.org.findUnique({
    where: { id: orgId },
    select: { name: true }
  });
  if (!organization) {
    throw new ServiceError(404, "ORG_NOT_FOUND", "Organization not found.");
  }

  const whatsappDelivery = await sendSetupLinkViaWhatsApp({
    orgId,
    phoneE164,
    setupLink: tokenInfo.setupLink,
    name: created.name
  });
  const emailPayload = buildSetupEmailPayload({
    orgName: organization.name,
    role: input.role,
    setupLink: tokenInfo.setupLink,
    expiresAt: tokenInfo.expiresAt,
    name: created.name
  });
  let emailDelivery = false;
  try {
    await sendTransactionalEmail({
      to: created.email,
      subject: emailPayload.subject,
      text: emailPayload.text,
      html: emailPayload.html
    });
    emailDelivery = true;
  } catch {
    emailDelivery = false;
  }

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
      whatsappDelivery,
      emailDelivery,
      mailtoUrl: buildSetupMailtoUrl({
        email: created.email,
        name: created.name,
        orgName: organization.name,
        role: input.role,
        setupLink: tokenInfo.setupLink,
        expiresAt: tokenInfo.expiresAt
      })
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
      },
      org: {
        select: {
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

  const tokenInfo = await createAccountSetupToken({
    userId,
    orgId,
    createdByUserId: input.actorUserId
  });

  let whatsappDelivery: boolean | null = null;
  if (membership.user.phoneE164) {
    whatsappDelivery = await sendSetupLinkViaWhatsApp({
      orgId,
      phoneE164: membership.user.phoneE164,
      setupLink: tokenInfo.setupLink,
      name: membership.user.name
    });
  }
  const emailPayload = buildSetupEmailPayload({
    orgName: membership.org.name,
    role: membership.role,
    setupLink: tokenInfo.setupLink,
    expiresAt: tokenInfo.expiresAt,
    name: membership.user.name
  });
  let emailDelivery = false;
  try {
    await sendTransactionalEmail({
      to: membership.user.email,
      subject: emailPayload.subject,
      text: emailPayload.text,
      html: emailPayload.html
    });
    emailDelivery = true;
  } catch {
    emailDelivery = false;
  }

  return {
    userId,
    setupLink: tokenInfo.setupLink,
    expiresAt: tokenInfo.expiresAt,
    whatsappDelivery,
    emailDelivery,
    mailtoUrl: buildSetupMailtoUrl({
      email: membership.user.email,
      name: membership.user.name,
      orgName: membership.org.name,
      role: membership.role,
      setupLink: tokenInfo.setupLink,
      expiresAt: tokenInfo.expiresAt
    })
  };
}
