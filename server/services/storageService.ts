import { InvoiceStatus } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { canAccessOrganizationSettings } from "@/lib/permissions/orgPermissions";
import { publishStorageUpdatedEvent } from "@/lib/ably/publisher";
import { deleteFromR2, getPublicObjectKeyFromUrl } from "@/lib/r2/client";
import { assertOrgBillingAccess } from "@/server/services/billingService";
import { CLEANUP_BATCH_SIZE, DEFAULT_RETENTION_DAYS, DEFAULT_STORAGE_QUOTA_MB } from "@/server/services/storage/storageConstants";
import type {
  ChatRetentionCleanupResult,
  InvoiceRetentionCleanupResult,
  StorageUsageSummary
} from "@/server/services/storage/storageTypes";
import { ServiceError } from "@/server/services/serviceError";

function normalize(value: string): string {
  return value.trim();
}

async function deletePublicUrlIfPossible(fileUrl: string | null | undefined, entityLabel: string): Promise<void> {
  if (!fileUrl) {
    return;
  }

  const objectKey = getPublicObjectKeyFromUrl(fileUrl);
  if (!objectKey) {
    return;
  }

  try {
    await deleteFromR2(objectKey);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown delete error";
    console.error(`[storage] failed to delete R2 object for ${entityLabel}: ${message}`);
  }
}

async function requireSettingsAccess(actorUserId: string, orgId: string): Promise<void> {
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

  if (!canAccessOrganizationSettings(membership.role)) {
    throw new ServiceError(403, "FORBIDDEN_SETTINGS_ACCESS", "Your role cannot access storage settings.");
  }

  await assertOrgBillingAccess(orgId, "write");
}

async function getOrgPlanSettings(orgId: string): Promise<{ storageQuotaMb: number; retentionDays: number }> {
  const plan = await prisma.orgPlan.findUnique({
    where: {
      orgId
    },
    select: {
      storageQuotaMb: true,
      retentionDays: true
    }
  });

  return {
    storageQuotaMb: plan?.storageQuotaMb ?? DEFAULT_STORAGE_QUOTA_MB,
    retentionDays: plan?.retentionDays ?? DEFAULT_RETENTION_DAYS
  };
}

async function sumMessageMediaBytes(orgId: string): Promise<number> {
  const aggregate = await prisma.message.aggregate({
    where: {
      orgId,
      mediaUrl: {
        not: null
      }
    },
    _sum: {
      fileSize: true
    }
  });

  return aggregate._sum.fileSize ?? 0;
}

async function sumPaymentProofBytes(orgId: string): Promise<number> {
  const aggregate = await prisma.paymentProof.aggregate({
    where: {
      orgId
    },
    _sum: {
      fileSize: true
    }
  });

  return aggregate._sum.fileSize ?? 0;
}

export async function getOrgStorageUsage(actorUserId: string, orgIdInput: string): Promise<StorageUsageSummary> {
  const orgId = normalize(orgIdInput);
  if (!orgId) {
    throw new ServiceError(400, "MISSING_ORG_ID", "orgId is required.");
  }

  await requireSettingsAccess(actorUserId, orgId);

  const [plan, chatMediaBytes, paymentProofBytes] = await Promise.all([
    getOrgPlanSettings(orgId),
    sumMessageMediaBytes(orgId),
    sumPaymentProofBytes(orgId)
  ]);

  const quotaBytes = plan.storageQuotaMb * 1024 * 1024;
  const usedBytes = chatMediaBytes + paymentProofBytes;
  const usagePercent = quotaBytes > 0 ? Math.min(100, Math.round((usedBytes / quotaBytes) * 10000) / 100) : 0;

  return {
    orgId,
    quotaBytes,
    usedBytes,
    usagePercent,
    usageByCategory: {
      chatMediaBytes,
      paymentProofBytes
    }
  };
}

export async function applyChatRetentionPolicyForOrg(orgIdInput: string, now = new Date()): Promise<ChatRetentionCleanupResult> {
  const orgId = normalize(orgIdInput);
  if (!orgId) {
    throw new ServiceError(400, "MISSING_ORG_ID", "orgId is required.");
  }

  const plan = await getOrgPlanSettings(orgId);
  const cutoffDate = new Date(now.getTime() - plan.retentionDays * 24 * 60 * 60 * 1000);

  const candidates = await prisma.message.findMany({
    where: {
      orgId,
      createdAt: {
        lt: cutoffDate
      },
      mediaUrl: {
        not: null
      }
    },
    select: {
      id: true,
      mediaUrl: true,
      fileSize: true
    },
    orderBy: {
      createdAt: "asc"
    },
    take: CLEANUP_BATCH_SIZE
  });

  if (candidates.length === 0) {
    return {
      orgId,
      retentionDays: plan.retentionDays,
      scannedCount: 0,
      cleanedCount: 0,
      cleanedBytes: 0
    };
  }

  let cleanedCount = 0;
  let cleanedBytes = 0;
  const cleanedIds: string[] = [];

  for (const candidate of candidates) {
    if (!candidate.mediaUrl) {
      continue;
    }

    await deletePublicUrlIfPossible(candidate.mediaUrl, `message ${candidate.id}`);

    cleanedIds.push(candidate.id);
    cleanedCount += 1;
    cleanedBytes += candidate.fileSize ?? 0;
  }

  if (cleanedIds.length > 0) {
    await prisma.message.updateMany({
      where: {
        orgId,
        id: {
          in: cleanedIds
        }
      },
      data: {
        mediaUrl: null,
        mediaId: null,
        mimeType: null,
        fileName: null,
        fileSize: null,
        durationSec: null
      }
    });

    void publishStorageUpdatedEvent({
      orgId
    });
  }

  return {
    orgId,
    retentionDays: plan.retentionDays,
    scannedCount: candidates.length,
    cleanedCount,
    cleanedBytes
  };
}

