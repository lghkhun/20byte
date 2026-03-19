import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizeLimit,
  normalizeOptionalName,
  normalizePage,
  normalizeValue,
  resolveLastMessagePreview,
  validatePhoneE164
} from "@/server/services/conversation/utils";
import { ServiceError } from "@/server/services/serviceError";

test("validatePhoneE164 accepts canonical values and trims whitespace", () => {
  assert.equal(validatePhoneE164("+628123456789"), "+628123456789");
  assert.equal(validatePhoneE164("  +16505551234  "), "+16505551234");
});

test("validatePhoneE164 rejects non E.164 formats", () => {
  assert.equal(validatePhoneE164("08123456789"), "+628123456789");

  assert.throws(
    () => validatePhoneE164("+0123456789"),
    (error: unknown) => error instanceof ServiceError && error.code === "INVALID_PHONE_E164"
  );
});

test("resolveLastMessagePreview prioritizes text and truncates long text", () => {
  assert.equal(
    resolveLastMessagePreview({ text: "hello", type: "TEXT", fileName: null }),
    "hello"
  );

  const longText = "x".repeat(81);
  const preview = resolveLastMessagePreview({ text: longText, type: "TEXT", fileName: null });
  assert.equal(preview?.length, 80);
  assert.equal(preview?.endsWith("..."), true);
});

test("resolveLastMessagePreview maps non-text message types", () => {
  assert.equal(resolveLastMessagePreview({ text: null, type: "IMAGE", fileName: null }), "Image");
  assert.equal(resolveLastMessagePreview({ text: null, type: "VIDEO", fileName: null }), "Video");
  assert.equal(resolveLastMessagePreview({ text: null, type: "AUDIO", fileName: null }), "Audio");
  assert.equal(
    resolveLastMessagePreview({ text: null, type: "DOCUMENT", fileName: "proof.pdf" }),
    "Document: proof.pdf"
  );
  assert.equal(resolveLastMessagePreview({ text: null, type: "SYSTEM", fileName: null }), "System update");
  assert.equal(resolveLastMessagePreview({ text: null, type: "UNKNOWN", fileName: null }), null);
});

test("normalize helpers keep deterministic bounds", () => {
  assert.equal(normalizeValue("  abc  "), "abc");
  assert.equal(normalizeOptionalName(undefined), undefined);
  assert.equal(normalizeOptionalName("   "), undefined);
  assert.equal(normalizeOptionalName("  Jane  "), "Jane");

  assert.equal(normalizePage(undefined), 1);
  assert.equal(normalizePage(0), 1);
  assert.equal(normalizePage(2.9), 2);

  assert.equal(normalizeLimit(undefined), 20);
  assert.equal(normalizeLimit(0), 20);
  assert.equal(normalizeLimit(33.9), 33);
  assert.equal(normalizeLimit(999), 100);
});
