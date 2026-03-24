import type { NextRequest } from "next/server";

import { errorResponse, successResponse } from "@/lib/api/http";
import { requireApiSession } from "@/lib/auth/middleware";
import { resendOrganizationStaffSetupLink } from "@/server/services/staffService";
import { ServiceError } from "@/server/services/serviceError";

type ResendSetupRequest = {
  orgId?: unknown;
  userId?: unknown;
};

export async function POST(request: NextRequest) {
  const auth = requireApiSession(request);
  if (auth.response) {
    return auth.response;
  }

  let body: ResendSetupRequest;
  try {
    body = (await request.json()) as ResendSetupRequest;
  } catch {
    return errorResponse(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const orgId = typeof body.orgId === "string" ? body.orgId : "";
  const userId = typeof body.userId === "string" ? body.userId : "";

  try {
    const result = await resendOrganizationStaffSetupLink({
      actorUserId: auth.session.userId,
      orgId,
      userId
    });

    return successResponse(result, 200);
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.status, error.code, error.message);
    }

    return errorResponse(500, "RESEND_STAFF_SETUP_LINK_FAILED", "Failed to resend setup link.");
  }
}
