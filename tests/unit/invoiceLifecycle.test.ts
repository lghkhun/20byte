import test from "node:test";
import assert from "node:assert/strict";
import { InvoiceKind, InvoiceStatus, PaymentMilestoneType } from "@prisma/client";

import { deriveInvoiceStatus, normalizeMilestones } from "@/server/services/invoice/invoiceUtils";
import { ServiceError } from "@/server/services/serviceError";

test("deriveInvoiceStatus transitions: SENT -> PARTIALLY_PAID -> PAID", () => {
  const allPending = [{ status: "PENDING" }, { status: "PENDING" }];
  const onePaid = [{ status: "PAID" }, { status: "PENDING" }];
  const allPaid = [{ status: "PAID" }, { status: "PAID" }];

  assert.equal(deriveInvoiceStatus(allPending, InvoiceStatus.SENT), InvoiceStatus.SENT);
  assert.equal(deriveInvoiceStatus(onePaid, InvoiceStatus.SENT), InvoiceStatus.PARTIALLY_PAID);
  assert.equal(deriveInvoiceStatus(allPaid, InvoiceStatus.SENT), InvoiceStatus.PAID);
});

test("deriveInvoiceStatus preserves VOID", () => {
  const milestones = [{ status: "PAID" }, { status: "PAID" }];
  assert.equal(deriveInvoiceStatus(milestones, InvoiceStatus.VOID), InvoiceStatus.VOID);
});

test("normalizeMilestones enforces FULL and DP_AND_FINAL rules", () => {
  const full = normalizeMilestones(InvoiceKind.FULL, 100_000, [
    { type: PaymentMilestoneType.FULL, amountCents: 100_000 }
  ]);
  assert.equal(full.length, 1);
  assert.equal(full[0]?.type, PaymentMilestoneType.FULL);

  const split = normalizeMilestones(InvoiceKind.DP_AND_FINAL, 100_000, [
    { type: PaymentMilestoneType.DP, amountCents: 50_000 },
    { type: PaymentMilestoneType.FINAL, amountCents: 50_000 }
  ]);
  assert.equal(split.length, 2);
});

test("normalizeMilestones rejects invalid milestone total", () => {
  assert.throws(
    () =>
      normalizeMilestones(InvoiceKind.DP_AND_FINAL, 100_000, [
        { type: PaymentMilestoneType.DP, amountCents: 20_000 },
        { type: PaymentMilestoneType.FINAL, amountCents: 20_000 }
      ]),
    (error: unknown) => error instanceof ServiceError && error.code === "INVALID_MILESTONE_TOTAL"
  );
});
