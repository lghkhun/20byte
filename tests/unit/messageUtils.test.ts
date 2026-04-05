import test from "node:test";
import assert from "node:assert/strict";

import {
  MESSAGE_TEXT_DB_MAX_LENGTH,
  normalize,
  normalizeFileSize,
  normalizeMessageText,
  normalizeLimit,
  normalizeOptional,
  normalizePage,
  normalizeSendError,
  normalizeSystemMessageText,
  normalizeTemplateComponents,
  normalizeTemplateLanguageCode,
  parseTemplateComponentsJson
} from "@/server/services/message/messageUtils";
import { ServiceError } from "@/server/services/serviceError";

test("normalize helpers keep deterministic defaults", () => {
  assert.equal(normalize("  abc  "), "abc");
  assert.equal(normalizeOptional(undefined), undefined);
  assert.equal(normalizeOptional("   "), undefined);
  assert.equal(normalizeOptional("  hi "), "hi");

  assert.equal(normalizeFileSize(undefined), undefined);
  assert.equal(normalizeFileSize(-1), undefined);
  assert.equal(normalizeFileSize(123.8), 123);

  assert.equal(normalizePage(undefined), 1);
  assert.equal(normalizePage(0), 1);
  assert.equal(normalizePage(2.8), 2);

  assert.equal(normalizeLimit(undefined), 30);
  assert.equal(normalizeLimit(0), 30);
  assert.equal(normalizeLimit(44.7), 44);
  assert.equal(normalizeLimit(999), 100);
});

test("template helpers normalize components and language fallback", () => {
  const components = normalizeTemplateComponents([
    { type: "body" },
    null as unknown as Record<string, unknown>,
    "invalid" as unknown as Record<string, unknown>
  ]);

  assert.equal(components.length, 1);
  assert.deepEqual(components[0], { type: "body" });
  assert.equal(normalizeTemplateLanguageCode(undefined), "en");
  assert.equal(normalizeTemplateLanguageCode("  id  "), "id");
});

test("normalizeSendError trims and limits to 500 chars", () => {
  const long = "x".repeat(800);
  const normalized = normalizeSendError(new Error(long));
  assert.equal(normalized.length, 500);

  assert.equal(normalizeSendError(new Error("  fail reason  ")), "fail reason");
  assert.equal(normalizeSendError(null), "Outbound send failed.");
});

test("normalizeMessageText trims and clamps to DB-safe max length", () => {
  assert.equal(normalizeMessageText(undefined), undefined);
  assert.equal(normalizeMessageText("   "), undefined);
  assert.equal(normalizeMessageText("  hi "), "hi");

  const tooLong = "x".repeat(MESSAGE_TEXT_DB_MAX_LENGTH + 40);
  const normalized = normalizeMessageText(tooLong);
  assert.equal(normalized?.length, MESSAGE_TEXT_DB_MAX_LENGTH);
});

test("normalizeSystemMessageText appends [Automated] and rejects empty", () => {
  assert.equal(normalizeSystemMessageText("Hello"), "Hello [Automated]");
  assert.equal(normalizeSystemMessageText("Hello [Automated]"), "Hello [Automated]");

  const long = "x".repeat(MESSAGE_TEXT_DB_MAX_LENGTH + 40);
  const normalizedLong = normalizeSystemMessageText(long);
  assert.equal(normalizedLong.length, MESSAGE_TEXT_DB_MAX_LENGTH);
  assert.match(normalizedLong, /\[Automated\]$/);

  assert.throws(
    () => normalizeSystemMessageText("   "),
    (error: unknown) => error instanceof ServiceError && error.code === "INVALID_MESSAGE_TEXT"
  );
});

test("parseTemplateComponentsJson safely handles malformed payloads", () => {
  assert.deepEqual(parseTemplateComponentsJson(null), []);
  assert.deepEqual(parseTemplateComponentsJson("not-json"), []);
  assert.deepEqual(parseTemplateComponentsJson('{"a":1}'), []);
  assert.deepEqual(parseTemplateComponentsJson('[{"type":"body"},null,1]'), [{ type: "body" }]);
});
