import { Role } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import {
  canAccessOrganizationSettings,
  canAssignOrganizationRole,
  canManageOrganizationMember,
  canViewOrganizationMembers
} from "@/lib/permissions/orgPermissions";
import { ServiceError } from "@/server/services/serviceError";

const MIN_ORG_NAME_LENGTH = 2;
const MAX_ORG_NAME_LENGTH = 80;

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

type OnboardingStatus = {
  orgId: string;
  orgName: string;
  isCompleted: boolean;
  currentStep: number;
  totalSteps: number;
  nextStep: "CONNECT_WHATSAPP" | "DONE";
};

type OrganizationMemberSummary = {
  orgId: string;
  userId: string;
  role: Role;
  email: string;
  name: string | null;
  createdAt: Date;
};

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeOrgName(value: string): string {
  return value.trim();
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

export async function getOrganizationOnboardingStatus(
  userId: string,
  orgId: string
): Promise<OnboardingStatus> {
  const membership = await requireMembership(userId, orgId);
  if (!canAccessOrganizationSettings(membership.role)) {
    throw new ServiceError(403, "FORBIDDEN_SETTINGS_ACCESS", "Your role cannot access onboarding settings.");
  }

  const organization = await prisma.org.findUnique({
    where: {
      id: orgId
    },
    select: {
      id: true,
      name: true
    }
  });

  if (!organization) {
    throw new ServiceError(404, "ORG_NOT_FOUND", "Organization does not exist.");
  }

  const waAccountCount = await prisma.waAccount.count({
    where: {
      orgId
    }
  });

  const isCompleted = waAccountCount > 0;

  return {
    orgId: organization.id,
    orgName: organization.name,
    isCompleted,
    currentStep: isCompleted ? 2 : 1,
    totalSteps: 2,
    nextStep: isCompleted ? "DONE" : "CONNECT_WHATSAPP"
  };
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

  const normalizedEmail = normalizeEmail(input.email);
  if (!normalizedEmail) {
    throw new ServiceError(400, "INVALID_EMAIL", "Email is required.");
  }

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
