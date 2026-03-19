import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeAndValidateBankAccount,
  normalizeAndValidateEmail,
  normalizeAndValidatePhoneE164
} from "@/lib/validation/formValidation";
import { ServiceError } from "@/server/services/serviceError";

test("normalizeAndValidateEmail normalizes lowercase and trims", () => {
  assert.equal(normalizeAndValidateEmail("  OWNER@Seed.20Byte.Local "), "owner@seed.20byte.local");
});

test("normalizeAndValidateEmail rejects invalid value", () => {
  assert.throws(
    () => normalizeAndValidateEmail("bad-email"),
    (error: unknown) => error instanceof ServiceError && error.code === "INVALID_EMAIL"
  );
});

test("normalizeAndValidatePhoneE164 accepts local whatsapp number", () => {
  assert.equal(normalizeAndValidatePhoneE164("08123456789"), "+628123456789");
});

test("normalizeAndValidatePhoneE164 rejects malformed value", () => {
  assert.throws(
    () => normalizeAndValidatePhoneE164("123"),
    (error: unknown) => error instanceof ServiceError && error.code === "INVALID_PHONE_E164"
  );
});

test("normalizeAndValidateBankAccount normalizes account number digits", () => {
  const account = normalizeAndValidateBankAccount({
    bankName: " BCA ",
    accountNumber: " 1234-5678 90 ",
    accountHolder: " PT Contoh Jasa "
  });

  assert.deepEqual(account, {
    bankName: "BCA",
    accountNumber: "1234567890",
    accountHolder: "PT Contoh Jasa"
  });
});

test("normalizeAndValidateBankAccount rejects short account number", () => {
  assert.throws(
    () =>
      normalizeAndValidateBankAccount({
        bankName: "BCA",
        accountNumber: "123",
        accountHolder: "PT Contoh"
      }),
    (error: unknown) => error instanceof ServiceError && error.code === "INVALID_BANK_ACCOUNT_NUMBER"
  );
});
