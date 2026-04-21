import assert from "node:assert/strict";
import test from "node:test";

import { isReservedSuperadminSignupEmail } from "@/server/services/authService";
import { isSuperadminAllowlistedEmail } from "@/server/services/platformAccessService";
import { ServiceError } from "@/server/services/serviceError";
import { assertCanRevokeSuperadmin, normalizePlatformAuditLogLimit } from "@/server/services/superadminService";

function expectServiceError(thunk: () => void): ServiceError {
  try {
    thunk();
    throw new Error("Expected ServiceError");
  } catch (error) {
    assert.equal(error instanceof ServiceError, true);
    return error as ServiceError;
  }
}

test("superadmin allowlist email detection is normalized", () => {
  const allowlist = new Set(["owner@example.com"]);
  assert.equal(isSuperadminAllowlistedEmail("OWNER@example.com ", allowlist), true);
  assert.equal(isSuperadminAllowlistedEmail("user@example.com", allowlist), false);
});

test("reserved superadmin signup email blocks public registration target", () => {
  const allowlist = new Set(["reserved@example.com"]);
  assert.equal(isReservedSuperadminSignupEmail("reserved@example.com", allowlist), true);
  assert.equal(isReservedSuperadminSignupEmail("other@example.com", allowlist), false);
});

test("assertCanRevokeSuperadmin blocks self-revoke", () => {
  const error = expectServiceError(() => {
    assertCanRevokeSuperadmin({
      actorUserId: "user_a",
      targetUserId: "user_a",
      isTargetSuperadmin: true,
      superadminCount: 2
    });
  });
  assert.equal(error.code, "CANNOT_REVOKE_SELF");
});

test("assertCanRevokeSuperadmin blocks revoking last superadmin", () => {
  const error = expectServiceError(() => {
    assertCanRevokeSuperadmin({
      actorUserId: "user_a",
      targetUserId: "user_b",
      isTargetSuperadmin: true,
      superadminCount: 1
    });
  });
  assert.equal(error.code, "CANNOT_REVOKE_LAST_SUPERADMIN");
});

test("assertCanRevokeSuperadmin allows revoke when policy is safe", () => {
  assert.doesNotThrow(() => {
    assertCanRevokeSuperadmin({
      actorUserId: "user_a",
      targetUserId: "user_b",
      isTargetSuperadmin: true,
      superadminCount: 2
    });
  });
});

test("normalizePlatformAuditLogLimit uses safe default and cap", () => {
  assert.equal(normalizePlatformAuditLogLimit(undefined), 100);
  assert.equal(normalizePlatformAuditLogLimit(-10), 1);
  assert.equal(normalizePlatformAuditLogLimit(50.9), 50);
  assert.equal(normalizePlatformAuditLogLimit(6000), 5000);
});
