import type { NextRequest } from "next/server";

import { errorResponse, successResponse } from "@/lib/api/http";
import { requireApiSession } from "@/lib/auth/middleware";
import { requireSuperadmin } from "@/server/services/platformAccessService";
import { createCouponForSuperadmin, listCouponsForSuperadmin } from "@/server/services/platformCouponService";
import { ServiceError } from "@/server/services/serviceError";

type CreateCouponBody = {
  code?: unknown;
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

export async function GET(request: NextRequest) {
  const auth = requireApiSession(request);
  if (auth.response) {
    return auth.response;
  }

  try {
    await requireSuperadmin(auth.session.userId, auth.session.email);
    const limitRaw = request.nextUrl.searchParams.get("limit");
    const limit = limitRaw ? Number(limitRaw) : 200;
    const coupons = await listCouponsForSuperadmin(Number.isFinite(limit) ? limit : 200);
    return successResponse({ coupons }, 200);
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.status, error.code, error.message);
    }

    return errorResponse(500, "SA_COUPONS_LIST_FAILED", "Failed to load coupons.");
  }
}

export async function POST(request: NextRequest) {
  const auth = requireApiSession(request);
  if (auth.response) {
    return auth.response;
  }

  let body: CreateCouponBody;
  try {
    body = (await request.json()) as CreateCouponBody;
  } catch {
    return errorResponse(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  try {
    await requireSuperadmin(auth.session.userId, auth.session.email);
    const coupon = await createCouponForSuperadmin({
      actorUserId: auth.session.userId,
      code: body.code,
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
    return successResponse({ coupon }, 201);
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.status, error.code, error.message);
    }

    return errorResponse(500, "SA_COUPON_CREATE_FAILED", "Failed to create coupon.");
  }
}
