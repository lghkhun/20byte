import test from "node:test";
import assert from "node:assert/strict";

import { NextRequest } from "next/server";

import { POST as pakasirWebhookPost } from "@/app/api/billing/webhooks/pakasir/route";
import { POST as setPasswordPost } from "@/app/api/auth/set-password/route";
import { parseSuperadminSubscriptionAction } from "@/server/services/superadminService";

function jsonRequest(url: string, body: unknown, headers?: Record<string, string>): NextRequest {
  return new NextRequest(
    new Request(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(headers ?? {})
      },
      body: JSON.stringify(body)
    })
  );
}

test("pakasir webhook rejects invalid token when webhook token is configured", async () => {
  process.env.PAKASIR_PROJECT_SLUG = "demo";
  process.env.PAKASIR_API_KEY = "demo-key";
  process.env.PAKASIR_WEBHOOK_TOKEN = "expected-token";

  const response = await pakasirWebhookPost(
    jsonRequest("http://localhost/api/billing/webhooks/pakasir", {
      order_id: "ORD-1",
      amount: 100980,
      status: "completed"
    }, {
      "x-pakasir-token": "wrong-token"
    })
  );

  assert.equal(response.status, 401);
  const payload = (await response.json()) as { error?: { code?: string } };
  assert.equal(payload.error?.code, "INVALID_WEBHOOK_TOKEN");
});

test("set-password returns invalid json error for malformed payload", async () => {
  const request = new NextRequest(
    new Request("http://localhost/api/auth/set-password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: "{"
    })
  );

  const response = await setPasswordPost(request);
  assert.equal(response.status, 400);
  const payload = (await response.json()) as { error?: { code?: string } };
  assert.equal(payload.error?.code, "INVALID_JSON");
});

test("parse superadmin subscription action accepts only supported actions", () => {
  assert.equal(parseSuperadminSubscriptionAction("MARK_ACTIVE"), "MARK_ACTIVE");
  assert.equal(parseSuperadminSubscriptionAction("MARK_PAST_DUE"), "MARK_PAST_DUE");
  assert.equal(parseSuperadminSubscriptionAction("CANCEL"), "CANCEL");
  assert.equal(parseSuperadminSubscriptionAction("EXTEND_TRIAL"), "EXTEND_TRIAL");
  assert.equal(parseSuperadminSubscriptionAction("INVALID"), null);
});
