import test from "node:test";
import assert from "node:assert/strict";

import { buildPublicInvoiceUrl, createPublicToken } from "@/server/services/invoice/invoiceUtils";
import { formatInvoiceNumber, getInvoiceYearRange } from "@/server/services/invoiceNumberService";

test("formatInvoiceNumber pads sequence and enforces minimum sequence 1", () => {
  assert.equal(formatInvoiceNumber(2026, 1), "INV-2026-0001");
  assert.equal(formatInvoiceNumber(2026, 25), "INV-2026-0025");
  assert.equal(formatInvoiceNumber(2026, 9999), "INV-2026-9999");
  assert.equal(formatInvoiceNumber(2026, 0), "INV-2026-0001");
});

test("getInvoiceYearRange returns UTC start and exclusive end", () => {
  const { start, end } = getInvoiceYearRange(2026);

  assert.equal(start.toISOString(), "2026-01-01T00:00:00.000Z");
  assert.equal(end.toISOString(), "2027-01-01T00:00:00.000Z");
  assert.equal(end.getTime() - start.getTime(), 365 * 24 * 60 * 60 * 1000);
});

test("createPublicToken returns url-safe token with expected entropy length", () => {
  const tokenA = createPublicToken();
  const tokenB = createPublicToken();

  assert.equal(tokenA.length, 32);
  assert.equal(tokenB.length, 32);
  assert.equal(/^[A-Za-z0-9_-]+$/.test(tokenA), true);
  assert.equal(tokenA === tokenB, false);
});

test("buildPublicInvoiceUrl prefers APP_URL then NEXTAUTH_URL then localhost fallback", () => {
  const originalAppUrl = process.env.APP_URL;
  const originalNextAuthUrl = process.env.NEXTAUTH_URL;

  try {
    process.env.APP_URL = "https://app.example.com/";
    process.env.NEXTAUTH_URL = "https://nextauth.example.com";
    assert.equal(buildPublicInvoiceUrl("tok123"), "https://app.example.com/i/tok123");

    delete process.env.APP_URL;
    process.env.NEXTAUTH_URL = "https://nextauth.example.com/";
    assert.equal(buildPublicInvoiceUrl("tok456"), "https://nextauth.example.com/i/tok456");

    delete process.env.APP_URL;
    delete process.env.NEXTAUTH_URL;
    assert.equal(buildPublicInvoiceUrl("tok789"), "http://localhost:3000/i/tok789");
  } finally {
    if (originalAppUrl === undefined) {
      delete process.env.APP_URL;
    } else {
      process.env.APP_URL = originalAppUrl;
    }

    if (originalNextAuthUrl === undefined) {
      delete process.env.NEXTAUTH_URL;
    } else {
      process.env.NEXTAUTH_URL = originalNextAuthUrl;
    }
  }
});
