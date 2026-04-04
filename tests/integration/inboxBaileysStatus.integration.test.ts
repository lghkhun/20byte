import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { MessageDirection, MessageType } from "@prisma/client";
import { WAMessageStatus } from "baileys";

import { prisma } from "@/lib/db/prisma";
import { processBaileysOutboundStatusUpdate } from "@/server/services/message/baileysOutboundStatus";
import { updateOutboundDeliveryStatusByWaMessageId } from "@/server/services/message/outboundInfra/persistence";

const RUN_INTEGRATION = process.env.RUN_DB_INTEGRATION_TESTS === "1";
const SEED_ORG_ID = "seed_org_alpha";
const SEED_ACTOR_USER_ID = "seed_user_admin";

test("inbox outbound status from Baileys updates DB and emits conversation update payload", async (t) => {
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
      status: true,
      assignedToMemberId: true
    }
  });

  if (!conversation) {
    t.skip("Seed conversation not found. Run `npm run db:seed` first.");
    await prisma.$disconnect();
    return;
  }

  const waMessageId = `it-baileys-${randomUUID()}`;
  let createdMessageId: string | null = null;

  try {
    const created = await prisma.message.create({
      data: {
        orgId: SEED_ORG_ID,
        conversationId: conversation.id,
        waMessageId,
        direction: MessageDirection.OUTBOUND,
        type: MessageType.TEXT,
        text: "[IT] Baileys outbound status integration",
        sendStatus: "SENT",
        deliveryStatus: "SENT",
        sendAttemptCount: 1,
        retryable: false
      },
      select: {
        id: true
      }
    });
    createdMessageId = created.id;

    const updateCalls: Array<{ orgId: string; waMessageId: string; deliveryStatus: "SENT" | "DELIVERED" | "READ"; at?: Date }> = [];
    const publishedConversationUpdates: Array<{
      orgId: string;
      conversationId: string;
      assignedToMemberId: string | null;
      status: "OPEN" | "CLOSED";
    }> = [];

    const processed = await processBaileysOutboundStatusUpdate(
      SEED_ORG_ID,
      {
        key: {
          id: waMessageId,
          fromMe: true
        },
        update: {
          status: WAMessageStatus.READ
        }
      },
      {
        updateDeliveryStatusByWaMessageId: async (params) => {
          updateCalls.push(params);
          return updateOutboundDeliveryStatusByWaMessageId(params);
        },
        publishConversationUpdated: async (payload) => {
          publishedConversationUpdates.push(payload);
        }
      }
    );

    assert.ok(processed);
    assert.equal(processed?.messageId, created.id);
    assert.equal(processed?.conversationId, conversation.id);
    assert.equal(processed?.deliveryStatus, "READ");
    assert.ok(processed?.deliveredAt instanceof Date);
    assert.ok(processed?.readAt instanceof Date);

    const refreshed = await prisma.message.findUniqueOrThrow({
      where: {
        id: created.id
      },
      select: {
        deliveryStatus: true,
        deliveredAt: true,
        readAt: true
      }
    });

    assert.equal(refreshed.deliveryStatus, "READ");
    assert.ok(refreshed.deliveredAt instanceof Date);
    assert.ok(refreshed.readAt instanceof Date);

    assert.equal(updateCalls.length, 1);
    assert.equal(updateCalls[0]?.orgId, SEED_ORG_ID);
    assert.equal(updateCalls[0]?.waMessageId, waMessageId);
    assert.equal(updateCalls[0]?.deliveryStatus, "READ");

    assert.equal(publishedConversationUpdates.length, 1);
    assert.equal(publishedConversationUpdates[0]?.orgId, SEED_ORG_ID);
    assert.equal(publishedConversationUpdates[0]?.conversationId, conversation.id);
    assert.equal(publishedConversationUpdates[0]?.assignedToMemberId ?? null, conversation.assignedToMemberId ?? null);
    assert.equal(publishedConversationUpdates[0]?.status, conversation.status);
  } finally {
    if (createdMessageId) {
      await prisma.message.deleteMany({
        where: {
          id: createdMessageId,
          orgId: SEED_ORG_ID
        }
      });
    }
    await prisma.$disconnect();
  }
});
