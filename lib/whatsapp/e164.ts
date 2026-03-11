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
