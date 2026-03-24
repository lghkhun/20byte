import type { NextRequest } from "next/server";

import { errorResponse, successResponse } from "@/lib/api/http";
import { requireApiSession } from "@/lib/auth/middleware";
import { requireSuperadmin } from "@/server/services/platformAccessService";
import { upsertPlatformMember } from "@/server/services/superadminService";
import { ServiceError } from "@/server/services/serviceError";

type PlatformMemberRequest = {
  userId?: unknown;
  enabled?: unknown;
};

export async function POST(request: NextRequest) {
  const auth = requireApiSession(request);
  if (auth.response) {
    return auth.response;
  }

  let body: PlatformMemberRequest;
  try {
    body = (await request.json()) as PlatformMemberRequest;
  } catch {
    return errorResponse(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const userId = typeof body.userId === "string" ? body.userId : "";
  const enabled = Boolean(body.enabled);

  try {
    await requireSuperadmin(auth.session.userId, auth.session.email);
    const member = await upsertPlatformMember({
      actorUserId: auth.session.userId,
      userId,
      enabled
    });

    return successResponse({ member }, 200);
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.status, error.code, error.message);
    }

    return errorResponse(500, "SA_PLATFORM_MEMBER_FAILED", "Failed to update platform member.");
  }
}
