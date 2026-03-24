import { createHash, randomBytes } from "crypto";

import { prisma } from "@/lib/db/prisma";
import { getEnv } from "@/lib/env";
import { hashPassword, validatePasswordPolicy } from "@/lib/auth/password";
import { ServiceError } from "@/server/services/serviceError";

const TOKEN_TTL_HOURS = 24;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function normalize(value: string): string {
  return value.trim();
}

export async function createAccountSetupToken(input: {
  userId: string;
  orgId: string;
  createdByUserId?: string;
}): Promise<{ token: string; setupLink: string; expiresAt: Date }> {
  const userId = normalize(input.userId);
  const orgId = normalize(input.orgId);
  if (!userId || !orgId) {
    throw new ServiceError(400, "INVALID_SETUP_TOKEN_INPUT", "userId and orgId are required.");
  }

  await prisma.accountSetupToken.updateMany({
    where: {
      userId,
      orgId,
      purpose: "SET_PASSWORD",
      usedAt: null
    },
    data: {
      usedAt: new Date()
    }
  });

  const token = randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + TOKEN_TTL_HOURS * 60 * 60 * 1000);

  await prisma.accountSetupToken.create({
    data: {
      userId,
      orgId,
      tokenHash,
      purpose: "SET_PASSWORD",
      expiresAt,
      createdByUserId: input.createdByUserId ?? null
    }
  });

  const appUrl = getEnv().APP_URL.replace(/\/+$/, "");
  return {
    token,
    setupLink: `${appUrl}/set-password?token=${encodeURIComponent(token)}`,
    expiresAt
  };
}

export async function setPasswordFromSetupToken(input: {
  token: string;
  newPassword: string;
}) {
  const token = normalize(input.token);
  if (!token) {
    throw new ServiceError(400, "INVALID_SETUP_TOKEN", "Token is required.");
  }

  const passwordPolicyError = validatePasswordPolicy(input.newPassword);
  if (passwordPolicyError) {
    throw new ServiceError(400, "INVALID_PASSWORD", passwordPolicyError);
  }

  const tokenHash = hashToken(token);
  const setupToken = await prisma.accountSetupToken.findUnique({
    where: {
      tokenHash
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

  if (!setupToken) {
    throw new ServiceError(404, "SETUP_TOKEN_NOT_FOUND", "Setup token is invalid.");
  }

  if (setupToken.usedAt) {
    throw new ServiceError(400, "SETUP_TOKEN_USED", "Setup token has already been used.");
  }

  if (setupToken.expiresAt.getTime() <= Date.now()) {
    throw new ServiceError(400, "SETUP_TOKEN_EXPIRED", "Setup token has expired.");
  }

  const passwordHash = await hashPassword(input.newPassword);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: setupToken.userId },
      data: {
        passwordHash,
        passwordSetAt: new Date()
      }
    }),
    prisma.accountSetupToken.update({
      where: { id: setupToken.id },
      data: {
        usedAt: new Date()
      }
    })
  ]);

  return {
    user: setupToken.user
  };
}
