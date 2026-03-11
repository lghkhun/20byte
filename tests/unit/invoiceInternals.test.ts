import assert from "node:assert/strict";
import test from "node:test";

import { InvoiceKind, InvoiceStatus, PaymentMilestoneType } from "@prisma/client";

import { computeDraftInputDerived, normalizeConversationId } from "@/server/services/invoice/draftInternals";
import { buildInvoiceTimelineEvents } from "@/server/services/invoice/paymentInternals";

test("normalizeConversationId trims and normalizes empty values", () => {
  assert.equal(normalizeConversationId(undefined), undefined);
  assert.equal(normalizeConversationId(""), undefined);
  assert.equal(normalizeConversationId("   "), undefined);
  assert.equal(normalizeConversationId("  conv-1  "), "conv-1");
});

test("computeDraftInputDerived calculates totals and milestones for FULL kind", () => {
  const result = computeDraftInputDerived({
    actorUserId: "u1",
    orgId: "org1",
    customerId: "cust1",
    kind: InvoiceKind.FULL,
    currency: "IDR",
    items: [
      { name: "Website", qty: 2, priceCents: 500_000 },
      { name: "Hosting", qty: 1, priceCents: 200_000 }
    ]
  });

  assert.equal(result.subtotalCents, 1_200_000);
  assert.equal(result.totalCents, 1_200_000);
  assert.equal(result.normalizedItems.length, 2);
  assert.equal(result.normalizedMilestones.length, 1);
  assert.equal(result.normalizedMilestones[0]?.type, PaymentMilestoneType.FULL);
  assert.equal(result.normalizedMilestones[0]?.amountCents, 1_200_000);
});

test("computeDraftInputDerived respects custom milestones for DP_AND_FINAL", () => {
  const result = computeDraftInputDerived({
    actorUserId: "u1",
    orgId: "org1",
    customerId: "cust1",
    kind: InvoiceKind.DP_AND_FINAL,
    currency: "IDR",
    items: [{ name: "Project", qty: 1, priceCents: 1_000_000 }],
    milestones: [
      { type: PaymentMilestoneType.DP, amountCents: 300_000 },
      { type: PaymentMilestoneType.FINAL, amountCents: 700_000 }
    ]
  });

  assert.equal(result.totalCents, 1_000_000);
  assert.equal(result.normalizedMilestones.length, 2);
  assert.equal(result.normalizedMilestones[0]?.status, "PENDING");
  assert.equal(result.normalizedMilestones[1]?.status, "PENDING");
});

test("buildInvoiceTimelineEvents builds sorted timeline with completion event for PAID invoice", () => {
  const createdAt = new Date("2026-03-01T10:00:00.000Z");
  const sentAt = new Date("2026-03-02T10:00:00.000Z");
  const proofAt = new Date("2026-03-03T10:00:00.000Z");
  const paidAt = new Date("2026-03-04T10:00:00.000Z");

  const events = buildInvoiceTimelineEvents({
    invoiceId: "inv1",
    invoiceStatus: InvoiceStatus.PAID,
    invoiceCreatedAt: createdAt,
    auditRows: [
      { id: "a1", action: "invoice.sent", createdAt: sentAt },
      { id: "a2", action: "invoice.payment_marked", createdAt: paidAt }
    ],
    proofRows: [{ id: "p1", milestoneType: "DP", createdAt: proofAt }],
    paidRows: [{ id: "m1", type: "DP", paidAt }]
  });

  assert.ok(events.length >= 5);
  assert.equal(events[0]?.at.getTime() >= events[1]?.at.getTime(), true);
  assert.ok(events.some((event) => event.type === "INVOICE_CREATED"));
  assert.ok(events.some((event) => event.type === "INVOICE_SENT"));
  assert.ok(events.some((event) => event.type === "PROOF_ATTACHED"));
  assert.ok(events.some((event) => event.type === "INVOICE_COMPLETED"));
});

test("buildInvoiceTimelineEvents omits completion event when invoice not paid", () => {
  const events = buildInvoiceTimelineEvents({
    invoiceId: "inv2",
    invoiceStatus: InvoiceStatus.SENT,
    invoiceCreatedAt: new Date("2026-03-01T10:00:00.000Z"),
    auditRows: [],
    proofRows: [],
    paidRows: []
  });

  assert.equal(events.length, 1);
  assert.equal(events[0]?.type, "INVOICE_CREATED");
  assert.equal(events.some((event) => event.type === "INVOICE_COMPLETED"), false);
});
