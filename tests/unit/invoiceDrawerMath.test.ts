import test from "node:test";
import assert from "node:assert/strict";

import { computeInvoiceLine, computeInvoiceSummary } from "@/components/invoices/invoice-drawer/types";

test("computeInvoiceLine applies qty, percentage discount, then tax on discounted base", () => {
  const line = computeInvoiceLine({
    id: "line-1",
    name: "Jasa Catering",
    qty: 50,
    priceCents: 300_000,
    unit: "porsi",
    description: "Paket prasmanan",
    discountType: "%",
    discountValue: 10,
    taxLabel: "PPN_11"
  });

  assert.equal(line.subtotalCents, 15_000_000);
  assert.equal(line.discountCents, 1_500_000);
  assert.equal(line.taxableBaseCents, 13_500_000);
  assert.equal(line.taxCents, 1_485_000);
  assert.equal(line.totalCents, 14_985_000);
});

test("computeInvoiceSummary combines item discounts, invoice discount, and tax", () => {
  const summary = computeInvoiceSummary(
    [
      {
        id: "line-1",
        name: "Setup venue",
        qty: 1,
        priceCents: 500_000,
        unit: "paket",
        description: "",
        discountType: "%",
        discountValue: 10,
        taxLabel: "PPN_11"
      },
      {
        id: "line-2",
        name: "Jasa Catering",
        qty: 50,
        priceCents: 300_000,
        unit: "porsi",
        description: "",
        discountType: "IDR",
        discountValue: 0,
        taxLabel: ""
      }
    ],
    "%",
    0
  );

  assert.equal(summary.subtotalCents, 15_500_000);
  assert.equal(summary.lineDiscountCents, 50_000);
  assert.equal(summary.invoiceDiscountCents, 0);
  assert.equal(summary.taxCents, 49_500);
  assert.equal(summary.totalCents, 15_499_500);
});
