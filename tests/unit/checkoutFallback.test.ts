import test from "node:test";
import assert from "node:assert/strict";

import { resolveCheckoutPaymentMethod, isLikelyQrisPayload } from "@/lib/payment/checkoutFallback";
import { normalizeLouvinCreatePayment } from "@/server/services/billingService";

test("resolveCheckoutPaymentMethod falls back to qris when method empty but payload looks like QRIS", () => {
  const method = resolveCheckoutPaymentMethod({
    paymentMethod: "",
    paymentNumber: "00020101021226670016COM.NOBUBANK.WWW01189360050300000879140214520011230755770303UKE51440014ID.CO.QRIS.WWW0215ID10264927570120303UMI520448165303360",
    fallbackMethod: "qris"
  });
  assert.equal(method, "qris");
});

test("resolveCheckoutPaymentMethod keeps explicit method when present", () => {
  const method = resolveCheckoutPaymentMethod({
    paymentMethod: "bni_va",
    paymentNumber: "12345",
    fallbackMethod: "qris"
  });
  assert.equal(method, "bni_va");
});

test("isLikelyQrisPayload detects EMV QR format", () => {
  assert.equal(isLikelyQrisPayload("000201010212"), true);
  assert.equal(isLikelyQrisPayload("SOME-TEXT"), false);
});

test("normalizeLouvinCreatePayment falls back method and qr_string", () => {
  const normalized = normalizeLouvinCreatePayment({
    payment: {
      payment_method: "",
      payment_number: "",
      qr_string: "0002010102122667",
      expired_at: "2026-04-30T12:00:00.000Z"
    },
    fallbackMethod: "qris",
    trace: "unit_test"
  });

  assert.equal(normalized.paymentMethod, "qris");
  assert.equal(normalized.paymentNumber, "0002010102122667");
  assert.ok(normalized.expiredAt instanceof Date);
});
