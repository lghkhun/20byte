import { hashPassword, validatePasswordPolicy, verifyPassword } from "@/lib/auth/password";
import { createSessionToken } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { getSuperadminEmailAllowlist } from "@/lib/env";
import { logAuthFailure } from "@/lib/logging/auth";
import { getProxyAssetUrl, getPublicObjectKeyFromUrl } from "@/lib/r2/client";
import { normalizePossibleE164, normalizeWhatsAppDestination } from "@/lib/whatsapp/e164";
import { ensureBillingRecordForOrg } from "@/server/services/billingService";
import { createAccountSetupToken } from "@/server/services/accountSetupService";
import { sendTransactionalEmail } from "@/server/services/emailService";
import { createOrganizationForUser } from "@/server/services/organizationService";
import { ServiceError } from "@/server/services/serviceError";

type RegisterUserInput = {
  email?: unknown;
  password?: unknown;
  name?: unknown;
  phone?: unknown;
};

type LoginUserInput = {
  identifier?: unknown;
  email?: unknown;
  password?: unknown;
};

type ForgotPasswordInput = {
  identifier?: unknown;
  email?: unknown;
};

type AuthenticatedUser = {
  userId: string;
  email: string;
  name: string | null;
};

type LoginResult = {
  user: AuthenticatedUser;
  sessionToken: string;
};

type RegisterResult = {
  user: {
    id: string;
    email: string;
    name: string | null;
    createdAt: Date;
  };
  organization: {
    id: string;
    name: string;
  };
};

