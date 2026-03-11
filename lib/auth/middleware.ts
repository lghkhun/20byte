import type { NextRequest, NextResponse } from "next/server";

import { errorResponse } from "@/lib/api/http";
import { getSessionFromRequest, type SessionPayload } from "@/lib/auth/session";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { logAuthFailure } from "@/lib/logging/auth";

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
    const ip = request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? undefined;
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

  return {
    session,
    response: null
  };
}
