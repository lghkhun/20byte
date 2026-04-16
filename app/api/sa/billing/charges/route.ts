import type { NextRequest } from "next/server";

import { errorResponse, successResponse } from "@/lib/api/http";
import { requireApiSession } from "@/lib/auth/middleware";
import { requireSuperadmin } from "@/server/services/platformAccessService";
import { ServiceError } from "@/server/services/serviceError";
import { listBillingChargesForSuperadmin } from "@/server/services/superadminService";

export async function GET(request: NextRequest) {
  const auth = requireApiSession(request);
  if (auth.response) {
    return auth.response;
  }

  try {
    await requireSuperadmin(auth.session.userId, auth.session.email);
    const charges = await listBillingChargesForSuperadmin();
    return successResponse({ charges }, 200);
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.status, error.code, error.message);
    }

    return errorResponse(500, "SA_BILLING_CHARGES_FAILED", "Failed to load billing charges.");
  }
}
