import { NextRequest, NextResponse } from "next/server";

import { getSessionFromRequest, type SessionPayload } from "@/lib/auth/session";

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
  const session = getSessionFromRequest(request);
  if (!session) {
    return {
      session: null,
      response: NextResponse.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message: "Authentication is required."
          }
        },
        { status: 401 }
      )
    };
  }

  return {
    session,
    response: null
  };
}

