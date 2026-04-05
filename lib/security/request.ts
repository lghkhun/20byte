import { createHash } from "crypto";
import type { NextRequest } from "next/server";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const SAME_SITE_FETCH_VALUES = new Set(["same-origin", "same-site", "none"]);

function resolveHeaderOrigin(value: string | null): string | null {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function resolveAllowedOrigins(request: NextRequest): Set<string> {
  const allowedOrigins = new Set<string>();
  const forwardedHostRaw = request.headers.get("x-forwarded-host");
  const hostRaw = forwardedHostRaw ?? request.headers.get("host") ?? "";
  const host = hostRaw.split(",")[0]?.trim();
  const forwardedProtoRaw = request.headers.get("x-forwarded-proto");
  const forwardedProto = forwardedProtoRaw?.split(",")[0]?.trim();
  const protocol = forwardedProto || request.nextUrl.protocol.replace(/:$/, "") || "https";
  if (host) {
    allowedOrigins.add(`${protocol}://${host}`);
  }

  const requestOrigin = request.nextUrl.origin;
  if (requestOrigin) {
    allowedOrigins.add(requestOrigin);
  }

  const appUrl = process.env.APP_URL?.trim();
  if (appUrl) {
    const appOrigin = resolveHeaderOrigin(appUrl);
    if (appOrigin) {
      allowedOrigins.add(appOrigin);
    }
  }

  return allowedOrigins;
}

export function isMutatingMethod(method: string): boolean {
  return MUTATING_METHODS.has(method.toUpperCase());
}

export function validateSameOriginMutationRequest(request: NextRequest): {
  allowed: boolean;
  reason?: "CROSS_SITE_FETCH" | "ORIGIN_MISMATCH" | "REFERER_MISMATCH";
} {
  if (!isMutatingMethod(request.method)) {
    return { allowed: true };
  }

  const secFetchSite = (request.headers.get("sec-fetch-site") ?? "").trim().toLowerCase();
  if (secFetchSite && !SAME_SITE_FETCH_VALUES.has(secFetchSite)) {
    return { allowed: false, reason: "CROSS_SITE_FETCH" };
  }

  const allowedOrigins = resolveAllowedOrigins(request);
  const origin = resolveHeaderOrigin(request.headers.get("origin"));
  if (origin && !allowedOrigins.has(origin)) {
    return { allowed: false, reason: "ORIGIN_MISMATCH" };
  }

  const referer = resolveHeaderOrigin(request.headers.get("referer"));
  if (!origin && referer && !allowedOrigins.has(referer)) {
    return { allowed: false, reason: "REFERER_MISMATCH" };
  }

  return { allowed: true };
}

export function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) {
      return first;
    }
  }
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) {
    return realIp;
  }
  return "unknown";
}

export function toRateLimitHash(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 24);
}
