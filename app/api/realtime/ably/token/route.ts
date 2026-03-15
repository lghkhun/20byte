import type { NextRequest } from "next/server";

import { errorResponse, successResponse } from "@/lib/api/http";
import { requireApiSession } from "@/lib/auth/middleware";
import { createInboxRealtimeTokenRequest } from "@/server/services/realtimeService";
import { ServiceError } from "@/server/services/serviceError";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const auth = requireApiSession(request);
  if (auth.response) {
    return auth.response;
  }

  const orgId = request.nextUrl.searchParams.get("orgId")?.trim() ?? "";

  try {
    const tokenRequest = await createInboxRealtimeTokenRequest(auth.session.userId, orgId);
    return successResponse(
      {
        tokenRequest
      },
      200
    );
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.status, error.code, error.message);
    }

    return errorResponse(500, "ABLY_TOKEN_REQUEST_FAILED", "Failed to create Ably token request.");
  }
}
