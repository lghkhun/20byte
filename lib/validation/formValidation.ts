import { normalizePossibleE164, normalizeWhatsAppDestination } from "@/lib/whatsapp/e164";
import { ServiceError } from "@/server/services/serviceError";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BANK_NAME_MIN_LENGTH = 2;
const BANK_NAME_MAX_LENGTH = 80;
const ACCOUNT_HOLDER_MIN_LENGTH = 2;
const ACCOUNT_HOLDER_MAX_LENGTH = 80;
const ACCOUNT_NUMBER_MIN_DIGITS = 6;
const ACCOUNT_NUMBER_MAX_DIGITS = 30;

export function normalizeAndValidateEmail(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!normalized || !EMAIL_REGEX.test(normalized)) {
    throw new ServiceError(400, "INVALID_EMAIL", "Email tidak valid. Gunakan format email@domain.com.");
  }

  return normalized;
}

export function normalizeAndValidatePhoneE164(value: string): string {
  const normalizedInput = value.trim();
  let candidate: string | null = null;

  if (normalizedInput.startsWith("+")) {
    candidate = normalizePossibleE164(normalizedInput);
  } else {
    const digitsOnly = normalizedInput.replace(/\D+/g, "");
    if (/^(0|8|62)/.test(digitsOnly)) {
      candidate = normalizeWhatsAppDestination(normalizedInput);
    } else {
      candidate = normalizePossibleE164(`+${digitsOnly}`);
    }
  }

  if (!candidate) {
    throw new ServiceError(400, "INVALID_PHONE_E164", "Nomor WhatsApp tidak valid. Gunakan format +628123456789.");
  }

  return candidate;
}

export function normalizeAndValidateBankAccount(input: {
  bankName: string;
  accountNumber: string;
  accountHolder: string;
}): {
  bankName: string;
  accountNumber: string;
  accountHolder: string;
} {
  const bankName = input.bankName.trim();
  const accountHolder = input.accountHolder.trim();
  const accountNumber = input.accountNumber.replace(/\D+/g, "");

  if (bankName.length < BANK_NAME_MIN_LENGTH || bankName.length > BANK_NAME_MAX_LENGTH) {
    throw new ServiceError(400, "INVALID_BANK_NAME", "Nama bank wajib 2-80 karakter.");
  }

  if (accountHolder.length < ACCOUNT_HOLDER_MIN_LENGTH || accountHolder.length > ACCOUNT_HOLDER_MAX_LENGTH) {
    throw new ServiceError(400, "INVALID_BANK_ACCOUNT_HOLDER", "Nama pemilik rekening wajib 2-80 karakter.");
  }

  if (accountNumber.length < ACCOUNT_NUMBER_MIN_DIGITS || accountNumber.length > ACCOUNT_NUMBER_MAX_DIGITS) {
    throw new ServiceError(400, "INVALID_BANK_ACCOUNT_NUMBER", "Nomor rekening wajib 6-30 digit angka.");
  }

  return {
    bankName,
    accountNumber,
    accountHolder
  };
}
