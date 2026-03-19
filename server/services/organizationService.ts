import { Role } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import {
  canAccessOrganizationSettings,
  canAssignOrganizationRole,
  canManageOrganizationMember,
  canViewOrganizationMembers
} from "@/lib/permissions/orgPermissions";
import { normalizeAndValidateEmail } from "@/lib/validation/formValidation";
import { ServiceError } from "@/server/services/serviceError";

const MIN_ORG_NAME_LENGTH = 2;
const MAX_ORG_NAME_LENGTH = 80;
const MAX_NON_OWNER_MEMBERS = 4;

type CreateOrganizationInput = {
  userId: string;
  name: string;
};

type AddOrganizationMemberInput = {
  actorUserId: string;
  orgId: string;
  email: string;
  role: Role;
};

type OrganizationSummary = {
  id: string;
  name: string;
  role: Role;
  createdAt: Date;
};

export type OrganizationBusinessProfile = {
  id: string;
  name: string;
  legalName: string | null;
  responsibleName: string | null;
  businessPhone: string | null;
  businessEmail: string | null;
  businessAddress: string | null;
  logoUrl: string | null;
  invoiceSignatureUrl: string | null;
};

type OrganizationMemberSummary = {
  orgId: string;
  userId: string;
  role: Role;
  email: string;
  name: string | null;
  createdAt: Date;
};

function normalizeOrgName(value: string): string {
  return value.trim();
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  const normalized = value?.trim() ?? "";
  return normalized ? normalized : null;
}

function normalizeOptionalEmail(value: string | null | undefined): string | null {
  const normalized = value?.trim() ?? "";
  if (!normalized) {
    return null;
  }

  return normalizeAndValidateEmail(normalized);
}

function validateOrgName(name: string): string {
  const normalizedName = normalizeOrgName(name);

  if (normalizedName.length < MIN_ORG_NAME_LENGTH) {
    throw new ServiceError(400, "INVALID_ORG_NAME", "Organization name is too short.");
  }

  if (normalizedName.length > MAX_ORG_NAME_LENGTH) {
    throw new ServiceError(400, "INVALID_ORG_NAME", "Organization name is too long.");
  }

  return normalizedName;
}

export function assertNonOwnerMemberLimit(role: Role, nonOwnerCount: number): void {
  if (role === Role.OWNER) {
    return;
  }

  if (nonOwnerCount >= MAX_NON_OWNER_MEMBERS) {
    throw new ServiceError(
      400,
      "ORG_MEMBER_LIMIT_EXCEEDED",
      `MVP saat ini membatasi maksimal ${MAX_NON_OWNER_MEMBERS} anggota per business (di luar owner).`
    );
  }
}

async function requireMembership(userId: string, orgId: string) {
  const membership = await prisma.orgMember.findUnique({
    where: {
      orgId_userId: {
        orgId,
        userId
      }
    }
  });

  if (!membership) {
    throw new ServiceError(403, "ORG_ACCESS_DENIED", "You do not have access to this organization.");
  }

  return membership;
}

