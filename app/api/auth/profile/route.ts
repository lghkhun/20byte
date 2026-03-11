import type { NextRequest } from "next/server";

import { errorResponse, successResponse } from "@/lib/api/http";
import { requireApiSession } from "@/lib/auth/middleware";
import { getProfile, updateProfile } from "@/server/services/authService";
import { ServiceError } from "@/server/services/serviceError";

export async function GET(request: NextRequest) {
  const auth = requireApiSession(request);
  if (!auth.session) {
    return auth.response;
  }

  try {
    const profile = await getProfile(auth.session.userId);
    return successResponse({ user: profile }, 200);
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.status, error.code, error.message);
    }

    return errorResponse(500, "PROFILE_FETCH_FAILED", "Failed to load profile.");
  }
}

export async function PATCH(request: NextRequest) {
  const auth = requireApiSession(request);
  if (!auth.session) {
    return auth.response;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  try {
    const updatedProfile = await updateProfile(auth.session.userId, (body ?? {}) as Record<string, unknown>);
    return successResponse({ user: updatedProfile }, 200);
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.status, error.code, error.message);
    }

    return errorResponse(500, "PROFILE_UPDATE_FAILED", "Failed to update profile.");
  }
}
