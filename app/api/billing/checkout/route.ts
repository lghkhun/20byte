import type { NextRequest } from "next/server";

import { errorResponse, successResponse } from "@/lib/api/http";
import { requireApiSession } from "@/lib/auth/middleware";
import { getPrimaryOrganizationForUser } from "@/server/services/organizationService";
import { createBillingCheckout } from "@/server/services/billingService";
import { ServiceError } from "@/server/services/serviceError";

type CheckoutRequest = {
  orgId?: unknown;
  paymentMethod?: unknown;
};

export async function POST(request: NextRequest) {
  const auth = requireApiSession(request);
  if (auth.response) {
    return auth.response;
  }

  let body: CheckoutRequest;
  try {
    body = (await request.json()) as CheckoutRequest;
  } catch {
    return errorResponse(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  try {
    const primary = await getPrimaryOrganizationForUser(auth.session.userId);
    const orgId = typeof body.orgId === "string" && body.orgId.trim() ? body.orgId : primary?.id ?? "";
    if (!orgId) {
      return errorResponse(404, "ORG_NOT_FOUND", "No business is available for this account.");
    }

    const result = await createBillingCheckout({
      actorUserId: auth.session.userId,
      orgId,
      paymentMethod: typeof body.paymentMethod === "string" ? body.paymentMethod : undefined
    });

    return successResponse(result, 200);
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.status, error.code, error.message);
    }

    return errorResponse(500, "BILLING_CHECKOUT_FAILED", "Failed to create checkout.");
  }
}
