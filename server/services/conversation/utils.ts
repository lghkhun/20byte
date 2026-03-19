import { normalizeAndValidatePhoneE164 } from "@/lib/validation/formValidation";

const LEGACY_LOCAL_INVOICE_URL_REGEX = /https?:\/\/(?:localhost|127\.0\.0\.1):3000(\/i\/[A-Za-z0-9_-]+)/gi;

export function normalizeLegacyLocalInvoiceLinks(text: string): string {
  if (!text) {
    return text;
  }

  return text.replace(LEGACY_LOCAL_INVOICE_URL_REGEX, "$1");
}

export function normalizeValue(value: string): string {
  return value.trim();
}

export function resolveLastMessagePreview(input: {
  text: string | null;
  type: string;
  fileName: string | null;
}): string | null {
  const text = normalizeLegacyLocalInvoiceLinks(input.text?.trim() ?? "");
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
  return normalizeAndValidatePhoneE164(phoneE164);
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
