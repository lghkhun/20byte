import test from "node:test";
import assert from "node:assert/strict";

import { appendInvisibleAttributionMarker, extractInvisibleAttributionMarker } from "@/lib/ctwa/invisibleMarker";

test("marker roundtrip keeps message clean and restores shortlink code", () => {
  const original = "Hello from campaign";
  const code = "abc123z";

  const encoded = appendInvisibleAttributionMarker(original, code);
  const extracted = extractInvisibleAttributionMarker(encoded);

  assert.equal(extracted.cleanText, original);
  assert.equal(extracted.shortlinkCode, code);
});

test("extract handles plain text without marker", () => {
  const message = "No marker text";
  const extracted = extractInvisibleAttributionMarker(message);

  assert.equal(extracted.cleanText, message);
  assert.equal(extracted.shortlinkCode, undefined);
});

test("invalid marker chars are ignored safely", () => {
  const extracted = extractInvisibleAttributionMarker("x\u2063broken\u2063y");

  assert.equal(extracted.shortlinkCode, undefined);
  assert.equal(extracted.cleanText, "xy");
});
