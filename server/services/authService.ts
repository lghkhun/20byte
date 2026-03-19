import { hashPassword, validatePasswordPolicy, verifyPassword } from "@/lib/auth/password";
import { createSessionToken } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { logAuthFailure } from "@/lib/logging/auth";
import { ServiceError } from "@/server/services/serviceError";

type RegisterUserInput = {
  email?: unknown;
  password?: unknown;
  name?: unknown;
};

type LoginUserInput = {
  email?: unknown;
  password?: unknown;
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
};

type ProfileResult = {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type UpdateProfileInput = {
  name?: unknown;
  currentPassword?: unknown;
  newPassword?: unknown;
};

function normalizeEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
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

export async function registerUser(input: RegisterUserInput): Promise<RegisterResult> {
  const email = normalizeEmail(input.email);
  const password = normalizePassword(input.password);
  const name = normalizeName(input.name);

  if (!isValidEmail(email)) {
    throw new ServiceError(400, "INVALID_EMAIL", "Email format is invalid.");
  }

  const passwordPolicyError = validatePasswordPolicy(password);
  if (passwordPolicyError) {
    throw new ServiceError(400, "INVALID_PASSWORD", passwordPolicyError);
  }

  if (name && name.length > 120) {
    throw new ServiceError(400, "INVALID_NAME", "Name must be 120 characters or fewer.");
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

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name: name ?? null
    },
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true
    }
  });

  return {
    user
  };
}

export async function loginUser(input: LoginUserInput): Promise<LoginResult> {
  const email = normalizeEmail(input.email);
  const password = normalizePassword(input.password);

  if (!isValidEmail(email)) {
    throw new ServiceError(400, "INVALID_EMAIL", "Email format is invalid.");
  }

  if (!password) {
    throw new ServiceError(400, "INVALID_PASSWORD", "Password is required.");
  }

  const user = await prisma.user.findUnique({
    where: {
      email
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
      email
    });
    throw new ServiceError(401, "INVALID_CREDENTIALS", "Email or password is invalid.");
  }

  const isPasswordValid = await verifyPassword(password, user.passwordHash);
  if (!isPasswordValid) {
    logAuthFailure({
      reason: "LOGIN_INVALID_PASSWORD",
      email
    });
    throw new ServiceError(401, "INVALID_CREDENTIALS", "Email or password is invalid.");
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

export async function getProfile(userId: string): Promise<ProfileResult> {
  if (!userId.trim()) {
    throw new ServiceError(400, "MISSING_USER_ID", "userId is required.");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      avatarUrl: true,
      createdAt: true,
      updatedAt: true
    }
  });

  if (!user) {
    throw new ServiceError(404, "USER_NOT_FOUND", "User account not found.");
  }

  return user;
}

export async function updateProfile(userId: string, input: UpdateProfileInput): Promise<ProfileResult> {
  if (!userId.trim()) {
    throw new ServiceError(400, "MISSING_USER_ID", "userId is required.");
  }

  const nextName = normalizeName(input.name);
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

  const data: { name?: string | null; passwordHash?: string } = {};
  if (typeof input.name === "string") {
    data.name = nextName ?? null;
  }

  if (shouldUpdatePassword) {
    const isPasswordValid = await verifyPassword(currentPassword, user.passwordHash);
    if (!isPasswordValid) {
      throw new ServiceError(401, "INVALID_CURRENT_PASSWORD", "Current password is invalid.");
    }

    data.passwordHash = await hashPassword(newPassword);
  }

  if (!data.name && !data.passwordHash) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };
  }

  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data,
    select: {
      id: true,
      email: true,
      name: true,
      avatarUrl: true,
      createdAt: true,
      updatedAt: true
    }
  });

  return updatedUser;
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

  return prisma.user.update({
    where: { id: userId },
    data: {
      avatarUrl
    },
    select: {
      id: true,
      email: true,
      name: true,
      avatarUrl: true,
      createdAt: true,
      updatedAt: true
    }
  });
}