export async function applyInvoiceRetentionPolicyForOrg(
  orgIdInput: string,
  now = new Date()
): Promise<InvoiceRetentionCleanupResult> {
  const orgId = normalize(orgIdInput);
  if (!orgId) {
    throw new ServiceError(400, "MISSING_ORG_ID", "orgId is required.");
  }

  const plan = await getOrgPlanSettings(orgId);
  const cutoffDate = new Date(now.getTime() - plan.retentionDays * 24 * 60 * 60 * 1000);

  const candidates = await prisma.invoice.findMany({
    where: {
      orgId,
      createdAt: {
        lt: cutoffDate
      },
      status: {
        in: [InvoiceStatus.PAID, InvoiceStatus.VOID]
      }
    },
    select: {
      id: true,
      pdfUrl: true,
      proofs: {
        select: {
          id: true,
          mediaUrl: true,
          fileSize: true
        }
      }
    },
    orderBy: {
      createdAt: "asc"
    },
    take: CLEANUP_BATCH_SIZE
  });

  if (candidates.length === 0) {
    return {
      orgId,
      retentionDays: plan.retentionDays,
      scannedCount: 0,
      cleanedInvoiceCount: 0,
      cleanedProofCount: 0,
      cleanedBytes: 0
    };
  }

  let cleanedInvoiceCount = 0;
  let cleanedProofCount = 0;
  let cleanedBytes = 0;

  for (const candidate of candidates) {
    if (candidate.pdfUrl) {
      await deletePublicUrlIfPossible(candidate.pdfUrl, `invoice ${candidate.id} pdf`);
      cleanedInvoiceCount += 1;
    }

    for (const proof of candidate.proofs) {
      await deletePublicUrlIfPossible(proof.mediaUrl, `payment proof ${proof.id}`);
      cleanedProofCount += 1;
      cleanedBytes += proof.fileSize ?? 0;
    }

    await prisma.$transaction([
      prisma.paymentProof.deleteMany({
        where: {
          orgId,
          invoiceId: candidate.id
        }
      }),
      prisma.invoice.updateMany({
        where: {
          id: candidate.id,
          orgId
        },
        data: {
          pdfUrl: null
        }
      })
    ]);
  }

  if (cleanedInvoiceCount > 0 || cleanedProofCount > 0) {
    void publishStorageUpdatedEvent({
      orgId
    });
  }

  return {
    orgId,
    retentionDays: plan.retentionDays,
    scannedCount: candidates.length,
    cleanedInvoiceCount,
    cleanedProofCount,
    cleanedBytes
  };
}

export async function runChatRetentionCleanup(): Promise<{
  orgCount: number;
  totalScanned: number;
  totalCleaned: number;
  totalCleanedBytes: number;
}> {
  const orgs = await prisma.org.findMany({
    select: {
      id: true
    }
  });

  let totalScanned = 0;
  let totalCleaned = 0;
  let totalCleanedBytes = 0;

  for (const org of orgs) {
    const result = await applyChatRetentionPolicyForOrg(org.id);
    totalScanned += result.scannedCount;
    totalCleaned += result.cleanedCount;
    totalCleanedBytes += result.cleanedBytes;
  }

  return {
    orgCount: orgs.length,
    totalScanned,
    totalCleaned,
    totalCleanedBytes
  };
}

export async function runInvoiceRetentionCleanup(): Promise<{
  orgCount: number;
  totalScanned: number;
  totalCleanedInvoices: number;
  totalCleanedProofs: number;
  totalCleanedBytes: number;
}> {
  const orgs = await prisma.org.findMany({
    select: {
      id: true
    }
  });

  let totalScanned = 0;
  let totalCleanedInvoices = 0;
  let totalCleanedProofs = 0;
  let totalCleanedBytes = 0;

  for (const org of orgs) {
    const result = await applyInvoiceRetentionPolicyForOrg(org.id);
    totalScanned += result.scannedCount;
    totalCleanedInvoices += result.cleanedInvoiceCount;
    totalCleanedProofs += result.cleanedProofCount;
    totalCleanedBytes += result.cleanedBytes;
  }

  return {
    orgCount: orgs.length,
    totalScanned,
    totalCleanedInvoices,
    totalCleanedProofs,
    totalCleanedBytes
  };
}
