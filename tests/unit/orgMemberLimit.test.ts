import assert from "node:assert/strict";
import test from "node:test";
import { Role } from "@prisma/client";

import { assertNonOwnerMemberLimit } from "@/server/services/organizationService";
import { ServiceError } from "@/server/services/serviceError";

test("assertNonOwnerMemberLimit allows owner regardless of non-owner count", () => {
  assert.doesNotThrow(() => assertNonOwnerMemberLimit(Role.OWNER, 100));
});

test("assertNonOwnerMemberLimit allows non-owner below threshold", () => {
  assert.doesNotThrow(() => assertNonOwnerMemberLimit(Role.ADMIN, 3));
  assert.doesNotThrow(() => assertNonOwnerMemberLimit(Role.CS, 0));
});

test("assertNonOwnerMemberLimit rejects when threshold reached", () => {
  assert.throws(
    () => assertNonOwnerMemberLimit(Role.ADVERTISER, 4),
    (error: unknown) => error instanceof ServiceError && error.code === "ORG_MEMBER_LIMIT_EXCEEDED"
  );
});

