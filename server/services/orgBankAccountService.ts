import { Role } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { normalizeAndValidateBankAccount } from "@/lib/validation/formValidation";
import { ServiceError } from "@/server/services/serviceError";

type BankAccountItem = {
  id: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  createdAt: Date;
};

type ListInput = {
  actorUserId: string;
  orgId: string;
};

type CreateInput = {
  actorUserId: string;
  orgId: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
};

type DeleteInput = {
  actorUserId: string;
  orgId: string;
  bankAccountId: string;
};

const MAX_BANK_ACCOUNTS = 5;

function normalize(value: string): string {
  return value.trim();
}

async function requireSettingsRole(actorUserId: string, orgId: string): Promise<Role> {
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

  if (membership.role !== Role.OWNER && membership.role !== Role.ADMIN) {
    throw new ServiceError(403, "FORBIDDEN_BANK_ACCOUNT_ACCESS", "Your role cannot manage bank accounts.");
  }

  return membership.role;
}

export async function listOrgBankAccounts(input: ListInput): Promise<BankAccountItem[]> {
  const orgId = normalize(input.orgId);
  if (!orgId) {
    throw new ServiceError(400, "MISSING_ORG_ID", "orgId is required.");
  }

  await requireSettingsRole(input.actorUserId, orgId);

  return prisma.orgBankAccount.findMany({
    where: {
      orgId
    },
    orderBy: {
      createdAt: "asc"
    },
    select: {
      id: true,
      bankName: true,
      accountNumber: true,
      accountHolder: true,
      createdAt: true
    }
  });
}

export async function createOrgBankAccount(input: CreateInput): Promise<BankAccountItem> {
  const orgId = normalize(input.orgId);
  const { bankName, accountNumber, accountHolder } = normalizeAndValidateBankAccount({
    bankName: input.bankName,
    accountNumber: input.accountNumber,
    accountHolder: input.accountHolder
  });

  if (!orgId) {
    throw new ServiceError(400, "MISSING_ORG_ID", "orgId is required.");
  }

  await requireSettingsRole(input.actorUserId, orgId);

  const count = await prisma.orgBankAccount.count({
    where: {
      orgId
    }
  });

  if (count >= MAX_BANK_ACCOUNTS) {
    throw new ServiceError(400, "BANK_ACCOUNT_LIMIT_EXCEEDED", "Maximum 5 bank accounts allowed per organization.");
  }

  return prisma.orgBankAccount.create({
    data: {
      orgId,
      bankName,
      accountNumber,
      accountHolder
    },
    select: {
      id: true,
      bankName: true,
      accountNumber: true,
      accountHolder: true,
      createdAt: true
    }
  });
}

export async function deleteOrgBankAccount(input: DeleteInput): Promise<{ id: string }> {
  const orgId = normalize(input.orgId);
  const bankAccountId = normalize(input.bankAccountId);

  if (!orgId) {
    throw new ServiceError(400, "MISSING_ORG_ID", "orgId is required.");
  }

  if (!bankAccountId) {
    throw new ServiceError(400, "MISSING_BANK_ACCOUNT_ID", "bankAccountId is required.");
  }

  await requireSettingsRole(input.actorUserId, orgId);

  const deleted = await prisma.orgBankAccount.deleteMany({
    where: {
      id: bankAccountId,
      orgId
    }
  });

  if (deleted.count !== 1) {
    throw new ServiceError(404, "BANK_ACCOUNT_NOT_FOUND", "Bank account does not exist.");
  }

  return {
    id: bankAccountId
  };
}
