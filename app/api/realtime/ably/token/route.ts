import { NextRequest, NextResponse } from "next/server";

import { requireApiSession } from "@/lib/auth/middleware";
import { createInboxRealtimeTokenRequest } from "@/server/services/realtimeService";
import { ServiceError } from "@/server/services/serviceError";

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json(
    {
      error: {
        code,
        message
      }
    },
    { status }
  );
}

export async function GET(request: NextRequest) {
  const auth = requireApiSession(request);
  if (auth.response) {
    return auth.response;
  }

  const orgId = request.nextUrl.searchParams.get("orgId")?.trim() ?? "";

  try {
    const tokenRequest = await createInboxRealtimeTokenRequest(auth.session.userId, orgId);

    return NextResponse.json(
      {
        data: {
          tokenRequest
        },
        meta: {}
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.status, error.code, error.message);
    }

    return errorResponse(500, "ABLY_TOKEN_REQUEST_FAILED", "Failed to create Ably token request.");
  }
}

