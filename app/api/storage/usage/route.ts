import type { NextRequest } from "next/server";

import { requireApiSession } from "@/lib/auth/middleware";
import { errorResponse, successResponse } from "@/lib/api/http";
import { getOrgStorageUsage } from "@/server/services/storageService";
import { ServiceError } from "@/server/services/serviceError";

export async function GET(request: NextRequest) {
  const auth = requireApiSession(request);
  if (auth.response) {
    return auth.response;
  }

  const orgId = request.nextUrl.searchParams.get("orgId")?.trim() ?? "";

  try {
    const usage = await getOrgStorageUsage(auth.session.userId, orgId);

    return successResponse(
      {
        usage
      },
      200
    );
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.status, error.code, error.message);
    }

    return errorResponse(500, "STORAGE_USAGE_FETCH_FAILED", "Failed to fetch storage usage.");
  }
}
