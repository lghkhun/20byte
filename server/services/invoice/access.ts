import type { Prisma, Role } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { canAccessInbox } from "@/lib/permissions/orgPermissions";
import { assertOrgBillingAccess } from "@/server/services/billingService";
import { formatInvoiceNumber } from "@/server/services/invoiceNumberService";
import { ServiceError } from "@/server/services/serviceError";

export async function requireInvoiceAccess(actorUserId: string, orgId: string): Promise<void> {
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

  if (!canAccessInbox(membership.role)) {
    throw new ServiceError(403, "FORBIDDEN_INVOICE_ACCESS", "Your role cannot create invoices.");
  }

  await assertOrgBillingAccess(orgId, "write");
}

export async function requireInvoiceMembershipRole(actorUserId: string, orgId: string): Promise<Role> {
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

  if (!canAccessInbox(membership.role)) {
    throw new ServiceError(403, "FORBIDDEN_INVOICE_ACCESS", "Your role cannot access invoices.");
  }

  await assertOrgBillingAccess(orgId, "write");

  return membership.role;
}

export async function reserveNextInvoiceNumber(
  tx: Prisma.TransactionClient,
  orgId: string,
  now: Date
): Promise<string> {
  const year = now.getUTCFullYear();
  const sequence = await tx.invoiceSequence.upsert({
    where: {
      orgId_year: {
        orgId,
        year
      }
    },
    create: {
      orgId,
      year,
      lastSeq: 1
    },
    update: {
      lastSeq: {
        increment: 1
      }
    },
    select: {
      lastSeq: true
    }
  });

  return formatInvoiceNumber(year, sequence.lastSeq);
}
