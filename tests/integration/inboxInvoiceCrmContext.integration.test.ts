import assert from "node:assert/strict";
import test from "node:test";

import { MessageDirection, MessageType } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { getConversationCrmContext } from "@/server/services/inboxCrmService";
import { createDraftInvoice } from "@/server/services/invoice/draft";
import { markInvoicePaid } from "@/server/services/invoice/payment";
import { attachPaymentProofFromMessage } from "@/server/services/paymentProofService";

const RUN_INTEGRATION = process.env.RUN_DB_INTEGRATION_TESTS === "1";
const SEED_ORG_ID = "seed_org_alpha";
const SEED_ACTOR_USER_ID = "seed_user_admin";

test("invoice lifecycle is reflected in inbox CRM context timeline", async (t) => {
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
      id: true
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

  let invoiceId: string | null = null;
  let proofMessageId: string | null = null;

  try {
    const created = await createDraftInvoice({
      actorUserId: SEED_ACTOR_USER_ID,
      orgId: SEED_ORG_ID,
      customerId: conversation.customerId,
      conversationId: conversation.id,
      kind: "FULL",
      currency: "IDR",
      items: [
        {
          name: "[IT] Inbox CRM Timeline Validation",
          qty: 1,
          priceCents: 220_000
        }
      ]
    });
    invoiceId = created.id;

    await prisma.invoice.update({
      where: {
        id: created.id
      },
      data: {
        status: "SENT"
      }
    });

    await prisma.auditLog.create({
      data: {
        orgId: SEED_ORG_ID,
        actorUserId: SEED_ACTOR_USER_ID,
        action: "invoice.sent",
        entityType: "invoice",
        entityId: created.id,
        metaJson: JSON.stringify({
          invoiceNo: created.invoiceNo,
          source: "integration-test"
        })
      }
    });

    const proofMessage = await prisma.message.create({
      data: {
        orgId: SEED_ORG_ID,
        conversationId: conversation.id,
        direction: MessageDirection.INBOUND,
        type: MessageType.IMAGE,
        text: "[IT] proof",
        mediaUrl: "https://example.com/integration-proof.jpg",
        mimeType: "image/jpeg",
        fileName: "integration-proof.jpg",
        fileSize: 128_000
      },
      select: {
        id: true
      }
    });
    proofMessageId = proofMessage.id;

    const attachedProof = await attachPaymentProofFromMessage({
      actorUserId: SEED_ACTOR_USER_ID,
      orgId: SEED_ORG_ID,
      invoiceId: created.id,
      messageId: proofMessage.id,
      milestoneType: "FULL"
    });
    assert.equal(attachedProof.invoiceId, created.id);
    assert.equal(attachedProof.messageId, proofMessage.id);
    assert.equal(attachedProof.milestoneType, "FULL");

    const paid = await markInvoicePaid({
      actorUserId: SEED_ACTOR_USER_ID,
      orgId: SEED_ORG_ID,
      invoiceId: created.id,
      milestoneType: "FULL"
    });
    assert.equal(paid.id, created.id);
    assert.equal(paid.status, "PAID");

    const crm = await getConversationCrmContext({
      actorUserId: SEED_ACTOR_USER_ID,
      orgId: SEED_ORG_ID,
      conversationId: conversation.id
    });

    const invoiceEntry = crm.invoices.find((row) => row.id === created.id);
    assert.ok(invoiceEntry);
    assert.equal(invoiceEntry?.invoiceNo, created.invoiceNo);
    assert.equal(invoiceEntry?.status, "PAID");
    assert.equal(invoiceEntry?.proofCount, 1);

    const eventsForInvoice = crm.events.filter((event) => event.label.includes(created.invoiceNo));
    assert.ok(eventsForInvoice.some((event) => event.type === "INVOICE_CREATED" && event.label.includes("dibuat")));
    assert.ok(eventsForInvoice.some((event) => event.type === "INVOICE_SENT" && event.label.includes("dikirim ke pelanggan")));
    assert.ok(eventsForInvoice.some((event) => event.type === "PROOF_ATTACHED" && event.label.includes("Bukti pembayaran terlampir")));
    assert.ok(eventsForInvoice.some((event) => event.type === "INVOICE_PAID" && event.label.includes("ditandai lunas")));
    eventsForInvoice.forEach((event) => {
      assert.ok(event.time instanceof Date);
    });

    for (let index = 1; index < crm.events.length; index += 1) {
      const previous = crm.events[index - 1];
      const current = crm.events[index];
      assert.ok(previous && current);
      assert.ok(previous.time.getTime() >= current.time.getTime());
    }
  } finally {
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
      await prisma.auditLog.deleteMany({
        where: {
          orgId: SEED_ORG_ID,
          entityType: "invoice",
          entityId: invoiceId
        }
      });
    }

    if (proofMessageId) {
      await prisma.message.deleteMany({
        where: {
          orgId: SEED_ORG_ID,
          id: proofMessageId
        }
      });
    }

    await prisma.$disconnect();
  }
});
