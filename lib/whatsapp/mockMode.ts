function normalizeFlag(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export function isWhatsAppMockModeEnabled(): boolean {
  const raw = normalizeFlag(process.env.WHATSAPP_MOCK_MODE);
  if (raw === "true" || raw === "1" || raw === "yes" || raw === "on") {
    return true;
  }

  if (raw === "false" || raw === "0" || raw === "no" || raw === "off") {
    return false;
  }

  return process.env.NODE_ENV !== "production";
}

export function buildMockWhatsAppMessageId(prefix: string): string {
  const ts = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  return `mock_${prefix}_${ts}_${random}`;
}
