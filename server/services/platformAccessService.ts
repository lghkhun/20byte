import { prisma } from "@/lib/db/prisma";
import { getSuperadminEmailAllowlist } from "@/lib/env";
import { ServiceError } from "@/server/services/serviceError";

export function isSuperadminAllowlistedEmail(email: string, allowlist = getSuperadminEmailAllowlist()): boolean {
  const normalizedEmail = email.trim().toLowerCase();
  return Boolean(normalizedEmail) && allowlist.has(normalizedEmail);
}

export async function isSuperadmin(userId: string, email: string): Promise<boolean> {
  if (isSuperadminAllowlistedEmail(email)) {
    return true;
  }

  const membership = await prisma.platformMember.findUnique({
    where: { userId },
    select: { id: true }
  });

  return Boolean(membership);
}

export async function requireSuperadmin(userId: string, email: string): Promise<void> {
  const allowed = await isSuperadmin(userId, email);
  if (!allowed) {
    throw new ServiceError(403, "FORBIDDEN_SUPERADMIN", "Superadmin access is required.");
  }
}
