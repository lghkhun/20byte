import test from "node:test";
import assert from "node:assert/strict";

import {
  assertWhatsAppDestination,
  normalizeShortlinkValue,
  resolveShortlinkAttribution
} from "@/server/services/shortlink/policy";
import { ServiceError } from "@/server/services/serviceError";

test("assertWhatsAppDestination accepts wa.me and api.whatsapp.com/send", () => {
  assert.doesNotThrow(() => assertWhatsAppDestination("https://wa.me/628123456789"));
  assert.doesNotThrow(() => assertWhatsAppDestination("https://api.whatsapp.com/send?phone=628123456789"));
});

test("assertWhatsAppDestination rejects non-whatsapp domain", () => {
  assert.throws(
    () => assertWhatsAppDestination("https://example.com/path"),
    (error: unknown) => error instanceof ServiceError && error.code === "INVALID_DESTINATION_URL"
  );
});

test("resolveShortlinkAttribution applies fallback precedence", () => {
  const resolved = resolveShortlinkAttribution({
    source: " ",
    campaign: "campaign-a",
    platform: "adset-from-platform",
    medium: "ad-from-medium"
  });

  assert.equal(resolved.source, "meta_ads");
  assert.equal(resolved.campaign, "campaign-a");
  assert.equal(resolved.adset, "adset-from-platform");
  assert.equal(resolved.adName, "ad-from-medium");
});

test("resolveShortlinkAttribution prefers explicit adset/ad over compatibility fields", () => {
  const resolved = resolveShortlinkAttribution({
    source: "meta_ads",
    adset: "explicit-adset",
    ad: "explicit-ad",
    platform: "legacy-platform",
    medium: "legacy-medium"
  });

  assert.equal(resolved.adset, "explicit-adset");
  assert.equal(resolved.adName, "explicit-ad");
});

test("normalizeShortlinkValue trims safely", () => {
  assert.equal(normalizeShortlinkValue("  abc  "), "abc");
  assert.equal(normalizeShortlinkValue(undefined), "");
});
