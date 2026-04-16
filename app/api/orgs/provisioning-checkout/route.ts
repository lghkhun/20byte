import type { NextRequest } from "next/server";

import { errorResponse, successResponse } from "@/lib/api/http";
import { requireApiSession } from "@/lib/auth/middleware";
import { createBusinessProvisioningCheckout } from "@/server/services/billingService";
import { ServiceError } from "@/server/services/serviceError";

type ProvisioningCheckoutRequest = {
  businessName?: unknown;
  paymentMethod?: unknown;
  planMonths?: unknown;
};

export async function POST(request: NextRequest) {
  const auth = requireApiSession(request);
  if (auth.response) {
    return auth.response;
  }

  let body: ProvisioningCheckoutRequest;
  try {
    body = (await request.json()) as ProvisioningCheckoutRequest;
  } catch {
    return errorResponse(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  try {
    const result = await createBusinessProvisioningCheckout({
      actorUserId: auth.session.userId,
      businessName: body.businessName,
      paymentMethod: typeof body.paymentMethod === "string" ? body.paymentMethod : undefined,
      planMonths:
        typeof body.planMonths === "number"
          ? body.planMonths
          : typeof body.planMonths === "string" && body.planMonths.trim()
            ? Number(body.planMonths)
            : undefined
    });

    return successResponse(result, 201);
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.status, error.code, error.message);
    }

    return errorResponse(500, "BUSINESS_PROVISIONING_FAILED", "Failed to start business provisioning checkout.");
  }
}
