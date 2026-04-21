import { ServiceError } from "@/server/services/serviceError";

export function parsePlatformMemberEnabled(value: unknown): boolean {
  if (typeof value !== "boolean") {
    throw new ServiceError(400, "INVALID_ENABLED", "enabled must be a boolean.");
  }

  return value;
}
