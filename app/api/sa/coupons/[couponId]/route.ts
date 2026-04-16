import type { NextRequest } from "next/server";

import { errorResponse, successResponse } from "@/lib/api/http";
import { requireApiSession } from "@/lib/auth/middleware";
import { requireSuperadmin } from "@/server/services/platformAccessService";
import { updateCouponForSuperadmin } from "@/server/services/platformCouponService";
import { ServiceError } from "@/server/services/serviceError";

type UpdateCouponBody = {
  name?: unknown;
  description?: unknown;
  target?: unknown;
  discountType?: unknown;
  discountValue?: unknown;
  maxDiscountCents?: unknown;
  minSubtotalCents?: unknown;
  maxRedemptions?: unknown;
  startsAt?: unknown;
  expiresAt?: unknown;
  isActive?: unknown;
};

export async function PATCH(request: NextRequest, context: { params: Promise<{ couponId: string }> }) {
  const auth = requireApiSession(request);
  if (auth.response) {
    return auth.response;
  }

  let body: UpdateCouponBody;
  try {
    body = (await request.json()) as UpdateCouponBody;
  } catch {
    return errorResponse(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  try {
    await requireSuperadmin(auth.session.userId, auth.session.email);
    const params = await context.params;
    const coupon = await updateCouponForSuperadmin({
      actorUserId: auth.session.userId,
      couponId: params.couponId,
      name: body.name,
      description: body.description,
      target: body.target,
      discountType: body.discountType,
      discountValue: body.discountValue,
      maxDiscountCents: body.maxDiscountCents,
      minSubtotalCents: body.minSubtotalCents,
      maxRedemptions: body.maxRedemptions,
      startsAt: body.startsAt,
      expiresAt: body.expiresAt,
      isActive: body.isActive
    });
    return successResponse({ coupon }, 200);
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.status, error.code, error.message);
    }

    return errorResponse(500, "SA_COUPON_UPDATE_FAILED", "Failed to update coupon.");
  }
}
