import type { NextRequest } from "next/server";

import { errorResponse, successResponse } from "@/lib/api/http";
import { requireApiSession } from "@/lib/auth/middleware";
import { createWalletTopup, listWalletTopups } from "@/server/services/invoiceGatewayService";
import { ServiceError } from "@/server/services/serviceError";

type TopupRequestBody = {
  orgId?: unknown;
  amountCents?: unknown;
  paymentMethod?: unknown;
};

export async function GET(request: NextRequest) {
  const auth = requireApiSession(request);
  if (auth.response) {
    return auth.response;
  }

  try {
    const topups = await listWalletTopups({
      actorUserId: auth.session.userId,
      orgId: request.nextUrl.searchParams.get("orgId") ?? undefined
    });
    return successResponse({ topups }, 200);
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.status, error.code, error.message);
    }
    return errorResponse(500, "WALLET_TOPUPS_FAILED", "Failed to load wallet topups.");
  }
}

export async function POST(request: NextRequest) {
  const auth = requireApiSession(request);
  if (auth.response) {
    return auth.response;
  }

  let body: TopupRequestBody;
  try {
    body = (await request.json()) as TopupRequestBody;
  } catch {
    return errorResponse(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const amountCents = typeof body.amountCents === "number" ? body.amountCents : Number(body.amountCents ?? 0);

  try {
    const topup = await createWalletTopup({
      actorUserId: auth.session.userId,
      orgId: typeof body.orgId === "string" ? body.orgId : undefined,
      amountCents,
      paymentMethod: typeof body.paymentMethod === "string" ? body.paymentMethod : undefined
    });
    return successResponse({ topup }, 201);
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.status, error.code, error.message);
    }
    return errorResponse(500, "WALLET_TOPUP_CREATE_FAILED", "Failed to create wallet topup.");
  }
}
