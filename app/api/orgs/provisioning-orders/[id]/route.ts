import type { NextRequest } from "next/server";

import { errorResponse, successResponse } from "@/lib/api/http";
import { requireApiSession } from "@/lib/auth/middleware";
import { getBusinessProvisioningOrderView } from "@/server/services/billingService";
import { ServiceError } from "@/server/services/serviceError";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = requireApiSession(request);
  if (auth.response) {
    return auth.response;
  }

  const params = await context.params;
  const provisioningOrderId = params.id?.trim() ?? "";

  try {
    const order = await getBusinessProvisioningOrderView({
      actorUserId: auth.session.userId,
      provisioningOrderId
    });
    return successResponse({ order }, 200);
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.status, error.code, error.message);
    }

    return errorResponse(500, "PROVISIONING_ORDER_FETCH_FAILED", "Failed to load provisioning order.");
  }
}