export async function createOrganizationForUser(input: CreateOrganizationInput): Promise<OrganizationSummary> {
  const name = validateOrgName(input.name);

  return prisma.$transaction(async (tx) => {
    const existingOwnedOrganization = await tx.orgMember.findFirst({
      where: {
        userId: input.userId,
        role: Role.OWNER
      },
      include: {
        org: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: {
        createdAt: "asc"
      }
    });

    if (existingOwnedOrganization) {
      throw new ServiceError(
        409,
        "OWNER_ALREADY_HAS_ORGANIZATION",
        `MVP saat ini hanya mendukung 1 bisnis per akun owner. Akun ini sudah memiliki bisnis "${existingOwnedOrganization.org.name}".`
      );
    }

    const organization = await tx.org.create({
      data: {
        name
      },
      select: {
        id: true,
        name: true,
        createdAt: true
      }
    });

    const membership = await tx.orgMember.create({
      data: {
        orgId: organization.id,
        userId: input.userId,
        role: Role.OWNER
      },
      select: {
        role: true
      }
    });

    return {
      id: organization.id,
      name: organization.name,
      role: membership.role,
      createdAt: organization.createdAt
    };
  });
}

export async function listOrganizationsForUser(userId: string): Promise<OrganizationSummary[]> {
  const memberships = await prisma.orgMember.findMany({
    where: {
      userId
    },
    include: {
      org: {
        select: {
          id: true,
          name: true,
          createdAt: true
        }
      }
    },
    orderBy: {
      createdAt: "asc"
    }
  });

  return memberships.map((membership) => ({
    id: membership.org.id,
    name: membership.org.name,
    role: membership.role,
    createdAt: membership.org.createdAt
  }));
}

export async function getPrimaryOrganizationForUser(userId: string): Promise<OrganizationSummary | null> {
  const membership = await prisma.orgMember.findFirst({
    where: {
      userId
    },
    include: {
      org: {
        select: {
          id: true,
          name: true,
          createdAt: true
        }
      }
    },
    orderBy: {
      createdAt: "asc"
    }
  });

  if (!membership) {
    return null;
  }

  return {
    id: membership.org.id,
    name: membership.org.name,
    role: membership.role,
    createdAt: membership.org.createdAt
  };
}

export async function resolvePrimaryOrganizationIdForUser(userId: string, candidateOrgId: string): Promise<string> {
  const normalizedCandidate = candidateOrgId.trim();
  if (normalizedCandidate) {
    return normalizedCandidate;
  }

  const organization = await getPrimaryOrganizationForUser(userId);
  if (!organization) {
    throw new ServiceError(404, "ORG_NOT_FOUND", "No business is available for this account.");
  }

  return organization.id;
}

export async function getOrganizationBusinessProfile(
  actorUserId: string,
  candidateOrgId = ""
): Promise<OrganizationBusinessProfile> {
  const orgId = await resolvePrimaryOrganizationIdForUser(actorUserId, candidateOrgId);
  await requireMembership(actorUserId, orgId);

  const organization = await prisma.org.findUnique({
    where: {
      id: orgId
    },
    select: {
      id: true,
      name: true,
      legalName: true,
      responsibleName: true,
      businessPhone: true,
      businessEmail: true,
      businessAddress: true,
      logoUrl: true,
      invoiceSignatureUrl: true
    }
  });

  if (!organization) {
    throw new ServiceError(404, "ORG_NOT_FOUND", "No business is available for this account.");
  }

  return organization;
}

export async function updateOrganizationBusinessProfile(input: {
  actorUserId: string;
  orgId?: string;
  name: string;
  legalName?: string | null;
  responsibleName?: string | null;
  businessPhone?: string | null;
  businessEmail?: string | null;
  businessAddress?: string | null;
  logoUrl?: string | null;
  invoiceSignatureUrl?: string | null;
}): Promise<OrganizationBusinessProfile> {
  const orgId = await resolvePrimaryOrganizationIdForUser(input.actorUserId, input.orgId?.trim() ?? "");
  const membership = await requireMembership(input.actorUserId, orgId);
  if (!canAccessOrganizationSettings(membership.role)) {
    throw new ServiceError(403, "FORBIDDEN_SETTINGS_ACCESS", "Your role cannot access organization settings.");
  }

  const updated = await prisma.org.update({
    where: {
      id: orgId
    },
    data: {
      name: validateOrgName(input.name),
      legalName: normalizeOptionalText(input.legalName),
      responsibleName: normalizeOptionalText(input.responsibleName),
      businessPhone: normalizeOptionalText(input.businessPhone),
      businessEmail: normalizeOptionalEmail(input.businessEmail),
      businessAddress: normalizeOptionalText(input.businessAddress),
      logoUrl: normalizeOptionalText(input.logoUrl),
      invoiceSignatureUrl: normalizeOptionalText(input.invoiceSignatureUrl)
    },
    select: {
      id: true,
      name: true,
      legalName: true,
      responsibleName: true,
      businessPhone: true,
      businessEmail: true,
      businessAddress: true,
      logoUrl: true,
      invoiceSignatureUrl: true
    }
  });

  return updated;
}

export async function listOrganizationMembers(
  actorUserId: string,
  orgId: string
): Promise<OrganizationMemberSummary[]> {
  const actorMembership = await requireMembership(actorUserId, orgId);
  if (!canViewOrganizationMembers(actorMembership.role)) {
    throw new ServiceError(403, "FORBIDDEN_MEMBER_LIST", "Your role cannot list organization members.");
  }

  const memberships = await prisma.orgMember.findMany({
    where: {
      orgId
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true
        }
      }
    },
    orderBy: {
      createdAt: "asc"
    }
  });

  return memberships.map((membership) => ({
    orgId: membership.orgId,
    userId: membership.user.id,
    role: membership.role,
    email: membership.user.email,
    name: membership.user.name,
    createdAt: membership.createdAt
  }));
}

export async function addOrganizationMemberByEmail(
  input: AddOrganizationMemberInput
): Promise<OrganizationMemberSummary> {
  const actorMembership = await requireMembership(input.actorUserId, input.orgId);
  if (!canAssignOrganizationRole(actorMembership.role, input.role)) {
    throw new ServiceError(403, "FORBIDDEN_ROLE_ASSIGNMENT", "Your role cannot assign this member role.");
  }

  const normalizedEmail = normalizeAndValidateEmail(input.email);

  const user = await prisma.user.findUnique({
    where: {
      email: normalizedEmail
    },
    select: {
      id: true,
      email: true,
      name: true
    }
  });

  if (!user) {
    throw new ServiceError(404, "USER_NOT_FOUND", "User with this email does not exist.");
  }

  const existingMembership = await prisma.orgMember.findUnique({
    where: {
      orgId_userId: {
        orgId: input.orgId,
        userId: user.id
      }
    },
    select: {
      role: true
    }
  });

  if (existingMembership && !canManageOrganizationMember(actorMembership.role, existingMembership.role)) {
    throw new ServiceError(403, "FORBIDDEN_MEMBER_MODIFICATION", "Your role cannot modify this member.");
  }

  if (existingMembership?.role === Role.OWNER && input.role !== Role.OWNER) {
    const ownerCount = await prisma.orgMember.count({
      where: {
        orgId: input.orgId,
        role: Role.OWNER
      }
    });

    if (ownerCount <= 1) {
      throw new ServiceError(
        400,
        "LAST_OWNER_ROLE_CHANGE_FORBIDDEN",
        "Organization must have at least one owner."
      );
    }
  }

  if (!existingMembership && input.role !== Role.OWNER) {
    const nonOwnerCount = await prisma.orgMember.count({
      where: {
        orgId: input.orgId,
        role: {
          not: Role.OWNER
        }
      }
    });

    assertNonOwnerMemberLimit(input.role, nonOwnerCount);
  }

  const membership = await prisma.orgMember.upsert({
    where: {
      orgId_userId: {
        orgId: input.orgId,
        userId: user.id
      }
    },
    update: {
      role: input.role
    },
    create: {
      orgId: input.orgId,
      userId: user.id,
      role: input.role
    }
  });

  return {
    orgId: membership.orgId,
    userId: user.id,
    role: membership.role,
    email: user.email,
    name: user.name,
    createdAt: membership.createdAt
  };
}
