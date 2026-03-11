import test from "node:test";
import assert from "node:assert/strict";
import { InvoiceKind, PaymentMilestoneType, Role } from "@prisma/client";

import {
  assertMarkPaidProofRule,
  assertMilestoneTypesExist,
  resolveTargetMilestoneTypes
} from "@/server/services/invoice/paymentPolicy";
import { ServiceError } from "@/server/services/serviceError";

test("mark-paid proof rule: OWNER bypasses proof, ADMIN/CS require proof", () => {
  assert.doesNotThrow(() => assertMarkPaidProofRule(Role.OWNER, false));
  assert.doesNotThrow(() => assertMarkPaidProofRule(Role.ADMIN, true));
  assert.doesNotThrow(() => assertMarkPaidProofRule(Role.CS, true));

  assert.throws(
    () => assertMarkPaidProofRule(Role.ADMIN, false),
    (error: unknown) => error instanceof ServiceError && error.code === "PROOF_REQUIRED_FOR_MARK_PAID"
  );

  assert.throws(
    () => assertMarkPaidProofRule(Role.CS, false),
    (error: unknown) => error instanceof ServiceError && error.code === "PROOF_REQUIRED_FOR_MARK_PAID"
  );
});

test("resolveTargetMilestoneTypes follows invoice kind contract", () => {
  assert.deepEqual(resolveTargetMilestoneTypes(InvoiceKind.FULL), [PaymentMilestoneType.FULL]);
  assert.deepEqual(resolveTargetMilestoneTypes(InvoiceKind.DP_AND_FINAL), [PaymentMilestoneType.DP, PaymentMilestoneType.FINAL]);
  assert.deepEqual(resolveTargetMilestoneTypes(InvoiceKind.DP_AND_FINAL, PaymentMilestoneType.DP), [PaymentMilestoneType.DP]);

  assert.throws(
    () => resolveTargetMilestoneTypes(InvoiceKind.DP_AND_FINAL, PaymentMilestoneType.FULL),
    (error: unknown) => error instanceof ServiceError && error.code === "INVALID_MILESTONE_TYPE"
  );
});

test("assertMilestoneTypesExist rejects missing milestone type", () => {
  assert.doesNotThrow(() =>
    assertMilestoneTypesExist([PaymentMilestoneType.DP, PaymentMilestoneType.FINAL], [PaymentMilestoneType.DP])
  );

  assert.throws(
    () => assertMilestoneTypesExist([PaymentMilestoneType.DP], [PaymentMilestoneType.FINAL]),
    (error: unknown) => error instanceof ServiceError && error.code === "MILESTONE_NOT_FOUND"
  );
});
