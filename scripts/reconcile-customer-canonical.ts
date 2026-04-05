import { prisma } from "@/lib/db/prisma";
import { getOrCreateCustomer } from "@/server/services/message/inboundInfra/customerConversation";

async function reconcileOrg(orgId: string) {
  const customers = await prisma.customer.findMany({
    where: { orgId },
    select: {
      id: true,
      phoneE164: true,
      displayName: true,
      waProfilePicUrl: true
    },
    orderBy: { createdAt: "asc" }
  });

  let processed = 0;
  for (const customer of customers) {
    await prisma.$transaction(async (tx) => {
      await getOrCreateCustomer(
        tx,
        orgId,
        customer.phoneE164,
        customer.displayName ?? undefined,
        customer.waProfilePicUrl ?? undefined,
        undefined
      );
    });
    processed += 1;
  }

  return processed;
}

function duplicateNameBuckets(rows: Array<{ name: string | null; phone: string }>): number {
  const buckets = new Map<string, Set<string>>();
  for (const row of rows) {
    const key = (row.name ?? "").trim().toLowerCase();
    if (!key) {
      continue;
    }
    if (!buckets.has(key)) {
      buckets.set(key, new Set());
    }
    buckets.get(key)?.add(row.phone);
  }
  return [...buckets.values()].filter((phones) => phones.size > 1).length;
}

async function summarizeOrg(orgId: string): Promise<{ before: number; after: number; processed: number }> {
  const beforeRows = await prisma.conversation.findMany({
    where: { orgId },
    select: {
      customer: {
        select: {
          displayName: true,
          phoneE164: true
        }
      }
    }
  });
  const before = duplicateNameBuckets(
    beforeRows.map((row) => ({
      name: row.customer.displayName,
      phone: row.customer.phoneE164
    }))
  );

  const processed = await reconcileOrg(orgId);

  const afterRows = await prisma.conversation.findMany({
    where: { orgId },
    select: {
      customer: {
        select: {
          displayName: true,
          phoneE164: true
        }
      }
    }
  });
  const after = duplicateNameBuckets(
    afterRows.map((row) => ({
      name: row.customer.displayName,
      phone: row.customer.phoneE164
    }))
  );

  return { before, after, processed };
}

async function main() {
  const orgArg = process.argv[2]?.trim() || "";
  const orgIds =
    orgArg.length > 0
      ? [orgArg]
      : (
          await prisma.customer.findMany({
            select: { orgId: true },
            distinct: ["orgId"]
          })
        ).map((row) => row.orgId);

  for (const orgId of orgIds) {
    const summary = await summarizeOrg(orgId);
    console.log(
      JSON.stringify({
        orgId,
        processedCustomers: summary.processed,
        duplicateNameBucketsBefore: summary.before,
        duplicateNameBucketsAfter: summary.after
      })
    );
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
