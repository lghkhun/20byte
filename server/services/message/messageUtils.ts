import { ServiceError } from "@/server/services/serviceError";

// Prisma MySQL default String column maps to varchar(191) unless explicitly annotated.
export const MESSAGE_TEXT_DB_MAX_LENGTH = 191;

export function normalize(value: string): string {
  return value.trim();
}

export function normalizeOptional(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = normalize(value);
  return normalized.length > 0 ? normalized : undefined;
}

export function normalizeFileSize(value: number | undefined): number | undefined {
  if (value === undefined || Number.isNaN(value) || value < 0) {
    return undefined;
  }

  return Math.floor(value);
}

export function normalizePage(value: number | undefined): number {
  if (!value || Number.isNaN(value) || value < 1) {
    return 1;
  }

  return Math.floor(value);
}

export function normalizeLimit(value: number | undefined): number {
  if (!value || Number.isNaN(value) || value < 1) {
    return 30;
  }

  return Math.min(100, Math.floor(value));
}

export function normalizeTemplateComponents(value: Array<Record<string, unknown>> | undefined): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((row) => row && typeof row === "object");
}

export function normalizeTemplateLanguageCode(value: string | undefined): string {
  return normalize(value ?? "en") || "en";
}

export function normalizeSendError(value: unknown): string {
  const raw = value instanceof Error ? value.message : "Outbound send failed.";
  const normalized = normalize(raw);
  if (!normalized) {
    return "Outbound send failed.";
  }

  return normalized.length > 500 ? normalized.slice(0, 500) : normalized;
}

export function normalizeMessageText(value: string | undefined): string | undefined {
  const normalized = normalizeOptional(value);
  if (!normalized) {
    return undefined;
  }

  return normalized.length > MESSAGE_TEXT_DB_MAX_LENGTH ? normalized.slice(0, MESSAGE_TEXT_DB_MAX_LENGTH) : normalized;
}

export function normalizeSystemMessageText(value: string): string {
  const normalized = normalize(value);
  if (!normalized) {
    throw new ServiceError(400, "INVALID_MESSAGE_TEXT", "Message text is required.");
  }

  const suffix = " [Automated]";
  if (normalized.includes("[Automated]")) {
    return normalized.length > MESSAGE_TEXT_DB_MAX_LENGTH ? normalized.slice(0, MESSAGE_TEXT_DB_MAX_LENGTH) : normalized;
  }

  const availableBaseLength = Math.max(1, MESSAGE_TEXT_DB_MAX_LENGTH - suffix.length);
  const base = normalized.length > availableBaseLength ? normalized.slice(0, availableBaseLength) : normalized;
  return `${base}${suffix}`;
}

export function parseTemplateComponentsJson(raw: string | null): Array<Record<string, unknown>> {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((item) => item && typeof item === "object") as Array<Record<string, unknown>>;
  } catch {
    return [];
  }
}
