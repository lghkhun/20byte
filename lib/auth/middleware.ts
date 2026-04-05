import type { NextRequest, NextResponse } from "next/server";

import { errorResponse } from "@/lib/api/http";
import { getSessionFromRequest, type SessionPayload } from "@/lib/auth/session";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { logAuthFailure } from "@/lib/logging/auth";
import { getClientIp, validateSameOriginMutationRequest } from "@/lib/security/request";

type RequireApiSessionSuccess = {
  session: SessionPayload;
  response: null;
};

type RequireApiSessionFailure = {
  session: null;
  response: NextResponse;
};

export type RequireApiSessionResult = RequireApiSessionSuccess | RequireApiSessionFailure;

export function requireApiSession(request: NextRequest): RequireApiSessionResult {
  const rawToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = getSessionFromRequest(request);
  if (!session) {
    const path = request.nextUrl.pathname;
    const method = request.method;
    const ip = getClientIp(request);
    const userAgent = request.headers.get("user-agent") ?? undefined;
    if (!rawToken) {
      logAuthFailure({
        reason: "API_MISSING_SESSION",
        path,
        method,
        ip,
        userAgent
      });
    } else {
      logAuthFailure({
        reason: "API_INVALID_SESSION",
        path,
        method,
        ip,
        userAgent
      });
    }
    return {
      session: null,
      response: errorResponse(401, "UNAUTHORIZED", "Authentication is required.")
    };
  }

  const originValidation = validateSameOriginMutationRequest(request);
  if (!originValidation.allowed) {
    logAuthFailure({
      reason: "API_CROSS_ORIGIN_BLOCKED",
      email: session.email,
      path: request.nextUrl.pathname,
      method: request.method,
      ip: getClientIp(request),
      userAgent: request.headers.get("user-agent") ?? undefined
    });
    return {
      session: null,
      response: errorResponse(403, "FORBIDDEN_CROSS_ORIGIN", "Cross-origin request is not allowed.")
    };
  }

  return {
    session,
    response: null
  };
}
