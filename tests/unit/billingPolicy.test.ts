import test from "node:test";
import assert from "node:assert/strict";

import { Role, SubscriptionStatus } from "@prisma/client";

import {
  calculateBillingPlanPricing,
  calculateGatewayFeeCents,
  calculateTotalChargeCents,
  createBusinessProvisioningOrderId,
  computeSubscriptionAccessState,
  computeSubscriptionReminderState,
  resolvePakasirCreateFailureMessage,
  resolvePakasirPaymentSummary
} from "@/server/services/billingService";

test("gateway fee uses ceil on 2%", () => {
  assert.equal(calculateGatewayFeeCents(99_000, 200), 1_980);
  assert.equal(calculateGatewayFeeCents(99_001, 200), 1_981);
  assert.equal(calculateTotalChargeCents(99_000, 200), 100_980);
});

test("pakasir payment summary keeps payable amount aligned with requested platform amount", () => {
  const summary = resolvePakasirPaymentSummary({
    payment: {
      amount: 100_980,
      fee: 1_017,
      total_payment: 101_997
    },
    fallbackRequestedAmountCents: 100_980
  });

  assert.equal(summary.requestedAmountCents, 100_980);
  assert.equal(summary.providerFeeCents, 1_017);
  assert.equal(summary.payableAmountCents, 100_980);
});

test("pakasir payment summary falls back safely when gateway total_payment missing", () => {
  const summary = resolvePakasirPaymentSummary({
    payment: {
      amount: 100_980,
      fee: 1_017
    },
    fallbackRequestedAmountCents: 100_980
  });

  assert.equal(summary.requestedAmountCents, 100_980);
  assert.equal(summary.providerFeeCents, 1_017);
  assert.equal(summary.payableAmountCents, 100_980);
});

test("billing plan pricing applies discount and extends renewal days by selected plan", () => {
  const plan3 = calculateBillingPlanPricing({
    baseAmountCents: 99_000,
    gatewayFeeBps: 200,
    planMonths: 3
  });

  assert.equal(plan3.rawBaseAmountCents, 297_000);
  assert.equal(plan3.discountCents, 29_700);
  assert.equal(plan3.netBaseAmountCents, 267_300);
  assert.equal(plan3.gatewayFeeCents, 5_346);
  assert.equal(plan3.totalAmountCents, 272_646);
  assert.equal(plan3.renewalDays, 84);
});

test("createBusinessProvisioningOrderId builds safe deterministic id", () => {
  const orderId = createBusinessProvisioningOrderId("user_clyx-TEST_123", 1_762_000_000_000);
  assert.match(orderId, /^BIZ-[a-z0-9]{1,8}-[A-Z0-9]+$/);
  assert.equal(orderId, "BIZ-xtest123-MHG9B18G00");
});

test("createBusinessProvisioningOrderId avoids collision in rapid generation", () => {
  const first = createBusinessProvisioningOrderId("user-owner", 1_762_000_000_001);
  const second = createBusinessProvisioningOrderId("user-owner", 1_762_000_000_001);
  const third = createBusinessProvisioningOrderId("user-owner", 1_762_000_000_001);

  assert.notEqual(first, second);
  assert.notEqual(second, third);
  assert.match(first, /^BIZ-[a-z0-9]{1,8}-[A-Z0-9]+$/);
  assert.match(second, /^BIZ-[a-z0-9]{1,8}-[A-Z0-9]+$/);
  assert.match(third, /^BIZ-[a-z0-9]{1,8}-[A-Z0-9]+$/);
});

test("createBusinessProvisioningOrderId appends entropy when nowMs is not explicitly provided", () => {
  const first = createBusinessProvisioningOrderId("user-owner");
  const second = createBusinessProvisioningOrderId("user-owner");

  assert.notEqual(first, second);
  assert.match(first, /^BIZ-[a-z0-9]{1,8}-[A-Z0-9]+$/);
  assert.match(second, /^BIZ-[a-z0-9]{1,8}-[A-Z0-9]+$/);
});

test("resolvePakasirCreateFailureMessage prefers gateway message payload", () => {
  const message = resolvePakasirCreateFailureMessage({
    status: 400,
    payload: {
      message: "metode tidak valid"
    },
    rawBody: "{\"message\":\"metode tidak valid\"}"
  });
  assert.equal(message, "Failed to create payment transaction: metode tidak valid");
});

test("resolvePakasirCreateFailureMessage falls back to generic message", () => {
  const message = resolvePakasirCreateFailureMessage({
    status: 502,
    payload: null,
    rawBody: ""
  });
  assert.equal(message, "Failed to create payment transaction.");
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

test("trial reminder appears for owner in H-3 window", () => {
  const reminder = computeSubscriptionReminderState({
    membershipRole: Role.OWNER,
    status: SubscriptionStatus.TRIALING,
    trialEndAt: new Date("2026-03-10T00:00:00.000Z"),
    currentPeriodEndAt: null,
    now: new Date("2026-03-08T10:00:00.000Z")
  });

  assert.equal(reminder.shouldShowBanner, true);
  assert.equal(reminder.shouldBroadcastWhatsapp, true);
  assert.equal(reminder.daysRemaining, 2);
  assert.match(reminder.message, /Suka platform kami/i);
});

test("trial reminder hidden before H-3 or after trial end", () => {
  const beforeWindow = computeSubscriptionReminderState({
    membershipRole: Role.OWNER,
    status: SubscriptionStatus.TRIALING,
    trialEndAt: new Date("2026-03-10T00:00:00.000Z"),
    currentPeriodEndAt: null,
    now: new Date("2026-03-05T00:00:00.000Z")
  });
  assert.equal(beforeWindow.shouldShowBanner, false);

  const afterTrial = computeSubscriptionReminderState({
    membershipRole: Role.OWNER,
    status: SubscriptionStatus.TRIALING,
    trialEndAt: new Date("2026-03-10T00:00:00.000Z"),
    currentPeriodEndAt: null,
    now: new Date("2026-03-10T00:00:01.000Z")
  });
  assert.equal(afterTrial.shouldShowBanner, false);

  const activePlan = computeSubscriptionReminderState({
    membershipRole: Role.OWNER,
    status: SubscriptionStatus.ACTIVE,
    trialEndAt: new Date("2026-03-10T00:00:00.000Z"),
    currentPeriodEndAt: new Date("2026-04-01T00:00:00.000Z"),
    now: new Date("2026-03-20T00:00:00.000Z")
  });
  assert.equal(activePlan.shouldShowBanner, false);
});
