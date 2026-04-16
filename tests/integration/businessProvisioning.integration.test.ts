import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { BillingChargeStatus, Role, SubscriptionStatus } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import {
  createBusinessProvisioningCheckout,
  getBusinessProvisioningOrderView,
  processPakasirWebhook
} from "@/server/services/billingService";
import { getActiveOrganizationForUser, listOrganizationsForUser } from "@/server/services/organizationService";

const RUN_INTEGRATION = process.env.RUN_DB_INTEGRATION_TESTS === "1";
const SEED_OWNER_USER_ID = "seed_user_owner";
const FALLBACK_ACTOR_USER_ID = "seed_user_admin";

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
}

test("business provisioning end-to-end: checkout -> paid webhook -> org created and selectable", async (t) => {
  if (!RUN_INTEGRATION) {
    t.skip("Set RUN_DB_INTEGRATION_TESTS=1 to run DB-backed integration tests.");
    return;
  }

  await prisma.$connect();
  let createdActorUserId: string | null = null;

  const ownerMembership = await prisma.orgMember.findFirst({
    where: {
      userId: SEED_OWNER_USER_ID,
      role: Role.OWNER
    },
    select: {
      orgId: true
    }
  });

  let actorUserId = SEED_OWNER_USER_ID;
  let bootstrapOrgId: string | null = null;

  if (!ownerMembership) {
    const fallbackUser = await prisma.user.findUnique({
      where: {
        id: FALLBACK_ACTOR_USER_ID
      },
      select: {
        id: true
      }
    });

    const fallbackUserId = fallbackUser?.id ?? `it_user_${randomUUID().replace(/-/g, "").slice(0, 20)}`;
    if (!fallbackUser) {
      await prisma.user.create({
        data: {
          id: fallbackUserId,
          email: `${fallbackUserId}@it.local`,
          name: "IT Provisioning Owner"
        }
      });
      createdActorUserId = fallbackUserId;
    }

    bootstrapOrgId = `it_owner_bootstrap_${Date.now()}`;
    await prisma.org.create({
      data: {
        id: bootstrapOrgId,
        name: `[IT] Owner Bootstrap ${Date.now()}`
      }
    });
    await prisma.orgMember.create({
      data: {
        orgId: bootstrapOrgId,
        userId: fallbackUserId,
        role: Role.OWNER
      }
    });
    actorUserId = fallbackUserId;
  }

  const originalFetch = globalThis.fetch;
  let createdProvisioningOrderId: string | null = null;
  let createdOrgId: string | null = null;

  try {
    globalThis.fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.includes("/api/transactioncreate/")) {
        const body =
          typeof init?.body === "string" ? (JSON.parse(init.body) as { order_id?: string; amount?: number }) : {};
        const orderId = body.order_id ?? `BIZ-MOCK-${Date.now()}`;
        const amount = Number(body.amount ?? 0);

        return jsonResponse({
          status: "ok",
          payment: {
            order_id: orderId,
            payment_method: "qris",
            payment_number: "00020101021226670016COM.NOBUBANK.WWW01189360050300000879140214561234567890150303UMI51440014ID.CO.QRIS.WWW0215ID10243240840580303UMI5204481453033605802ID5910TEST STORE6007JAKARTA61051234062070703A016304A13F",
            amount,
            fee: 0,
            total_payment: amount,
            expired_at: new Date(Date.now() + 15 * 60 * 1000).toISOString()
          }
        });
      }

      if (url.includes("/api/transactiondetail")) {
        const parsedUrl = new URL(url);
        const orderId = parsedUrl.searchParams.get("order_id") ?? "";
        const amount = Number(parsedUrl.searchParams.get("amount") ?? "0");
        return jsonResponse({
          transaction: {
            order_id: orderId,
            amount,
            status: "completed",
            payment_method: "qris",
            completed_at: new Date().toISOString()
          }
        });
      }

      return originalFetch(input, init);
    };

    const checkout = await createBusinessProvisioningCheckout({
      actorUserId,
      businessName: `[IT] Provisioning ${Date.now()}`,
      paymentMethod: "qris",
      planMonths: 3
    });

    createdProvisioningOrderId = checkout.order.id;

    assert.equal(checkout.order.status, BillingChargeStatus.PENDING);
    assert.equal(checkout.selectedPlan.months, 3);
    assert.equal(checkout.order.paymentMethod, "qris");

    const beforePaid = await getBusinessProvisioningOrderView({
      actorUserId,
      provisioningOrderId: checkout.order.id
    });
    assert.equal(beforePaid.status, BillingChargeStatus.PENDING);
    assert.equal(beforePaid.createdOrg, null);

    const webhookResult = await processPakasirWebhook({
      order_id: checkout.order.orderId,
      amount: checkout.selectedPlan.totalAmountCents,
      status: "paid"
    });

    assert.ok(webhookResult.provisioningOrder);

    const afterPaid = await getBusinessProvisioningOrderView({
      actorUserId,
      provisioningOrderId: checkout.order.id
    });
    assert.equal(afterPaid.status, BillingChargeStatus.PAID);
    assert.ok(afterPaid.createdOrg?.id);
    createdOrgId = afterPaid.createdOrg?.id ?? null;

    const newOwnerMembership = await prisma.orgMember.findUnique({
      where: {
        orgId_userId: {
          orgId: createdOrgId ?? "",
          userId: actorUserId
        }
      },
      select: {
        role: true
      }
    });
    assert.equal(newOwnerMembership?.role, Role.OWNER);

    const subscription = await prisma.orgSubscription.findUnique({
      where: {
        orgId: createdOrgId ?? ""
      },
      select: {
        status: true,
        trialStartAt: true,
        trialEndAt: true,
        currentPeriodStartAt: true,
        currentPeriodEndAt: true
      }
    });
    assert.equal(subscription?.status, SubscriptionStatus.ACTIVE);
    assert.equal(subscription?.trialStartAt.toISOString(), subscription?.trialEndAt.toISOString());
    assert.ok(subscription?.currentPeriodStartAt);
    assert.ok(subscription?.currentPeriodEndAt);

    const organizations = await listOrganizationsForUser(actorUserId);
    assert.ok(organizations.some((org) => org.id === createdOrgId));

    const selectedOrg = await getActiveOrganizationForUser(actorUserId, createdOrgId ?? "");
    assert.equal(selectedOrg?.id, createdOrgId);
  } finally {
    globalThis.fetch = originalFetch;

    if (createdProvisioningOrderId) {
      await prisma.ownerBusinessProvisioningOrder.deleteMany({
        where: {
          id: createdProvisioningOrderId
        }
      });
    }

    if (createdOrgId) {
      await prisma.orgSubscription.deleteMany({
        where: {
          orgId: createdOrgId
        }
      });
      await prisma.orgMember.deleteMany({
        where: {
          orgId: createdOrgId
        }
      });
      await prisma.org.deleteMany({
        where: {
          id: createdOrgId
        }
      });
    }

    if (bootstrapOrgId) {
      await prisma.orgSubscription.deleteMany({
        where: {
          orgId: bootstrapOrgId
        }
      });
      await prisma.orgMember.deleteMany({
        where: {
          orgId: bootstrapOrgId
        }
      });
      await prisma.org.deleteMany({
        where: {
          id: bootstrapOrgId
        }
      });
    }

    if (createdActorUserId) {
      await prisma.user.deleteMany({
        where: {
          id: createdActorUserId
        }
      });
    }

    await prisma.$disconnect();
  }
});
