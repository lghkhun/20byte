import assert from "node:assert/strict";
import test from "node:test";

import { parsePlatformMemberEnabled } from "@/app/api/sa/platform-members/routeGuards";
import { parseOptionalBooleanField } from "@/server/services/platformCouponService";
import { ServiceError } from "@/server/services/serviceError";

function readServiceError(thunk: () => unknown): ServiceError {
  try {
    thunk();
    throw new Error("Expected ServiceError");
  } catch (error) {
    assert.equal(error instanceof ServiceError, true);
    return error as ServiceError;
  }
}

test("parsePlatformMemberEnabled accepts only boolean", () => {
  assert.equal(parsePlatformMemberEnabled(true), true);
  assert.equal(parsePlatformMemberEnabled(false), false);

  const error = readServiceError(() => parsePlatformMemberEnabled("false"));
  assert.equal(error.code, "INVALID_ENABLED");
});

test("parseOptionalBooleanField enforces strict boolean type", () => {
  assert.equal(parseOptionalBooleanField(undefined, "isActive"), undefined);
  assert.equal(parseOptionalBooleanField(true, "isActive"), true);
  assert.equal(parseOptionalBooleanField(false, "isActive"), false);

  const error = readServiceError(() => parseOptionalBooleanField("false", "isActive"));
  assert.equal(error.code, "INVALID_COUPON_FIELD");
});
