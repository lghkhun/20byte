export function isLikelyQrisPayload(value: string | null | undefined): boolean {
  const normalized = (value ?? "").trim();
  if (!normalized) {
    return false;
  }

  // EMV QR payloads commonly start with 000201
  if (normalized.startsWith("000201")) {
    return true;
  }

  // Fallback for static/dynamic QR payloads containing EMV tags
  return normalized.includes("5303360") || normalized.includes(".ID.CO.QRIS");
}

export function resolveCheckoutPaymentMethod(input: {
  paymentMethod: string | null | undefined;
  paymentNumber: string | null | undefined;
  fallbackMethod?: string;
}): string | null {
  const normalizedMethod = (input.paymentMethod ?? "").trim().toLowerCase();
  if (normalizedMethod) {
    return normalizedMethod;
  }

  if (isLikelyQrisPayload(input.paymentNumber)) {
    return (input.fallbackMethod ?? "qris").trim().toLowerCase();
  }

  return null;
}

export function normalizeGatewayExpiry(raw: string | null | undefined): string | null {
  if (!raw) {
    return null;
  }
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString();
}
