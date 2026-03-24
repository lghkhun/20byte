import test from "node:test";
import assert from "node:assert/strict";

import { SubscriptionStatus } from "@prisma/client";

import {
  calculateGatewayFeeCents,
  calculateTotalChargeCents,
  computeSubscriptionAccessState
} from "@/server/services/billingService";

test("gateway fee uses ceil on 2%", () => {
  assert.equal(calculateGatewayFeeCents(99_000, 200), 1_980);
  assert.equal(calculateGatewayFeeCents(99_001, 200), 1_981);
  assert.equal(calculateTotalChargeCents(99_000, 200), 100_980);
});

test("trialing remains unlocked during trial+grace then locks", () => {
  const trialEndAt = new Date("2026-03-10T00:00:00.000Z");

  const beforeGraceEnd = computeSubscriptionAccessState({
    status: SubscriptionStatus.TRIALING,
    trialEndAt,
    graceDays: 3,
    currentPeriodEndAt: null,
    now: new Date("2026-03-12T12:00:00.000Z")
  });
  assert.equal(beforeGraceEnd.isLocked, false);

  const afterGraceEnd = computeSubscriptionAccessState({
    status: SubscriptionStatus.TRIALING,
    trialEndAt,
    graceDays: 3,
    currentPeriodEndAt: null,
    now: new Date("2026-03-13T00:00:01.000Z")
  });
  assert.equal(afterGraceEnd.isLocked, true);
});

test("active status locks if current period ended", () => {
  const activeValid = computeSubscriptionAccessState({
    status: SubscriptionStatus.ACTIVE,
    trialEndAt: new Date("2026-03-10T00:00:00.000Z"),
    graceDays: 3,
    currentPeriodEndAt: new Date("2026-04-01T00:00:00.000Z"),
    now: new Date("2026-03-20T00:00:00.000Z")
  });
  assert.equal(activeValid.isLocked, false);

  const activeExpired = computeSubscriptionAccessState({
    status: SubscriptionStatus.ACTIVE,
    trialEndAt: new Date("2026-03-10T00:00:00.000Z"),
    graceDays: 3,
    currentPeriodEndAt: new Date("2026-03-19T00:00:00.000Z"),
    now: new Date("2026-03-20T00:00:00.000Z")
  });
  assert.equal(activeExpired.isLocked, true);
});
