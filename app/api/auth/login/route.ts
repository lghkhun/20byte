import type { NextRequest } from "next/server";

import { errorResponse, successResponse } from "@/lib/api/http";
import { enforceAuthRateLimit } from "@/lib/auth/rateLimit";
import { logAuthFailure } from "@/lib/logging/auth";
import { getClientIp } from "@/lib/security/request";
import { setSessionCookie } from "@/lib/auth/session";
import { loginUser } from "@/server/services/authService";
import { ServiceError } from "@/server/services/serviceError";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const normalizedBody = (body ?? {}) as Record<string, unknown>;
  const identifierRaw =
    typeof normalizedBody.identifier === "string"
      ? normalizedBody.identifier
      : typeof normalizedBody.email === "string"
        ? normalizedBody.email
        : "";

  const rateLimitResponse = await enforceAuthRateLimit({
    request,
    scope: "login",
    identity: identifierRaw
  });
  if (rateLimitResponse) {
    logAuthFailure({
      reason: "AUTH_RATE_LIMITED",
      path: request.nextUrl.pathname,
      method: request.method,
      ip: getClientIp(request),
      userAgent: request.headers.get("user-agent") ?? undefined
    });
    return rateLimitResponse;
  }

  try {
    const result = await loginUser(normalizedBody);
    const response = successResponse(
      {
        user: {
          id: result.user.userId,
          email: result.user.email,
          name: result.user.name
        }
      },
      200
    );
    setSessionCookie(response, result.sessionToken);
    return response;
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.status, error.code, error.message);
    }

    logAuthFailure({
      reason: "LOGIN_INTERNAL_ERROR",
      path: request.nextUrl.pathname,
      method: request.method,
      ip: getClientIp(request),
      userAgent: request.headers.get("user-agent") ?? undefined
    });
    return errorResponse(500, "LOGIN_FAILED", "Failed to authenticate user.");
  }
}