type ProfileResult = {
  id: string;
  email: string;
  phoneE164: string | null;
  name: string | null;
  avatarUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type UpdateProfileInput = {
  name?: unknown;
  phone?: unknown;
  currentPassword?: unknown;
  newPassword?: unknown;
};

function normalizeAvatarUrlForClient(value: string | null): string | null {
  const normalized = value?.trim() ?? "";
  if (!normalized) {
    return null;
  }

  const objectKey = getPublicObjectKeyFromUrl(normalized);
  if (!objectKey) {
    return normalized;
  }

  return getProxyAssetUrl(objectKey);
}

function mapProfileForClient(profile: ProfileResult): ProfileResult {
  return {
    ...profile,
    avatarUrl: normalizeAvatarUrlForClient(profile.avatarUrl)
  };
}

function normalizeEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizeIdentifier(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeName(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function normalizePassword(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function isReservedSuperadminSignupEmail(email: string, allowlist = getSuperadminEmailAllowlist()): boolean {
  const normalized = email.trim().toLowerCase();
  return Boolean(normalized) && allowlist.has(normalized);
}

function buildResetPasswordEmail(input: {
  name: string | null;
  setupLink: string;
  expiresAt: Date;
}): { subject: string; text: string; html: string } {
  const subject = "Atur ulang password akun 20byte";
  const expiresAtLabel = new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(input.expiresAt);
  const greeting = input.name?.trim() || "Tim";

  const text = [
    `Halo ${greeting},`,
    "",
    "Kami menerima permintaan reset password untuk akun 20byte Anda.",
    "Klik link berikut untuk membuat password baru:",
    input.setupLink,
    "",
    `Link berlaku sampai ${expiresAtLabel}.`,
    "Jika Anda tidak merasa meminta reset password, abaikan email ini."
  ].join("\n");

  const html = `
    <div style="font-family:Arial,sans-serif;color:#111827;line-height:1.6">
      <p>Halo ${greeting},</p>
      <p>Kami menerima permintaan reset password untuk akun 20byte Anda.</p>
      <p>Klik tombol berikut untuk membuat password baru:</p>
      <p>
        <a href="${input.setupLink}" style="display:inline-block;padding:10px 16px;background:#10b981;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600">
          Atur Ulang Password
        </a>
      </p>
      <p>Atau buka link ini langsung:</p>
      <p><a href="${input.setupLink}">${input.setupLink}</a></p>
      <p style="color:#6b7280">Link berlaku sampai ${expiresAtLabel}.</p>
      <p style="color:#6b7280">Jika Anda tidak merasa meminta reset password, abaikan email ini.</p>
    </div>
  `.trim();

  return { subject, text, html };
}

export async function registerUser(input: RegisterUserInput): Promise<RegisterResult> {
  const email = normalizeEmail(input.email);
  const password = normalizePassword(input.password);
  const name = normalizeName(input.name);
  const phoneE164 = normalizeWhatsAppDestination(typeof input.phone === "string" ? input.phone : undefined);

  if (!isValidEmail(email)) {
    throw new ServiceError(400, "INVALID_EMAIL", "Email format is invalid.");
  }

  if (isReservedSuperadminSignupEmail(email)) {
    throw new ServiceError(
      403,
      "SUPERADMIN_EMAIL_RESERVED",
      "Email ini direservasi untuk akses superadmin dan tidak bisa dipakai registrasi publik."
    );
  }

  const passwordPolicyError = validatePasswordPolicy(password);
  if (passwordPolicyError) {
    throw new ServiceError(400, "INVALID_PASSWORD", passwordPolicyError);
  }

  if (name && name.length > 120) {
    throw new ServiceError(400, "INVALID_NAME", "Name must be 120 characters or fewer.");
  }

  if (!phoneE164) {
    throw new ServiceError(400, "INVALID_PHONE", "Valid WhatsApp number is required.");
  }

  const existingUser = await prisma.user.findUnique({
    where: {
      email
    },
    select: {
      id: true
    }
  });

  if (existingUser) {
    throw new ServiceError(400, "EMAIL_ALREADY_REGISTERED", "Email is already registered.");
  }

  const existingByPhone = await prisma.user.findUnique({
    where: {
      phoneE164
    },
    select: {
      id: true
    }
  });

  if (existingByPhone) {
    throw new ServiceError(400, "PHONE_ALREADY_REGISTERED", "WhatsApp number is already registered.");
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      email,
      phoneE164,
      passwordHash,
      passwordSetAt: new Date(),
      name: name ?? null
    },
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true
    }
  });

  const organization = await createOrganizationForUser({
    userId: user.id,
    name: `${name ?? email.split("@")[0] ?? "Business"} Business`
  });
  await ensureBillingRecordForOrg(organization.id, user.createdAt);

  return {
    user,
    organization: {
      id: organization.id,
      name: organization.name
    }
  };
}

export async function loginUser(input: LoginUserInput): Promise<LoginResult> {
  const identifierRaw = normalizeIdentifier(input.identifier) || normalizeIdentifier(input.email);
  const normalizedEmailCandidate = normalizeEmail(identifierRaw);
  const email = isValidEmail(normalizedEmailCandidate) ? normalizedEmailCandidate : "";
  const normalizedPhone = normalizePossibleE164(identifierRaw) ?? normalizeWhatsAppDestination(identifierRaw);
  const password = normalizePassword(input.password);

  if (!email && !normalizedPhone) {
    throw new ServiceError(400, "INVALID_IDENTIFIER", "Identifier must be a valid email or WhatsApp number.");
  }

  if (!password) {
    throw new ServiceError(400, "INVALID_PASSWORD", "Password is required.");
  }

  const user = await prisma.user.findFirst({
    where: email
      ? {
          email
        }
      : {
          phoneE164: normalizedPhone ?? undefined
        },
    select: {
      id: true,
      email: true,
      name: true,
      passwordHash: true
    }
  });

  if (!user) {
    logAuthFailure({
      reason: "LOGIN_USER_NOT_FOUND",
      email: email || normalizedPhone || identifierRaw
    });
    throw new ServiceError(
      401,
      "INVALID_CREDENTIALS",
      "Email/WhatsApp atau password salah. Jika lupa, gunakan fitur Lupa password."
    );
  }

  if (!user.passwordHash) {
    throw new ServiceError(403, "ACCOUNT_SETUP_REQUIRED", "Akun belum aktif, buka link aktivasi yang dikirim owner.");
  }

  const isPasswordValid = await verifyPassword(password, user.passwordHash);
  if (!isPasswordValid) {
    logAuthFailure({
      reason: "LOGIN_INVALID_PASSWORD",
      email
    });
    throw new ServiceError(
      401,
      "INVALID_CREDENTIALS",
      "Email/WhatsApp atau password salah. Jika lupa, gunakan fitur Lupa password."
    );
  }

  const authUser: AuthenticatedUser = {
    userId: user.id,
    email: user.email,
    name: user.name
  };

  return {
    user: authUser,
    sessionToken: createSessionToken(authUser)
  };
}

export async function requestPasswordReset(input: ForgotPasswordInput): Promise<{ accepted: true }> {
  const identifierRaw = normalizeIdentifier(input.identifier) || normalizeIdentifier(input.email);
  const normalizedEmailCandidate = normalizeEmail(identifierRaw);
  const email = isValidEmail(normalizedEmailCandidate) ? normalizedEmailCandidate : "";
  const normalizedPhone = normalizePossibleE164(identifierRaw) ?? normalizeWhatsAppDestination(identifierRaw);

  if (!email && !normalizedPhone) {
    throw new ServiceError(400, "INVALID_IDENTIFIER", "Masukkan email atau nomor WhatsApp yang valid.");
  }

  const user = await prisma.user.findFirst({
    where: email
      ? {
          email
        }
      : {
          phoneE164: normalizedPhone ?? undefined
        },
    select: {
      id: true,
      email: true,
      name: true,
      isSuspended: true
    }
  });

  if (!user || user.isSuspended) {
    return { accepted: true };
  }

  const membership = await prisma.orgMember.findFirst({
    where: {
      userId: user.id
    },
    select: {
      orgId: true
    },
    orderBy: {
      createdAt: "asc"
    }
  });

  if (!membership) {
    return { accepted: true };
  }

  const tokenInfo = await createAccountSetupToken({
    userId: user.id,
    orgId: membership.orgId
  });
  const emailPayload = buildResetPasswordEmail({
    name: user.name,
    setupLink: tokenInfo.setupLink,
    expiresAt: tokenInfo.expiresAt
  });

  try {
    await sendTransactionalEmail({
      to: user.email,
      subject: emailPayload.subject,
      text: emailPayload.text,
      html: emailPayload.html
    });
  } catch (error) {
    if (error instanceof ServiceError && error.code === "EMAIL_PROVIDER_NOT_CONFIGURED" && process.env.NODE_ENV !== "production") {
      console.warn(
        `[auth] EMAIL_PROVIDER_NOT_CONFIGURED. Dev fallback reset link for ${user.email}: ${tokenInfo.setupLink}`
      );
    } else {
      throw error;
    }
  }

  return { accepted: true };
}

export async function getProfile(userId: string): Promise<ProfileResult> {
  if (!userId.trim()) {
    throw new ServiceError(400, "MISSING_USER_ID", "userId is required.");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      phoneE164: true,
      name: true,
      avatarUrl: true,
      createdAt: true,
      updatedAt: true
    }
  });

  if (!user) {
    throw new ServiceError(404, "USER_NOT_FOUND", "User account not found.");
  }

  return mapProfileForClient(user);
}

