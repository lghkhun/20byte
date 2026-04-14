import type { NextRequest } from "next/server";

import { errorResponse, successResponse } from "@/lib/api/http";
import { requireApiSession } from "@/lib/auth/middleware";
import { getOrgWalletSummary } from "@/server/services/invoiceGatewayService";
import { ServiceError } from "@/server/services/serviceError";

export async function GET(request: NextRequest) {
  const auth = requireApiSession(request);
  if (auth.response) {
    return auth.response;
  }

  try {
    const summary = await getOrgWalletSummary({
      actorUserId: auth.session.userId,
      orgId: request.nextUrl.searchParams.get("orgId") ?? undefined
    });
    return successResponse({ summary }, 200);
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.status, error.code, error.message);
    }
    return errorResponse(500, "WALLET_SUMMARY_FAILED", "Failed to load wallet summary.");
  }
}
