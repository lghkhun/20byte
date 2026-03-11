import { ServiceError } from "@/server/services/serviceError";

const PHONE_E164_REGEX = /^\+[1-9]\d{7,14}$/;

export function normalizeValue(value: string): string {
  return value.trim();
}

export function resolveLastMessagePreview(input: {
  text: string | null;
  type: string;
  fileName: string | null;
}): string | null {
  const text = input.text?.trim() ?? "";
  if (text) {
    return text.length > 80 ? `${text.slice(0, 77)}...` : text;
  }

  if (input.type === "IMAGE") {
    return "Image";
  }

  if (input.type === "VIDEO") {
    return "Video";
  }

  if (input.type === "AUDIO") {
    return "Audio";
  }

  if (input.type === "DOCUMENT") {
    return input.fileName ? `Document: ${input.fileName}` : "Document";
  }

  if (input.type === "TEMPLATE") {
    return "Template message";
  }

  if (input.type === "SYSTEM") {
    return "System update";
  }

  return null;
}

export function validatePhoneE164(phoneE164: string): string {
  const normalizedPhone = normalizeValue(phoneE164);
  if (!PHONE_E164_REGEX.test(normalizedPhone)) {
    throw new ServiceError(400, "INVALID_PHONE_E164", "phoneE164 must be in E.164 format (example: +628123456789).");
  }

  return normalizedPhone;
}

export function normalizeOptionalName(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = normalizeValue(value);
  return normalized.length > 0 ? normalized : undefined;
}

export function normalizePage(value: number | undefined): number {
  if (!value || Number.isNaN(value) || value < 1) {
    return 1;
  }

  return Math.floor(value);
}

export function normalizeLimit(value: number | undefined): number {
  if (!value || Number.isNaN(value) || value < 1) {
    return 20;
  }

  return Math.min(100, Math.floor(value));
}
