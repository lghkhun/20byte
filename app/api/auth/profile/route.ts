import type { NextRequest } from "next/server";

import { errorResponse, successResponse } from "@/lib/api/http";
import { requireApiSession } from "@/lib/auth/middleware";
import { getProfile, updateProfile } from "@/server/services/authService";
import { ServiceError } from "@/server/services/serviceError";

type ProfilePayload = Awaited<ReturnType<typeof getProfile>>;

const PROFILE_CACHE_TTL_MS = 15_000;
const profileCache = new Map<string, { expiresAt: number; data: ProfilePayload }>();
const profileInflight = new Map<string, Promise<ProfilePayload>>();

function withServerTiming<T>(response: T, startedAt: number, cacheStatus?: "HIT" | "MISS"): T {
  const durationMs = Number((performance.now() - startedAt).toFixed(1));
  if (response instanceof Response) {
    response.headers.set("Server-Timing", `app;dur=${durationMs}`);
    if (cacheStatus) {
      response.headers.set("X-Cache", cacheStatus);
    }
  }
  return response;
}

async function getCachedProfile(userId: string): Promise<{ data: ProfilePayload; fromCache: boolean }> {
  const now = Date.now();
  const cached = profileCache.get(userId);
  if (cached && cached.expiresAt > now) {
    return { data: cached.data, fromCache: true };
  }

  const inflight = profileInflight.get(userId);
  if (inflight) {
    return { data: await inflight, fromCache: true };
  }

  const request = (async () => {
    const profile = await getProfile(userId);
    profileCache.set(userId, {
      expiresAt: Date.now() + PROFILE_CACHE_TTL_MS,
      data: profile
    });
    return profile;
  })();

  profileInflight.set(userId, request);
  try {
    return { data: await request, fromCache: false };
  } finally {
    profileInflight.delete(userId);
  }
}

export async function GET(request: NextRequest) {
  const startedAt = performance.now();
  const auth = requireApiSession(request);
  if (!auth.session) {
    return withServerTiming(auth.response, startedAt);
  }

  try {
    const { data: profile, fromCache } = await getCachedProfile(auth.session.userId);
    return withServerTiming(successResponse({ user: profile }, 200), startedAt, fromCache ? "HIT" : "MISS");
  } catch (error) {
    if (error instanceof ServiceError) {
      return withServerTiming(errorResponse(error.status, error.code, error.message), startedAt);
    }

    return withServerTiming(errorResponse(500, "PROFILE_FETCH_FAILED", "Failed to load profile."), startedAt);
  }
}

export async function PATCH(request: NextRequest) {
  const startedAt = performance.now();
  const auth = requireApiSession(request);
  if (!auth.session) {
    return withServerTiming(auth.response, startedAt);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return withServerTiming(errorResponse(400, "INVALID_JSON", "Request body must be valid JSON."), startedAt);
  }

  try {
    const updatedProfile = await updateProfile(auth.session.userId, (body ?? {}) as Record<string, unknown>);
    profileCache.delete(auth.session.userId);
    profileInflight.delete(auth.session.userId);
    return withServerTiming(successResponse({ user: updatedProfile }, 200), startedAt);
  } catch (error) {
    if (error instanceof ServiceError) {
      return withServerTiming(errorResponse(error.status, error.code, error.message), startedAt);
    }

    return withServerTiming(errorResponse(500, "PROFILE_UPDATE_FAILED", "Failed to update profile."), startedAt);
  }
}
