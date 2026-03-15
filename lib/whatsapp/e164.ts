const E164_REGEX = /^\+[1-9]\d{7,14}$/;

function trimOrEmpty(value: string | undefined): string {
  return (value ?? "").trim();
}

export function normalizePossibleE164(value: string | undefined): string | null {
  const raw = trimOrEmpty(value);
  if (!raw) {
    return null;
  }

  const digitsOnly = raw.replace(/[^\d+]/g, "");
  const normalized = digitsOnly.startsWith("+") ? digitsOnly : `+${digitsOnly}`;

  if (!E164_REGEX.test(normalized)) {
    return null;
  }

  return normalized;
}

export function normalizeWhatsAppDestination(value: string | undefined): string | null {
  const raw = trimOrEmpty(value);
  if (!raw) {
    return null;
  }

  const digits = raw.replace(/\D/g, "");
  if (!digits) {
    return null;
  }

  let normalizedDigits = digits;
  if (normalizedDigits.startsWith("08")) {
    normalizedDigits = `628${normalizedDigits.slice(2)}`;
  } else if (normalizedDigits.startsWith("8")) {
    normalizedDigits = `62${normalizedDigits}`;
  } else if (normalizedDigits.startsWith("620")) {
    normalizedDigits = `62${normalizedDigits.slice(3)}`;
  } else if (!normalizedDigits.startsWith("62")) {
    normalizedDigits = `62${normalizedDigits}`;
  }

  return normalizePossibleE164(`+${normalizedDigits}`);
}
