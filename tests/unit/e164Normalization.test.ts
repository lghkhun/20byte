import test from "node:test";
import assert from "node:assert/strict";

import { normalizePossibleE164 } from "@/lib/whatsapp/e164";

test("normalizePossibleE164 accepts valid E.164 and preserves plus prefix", () => {
  assert.equal(normalizePossibleE164("+628123456789"), "+628123456789");
  assert.equal(normalizePossibleE164("628123456789"), "+628123456789");
});

test("normalizePossibleE164 strips formatting noise", () => {
  assert.equal(normalizePossibleE164(" +62 812-3456-789 "), "+628123456789");
  assert.equal(normalizePossibleE164("(+1) 650-555-1234"), "+16505551234");
});

test("normalizePossibleE164 rejects invalid values", () => {
  assert.equal(normalizePossibleE164(undefined), null);
  assert.equal(normalizePossibleE164(""), null);
  assert.equal(normalizePossibleE164("abc"), null);
  assert.equal(normalizePossibleE164("+0123456789"), null);
  assert.equal(normalizePossibleE164("+123"), null);
});