export async function updateProfile(userId: string, input: UpdateProfileInput): Promise<ProfileResult> {
  if (!userId.trim()) {
    throw new ServiceError(400, "MISSING_USER_ID", "userId is required.");
  }

  const nextName = normalizeName(input.name);
  const hasPhoneInput = typeof input.phone === "string";
  const nextPhoneE164 = hasPhoneInput ? normalizeWhatsAppDestination(input.phone as string) : null;
  const currentPassword = normalizePassword(input.currentPassword);
  const newPassword = normalizePassword(input.newPassword);
  const shouldUpdatePassword = Boolean(currentPassword || newPassword);

  if (nextName && nextName.length > 120) {
    throw new ServiceError(400, "INVALID_NAME", "Name must be 120 characters or fewer.");
  }

  if (shouldUpdatePassword) {
    if (!currentPassword || !newPassword) {
      throw new ServiceError(
        400,
        "INVALID_PASSWORD_UPDATE",
        "currentPassword and newPassword must be provided together."
      );
    }

    const passwordPolicyError = validatePasswordPolicy(newPassword);
    if (passwordPolicyError) {
      throw new ServiceError(400, "INVALID_PASSWORD", passwordPolicyError);
    }
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      phoneE164: true,
      name: true,
      avatarUrl: true,
      passwordHash: true,
      createdAt: true,
      updatedAt: true
    }
  });

  if (!user) {
    throw new ServiceError(404, "USER_NOT_FOUND", "User account not found.");
  }

  const data: { name?: string | null; phoneE164?: string; passwordHash?: string } = {};
  if (typeof input.name === "string") {
    data.name = nextName ?? null;
  }

  if (hasPhoneInput) {
    if (!nextPhoneE164) {
      throw new ServiceError(400, "INVALID_PHONE", "Valid WhatsApp number is required.");
    }
    const phoneOwner = await prisma.user.findUnique({
      where: { phoneE164: nextPhoneE164 },
      select: { id: true }
    });
    if (phoneOwner && phoneOwner.id !== user.id) {
      throw new ServiceError(409, "PHONE_ALREADY_REGISTERED", "WhatsApp number is already registered.");
    }
    data.phoneE164 = nextPhoneE164;
  } else if (!user.phoneE164) {
    throw new ServiceError(400, "PHONE_REQUIRED", "WhatsApp number is required.");
  }

  if (shouldUpdatePassword) {
    if (!user.passwordHash) {
      throw new ServiceError(400, "PASSWORD_NOT_SET", "Password is not set for this account.");
    }

    const isPasswordValid = await verifyPassword(currentPassword, user.passwordHash);
    if (!isPasswordValid) {
      throw new ServiceError(401, "INVALID_CURRENT_PASSWORD", "Current password is invalid.");
    }

    data.passwordHash = await hashPassword(newPassword);
  }

  if (!data.name && !data.passwordHash && !data.phoneE164) {
    return mapProfileForClient({
      id: user.id,
      email: user.email,
      phoneE164: user.phoneE164,
      name: user.name,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    });
  }

  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data,
    select: {
      id: true,
      email: true,
      phoneE164: true,
      name: true,
      avatarUrl: true,
      createdAt: true,
      updatedAt: true
    }
  });

  return mapProfileForClient(updatedUser);
}

export async function updateProfileAvatar(userId: string, avatarUrl: string | null): Promise<ProfileResult> {
  if (!userId.trim()) {
    throw new ServiceError(400, "MISSING_USER_ID", "userId is required.");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true
    }
  });

  if (!user) {
    throw new ServiceError(404, "USER_NOT_FOUND", "User account not found.");
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      avatarUrl
    },
    select: {
      id: true,
      email: true,
      phoneE164: true,
      name: true,
      avatarUrl: true,
      createdAt: true,
      updatedAt: true
    }
  });

  return mapProfileForClient(updatedUser);
}
