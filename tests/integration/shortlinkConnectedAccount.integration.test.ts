import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { prisma } from "@/lib/db/prisma";
import { createShortlink } from "@/server/services/shortlinkService";

const RUN_INTEGRATION = process.env.RUN_DB_INTEGRATION_TESTS === "1";
const SEED_ORG_ID = "seed_org_alpha";
const SEED_ACTOR_USER_ID = "seed_user_admin";

function extractDigits(value: string): string {
  return value.replace(/\D/g, "");
}

test("shortlink create uses connected org WhatsApp number even if metadata is non-baileys", async (t) => {
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

  const existingWaAccount = await prisma.waAccount.findUnique({
    where: {
      orgId: SEED_ORG_ID
    },
    select: {
      id: true,
      metaBusinessId: true,
      wabaId: true,
      displayPhone: true,
      phoneNumberId: true
    }
  });

  if (!existingWaAccount) {
    t.skip("Seed waAccount not found. Connect WhatsApp for seed_org_alpha first.");
    await prisma.$disconnect();
    return;
  }

  const expectedPhone = extractDigits(existingWaAccount.displayPhone) || extractDigits(existingWaAccount.phoneNumberId);
  if (!expectedPhone) {
    t.skip("waAccount has no usable phone number.");
    await prisma.$disconnect();
    return;
  }

  let createdShortlinkId: string | null = null;
  try {
    await prisma.waAccount.update({
      where: {
        id: existingWaAccount.id
      },
      data: {
        metaBusinessId: `meta-${randomUUID()}`,
        wabaId: `waba-${randomUUID()}`
      }
    });

    const created = await createShortlink({
      actorUserId: SEED_ACTOR_USER_ID,
      orgId: SEED_ORG_ID,
      campaign: `[IT] non-baileys-fallback-${Date.now()}`,
      templateMessage: "Halo dari integration test"
    });
    createdShortlinkId = created.id;

    assert.equal(created.waPhone, expectedPhone);
    assert.match(created.destinationUrl, new RegExp(`^https://wa\\.me/${expectedPhone}(\\?|$)`));
  } finally {
    if (createdShortlinkId) {
      await prisma.shortlinkClick.deleteMany({
        where: {
          orgId: SEED_ORG_ID,
          shortlinkId: createdShortlinkId
        }
      });
      await prisma.shortlink.deleteMany({
        where: {
          orgId: SEED_ORG_ID,
          id: createdShortlinkId
        }
      });
    }

    await prisma.waAccount.update({
      where: {
        id: existingWaAccount.id
      },
      data: {
        metaBusinessId: existingWaAccount.metaBusinessId,
        wabaId: existingWaAccount.wabaId
      }
    });

    await prisma.$disconnect();
  }
});
