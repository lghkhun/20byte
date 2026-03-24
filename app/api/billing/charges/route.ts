import type { NextRequest } from "next/server";

import { errorResponse, successResponse } from "@/lib/api/http";
import { requireApiSession } from "@/lib/auth/middleware";
import { getPrimaryOrganizationForUser } from "@/server/services/organizationService";
import { listOrgBillingCharges } from "@/server/services/billingService";
import { ServiceError } from "@/server/services/serviceError";

export async function GET(request: NextRequest) {
  const auth = requireApiSession(request);
  if (auth.response) {
    return auth.response;
  }

  const orgIdInput = request.nextUrl.searchParams.get("orgId")?.trim() ?? "";

  try {
    const primary = await getPrimaryOrganizationForUser(auth.session.userId);
    const orgId = orgIdInput || primary?.id || "";
    if (!orgId) {
      return errorResponse(404, "ORG_NOT_FOUND", "No business is available for this account.");
    }

    const charges = await listOrgBillingCharges(auth.session.userId, orgId);
    return successResponse({ charges }, 200);
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.status, error.code, error.message);
    }

    return errorResponse(500, "BILLING_CHARGES_FAILED", "Failed to load billing charges.");
  }
}
