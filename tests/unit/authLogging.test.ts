import test from "node:test";
import assert from "node:assert/strict";

import { logAuthFailure } from "@/lib/logging/auth";

type LoggedPayload = {
  scope: string;
  event: string;
  reason: string;
  emailMasked?: string;
  path?: string;
  method?: string;
  ip?: string;
  userAgent?: string;
  at: string;
};

function captureAuthLog(fn: () => void): LoggedPayload {
  const originalWarn = console.warn;
  let captured = "";

  console.warn = (value?: unknown) => {
    captured = String(value ?? "");
  };

  try {
    fn();
  } finally {
    console.warn = originalWarn;
  }

  assert.notEqual(captured, "");
  return JSON.parse(captured) as LoggedPayload;
}

test("logAuthFailure writes structured payload with masked email and normalized ip", () => {
  const payload = captureAuthLog(() => {
    logAuthFailure({
      reason: "LOGIN_INVALID_PASSWORD",
      email: "John.Doe@example.com",
      path: "/api/auth/login",
      method: "POST",
      ip: "203.0.113.10, 10.0.0.1",
      userAgent: "Mozilla/5.0"
    });
  });

  assert.equal(payload.scope, "auth");
  assert.equal(payload.event, "auth_failure");
  assert.equal(payload.reason, "LOGIN_INVALID_PASSWORD");
  assert.equal(payload.emailMasked, "jo***@example.com");
  assert.equal(payload.path, "/api/auth/login");
  assert.equal(payload.method, "POST");
  assert.equal(payload.ip, "203.0.113.10");
  assert.equal(payload.userAgent, "Mozilla/5.0");
  assert.equal(Number.isNaN(Date.parse(payload.at)), false);
});

test("logAuthFailure masks short local-part email and handles invalid email input", () => {
  const shortEmail = captureAuthLog(() => {
    logAuthFailure({
      reason: "LOGIN_USER_NOT_FOUND",
      email: "ab@example.com"
    });
  });
  assert.equal(shortEmail.emailMasked, "**@example.com");

  const malformed = captureAuthLog(() => {
    logAuthFailure({
      reason: "LOGIN_USER_NOT_FOUND",
      email: "not-an-email"
    });
  });
  assert.equal(malformed.emailMasked, "unknown");
});

test("logAuthFailure keeps optional fields undefined when absent", () => {
  const payload = captureAuthLog(() => {
    logAuthFailure({
      reason: "API_MISSING_SESSION"
    });
  });

  assert.equal(payload.emailMasked, undefined);
  assert.equal(payload.path, undefined);
  assert.equal(payload.method, undefined);
  assert.equal(payload.ip, undefined);
  assert.equal(payload.userAgent, undefined);
});
