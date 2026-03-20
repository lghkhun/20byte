import { randomBytes } from "crypto";

const REF_PATTERN = /\[(?:ref|r):([a-z0-9_-]+)\]/i;

function normalize(value: string | undefined): string {
  return (value ?? "").trim();
}

export function generateTrackingId(shortlinkCode: string, at = new Date()): string {
  const code = normalize(shortlinkCode).toLowerCase().slice(0, 3);
  const timestamp = at.getTime().toString(36).slice(-4);
  const random = randomBytes(2).toString("hex");
  return `${code}${timestamp}${random}`;
}

export function appendTrackingRef(text: string | undefined, trackingId: string): string {
  const base = normalize(text);
  const ref = `[r:${trackingId}]`;
  if (!base) {
    return ref;
  }
  if (REF_PATTERN.test(base)) {
    return base;
  }
  return `${base} ${ref}`.trim();
}

export function extractTrackingRef(text: string | undefined): {
  cleanText: string | undefined;
  trackingId: string | undefined;
  shortlinkCodeFromRef: string | undefined;
} {
  const raw = normalize(text);
  if (!raw) {
    return {
      cleanText: undefined,
      trackingId: undefined,
      shortlinkCodeFromRef: undefined
    };
  }

  const match = raw.match(REF_PATTERN);
  if (!match) {
    return {
      cleanText: raw,
      trackingId: undefined,
      shortlinkCodeFromRef: undefined
    };
  }

  const trackingId = normalize(match[1]).toLowerCase();
  const shortlinkCodeFromRef = trackingId.includes("-") ? trackingId.split("-")[0] || undefined : undefined;
  const cleanText = raw.replace(match[0], "").replace(/\s{2,}/g, " ").trim() || undefined;

  return {
    cleanText,
    trackingId: trackingId || undefined,
    shortlinkCodeFromRef
  };
}
