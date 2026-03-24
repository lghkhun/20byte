import type { NextRequest } from "next/server";

import { errorResponse, successResponse } from "@/lib/api/http";
import { requireApiSession } from "@/lib/auth/middleware";
import { requireSuperadmin } from "@/server/services/platformAccessService";
import { ServiceError } from "@/server/services/serviceError";
import { getSuperadminOverview } from "@/server/services/superadminService";

export async function GET(request: NextRequest) {
  const auth = requireApiSession(request);
  if (auth.response) {
    return auth.response;
  }

  try {
    await requireSuperadmin(auth.session.userId, auth.session.email);
    const overview = await getSuperadminOverview();
    return successResponse({ overview }, 200);
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.status, error.code, error.message);
    }

    return errorResponse(500, "SA_OVERVIEW_FAILED", "Failed to load superadmin overview.");
  }
}
