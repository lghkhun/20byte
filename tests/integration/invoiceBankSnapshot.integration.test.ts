import assert from "node:assert/strict";
import test from "node:test";

import { InvoiceKind } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { createDraftInvoice } from "@/server/services/invoice/draft";

const RUN_INTEGRATION = process.env.RUN_DB_INTEGRATION_TESTS === "1";
const SEED_ORG_ID = "seed_org_alpha";
const SEED_ACTOR_USER_ID = "seed_user_admin";

test("invoice keeps bank account snapshot even after org bank account changes", async (t) => {
  if (!RUN_INTEGRATION) {
    t.skip("Set RUN_DB_INTEGRATION_TESTS=1 to run DB-backed integration tests.");
    return;
  }

  await prisma.$connect();

  const membership = await prisma.orgMember.findUnique({
    where: {
      orgId_userId: {
        orgId: SEED_ORG_ID,
        userId: SEED_ACTOR_USER_ID
      }
    },
    select: {
      userId: true
    }
  });

  if (!membership) {
    t.skip("Seed membership not found. Run `npm run db:seed` first.");
    await prisma.$disconnect();
    return;
  }

  const conversation = await prisma.conversation.findFirst({
    where: {
      orgId: SEED_ORG_ID
    },
    orderBy: {
      createdAt: "asc"
    },
    select: {
      id: true,
      customerId: true
    }
  });

  if (!conversation) {
    t.skip("Seed conversation not found. Run `npm run db:seed` first.");
    await prisma.$disconnect();
    return;
  }

  const bankAccountsBefore = await prisma.orgBankAccount.findMany({
    where: {
      orgId: SEED_ORG_ID
    },
    orderBy: {
      createdAt: "asc"
    },
    take: 5,
    select: {
      bankName: true,
      accountNumber: true,
      accountHolder: true
    }
  });

  let invoiceId: string | null = null;
  let mutatedBankId: string | null = null;
  let originalHolder: string | null = null;

  try {
    const created = await createDraftInvoice({
      actorUserId: SEED_ACTOR_USER_ID,
      orgId: SEED_ORG_ID,
      customerId: conversation.customerId,
      conversationId: conversation.id,
      kind: InvoiceKind.FULL,
      currency: "IDR",
      items: [
        {
          name: "[IT] Snapshot Validation Service",
          qty: 1,
          priceCents: 250_000
        }
      ]
    });
    invoiceId = created.id;

    const createdInvoice = await prisma.invoice.findUniqueOrThrow({
      where: {
        id: created.id
      },
      select: {
        bankAccountsJson: true
      }
    });
    const parsedSnapshot = JSON.parse(createdInvoice.bankAccountsJson) as Array<{
      bankName: string;
      accountNumber: string;
      accountHolder: string;
    }>;
    assert.deepEqual(parsedSnapshot, bankAccountsBefore);

    const firstBank = await prisma.orgBankAccount.findFirst({
      where: {
        orgId: SEED_ORG_ID
      },
      orderBy: {
        createdAt: "asc"
      },
      select: {
        id: true,
        accountHolder: true
      }
    });

    if (!firstBank) {
      t.skip("No bank account found in seed org.");
      return;
    }

    mutatedBankId = firstBank.id;
    originalHolder = firstBank.accountHolder;
    await prisma.orgBankAccount.update({
      where: {
        id: firstBank.id
      },
      data: {
        accountHolder: `${firstBank.accountHolder} [MUTATED]`
      }
    });

    const invoiceAfterMutation = await prisma.invoice.findUniqueOrThrow({
      where: {
        id: created.id
      },
      select: {
        bankAccountsJson: true
      }
    });
    const snapshotAfterMutation = JSON.parse(invoiceAfterMutation.bankAccountsJson) as Array<{
      bankName: string;
      accountNumber: string;
      accountHolder: string;
    }>;
    assert.deepEqual(snapshotAfterMutation, bankAccountsBefore);
  } finally {
    if (mutatedBankId && originalHolder) {
      await prisma.orgBankAccount.update({
        where: {
          id: mutatedBankId
        },
        data: {
          accountHolder: originalHolder
        }
      });
    }

    if (invoiceId) {
      await prisma.paymentProof.deleteMany({
        where: {
          orgId: SEED_ORG_ID,
          invoiceId
        }
      });
      await prisma.paymentMilestone.deleteMany({
        where: {
          orgId: SEED_ORG_ID,
          invoiceId
        }
      });
      await prisma.invoiceItem.deleteMany({
        where: {
          orgId: SEED_ORG_ID,
          invoiceId
        }
      });
      await prisma.invoice.deleteMany({
        where: {
          orgId: SEED_ORG_ID,
          id: invoiceId
        }
      });
    }

    await prisma.$disconnect();
  }
});
