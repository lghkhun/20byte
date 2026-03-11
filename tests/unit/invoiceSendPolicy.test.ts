import test from "node:test";
import assert from "node:assert/strict";
import { InvoiceStatus } from "@prisma/client";

import { assertInvoiceSendable, buildAutomatedInvoiceText } from "@/server/services/invoice/sendPolicy";
import { ServiceError } from "@/server/services/serviceError";

test("assertInvoiceSendable accepts DRAFT and SENT", () => {
  assert.doesNotThrow(() => assertInvoiceSendable(InvoiceStatus.DRAFT));
  assert.doesNotThrow(() => assertInvoiceSendable(InvoiceStatus.SENT));
});

test("assertInvoiceSendable rejects VOID and paid statuses", () => {
  assert.throws(
    () => assertInvoiceSendable(InvoiceStatus.VOID),
    (error: unknown) => error instanceof ServiceError && error.code === "INVOICE_VOID"
  );

  assert.throws(
    () => assertInvoiceSendable(InvoiceStatus.PAID),
    (error: unknown) => error instanceof ServiceError && error.code === "INVOICE_NOT_SENDABLE"
  );

  assert.throws(
    () => assertInvoiceSendable(InvoiceStatus.PARTIALLY_PAID),
    (error: unknown) => error instanceof ServiceError && error.code === "INVOICE_NOT_SENDABLE"
  );
});

test("buildAutomatedInvoiceText keeps automated marker and link", () => {
  const link = "http://localhost:3000/i/public-token";
  const text = buildAutomatedInvoiceText(link);

  assert.equal(text.includes(link), true);
  assert.equal(text.endsWith("[Automated]"), true);
});
