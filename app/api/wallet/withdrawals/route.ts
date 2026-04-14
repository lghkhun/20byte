import type { NextRequest } from "next/server";

import { errorResponse, successResponse } from "@/lib/api/http";
import { requireApiSession } from "@/lib/auth/middleware";
import { createWithdrawRequest, listWithdrawRequests } from "@/server/services/invoiceGatewayService";
import { ServiceError } from "@/server/services/serviceError";

type WithdrawRequestBody = {
  orgId?: unknown;
  amountCents?: unknown;
  bankName?: unknown;
  accountNumber?: unknown;
  accountHolder?: unknown;
  note?: unknown;
};

export async function GET(request: NextRequest) {
  const auth = requireApiSession(request);
  if (auth.response) {
    return auth.response;
  }

  try {
    const requests = await listWithdrawRequests({
      actorUserId: auth.session.userId,
      orgId: request.nextUrl.searchParams.get("orgId") ?? undefined
    });
    return successResponse({ requests }, 200);
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.status, error.code, error.message);
    }
    return errorResponse(500, "WALLET_WITHDRAWALS_FAILED", "Failed to load wallet withdrawals.");
  }
}

export async function POST(request: NextRequest) {
  const auth = requireApiSession(request);
  if (auth.response) {
    return auth.response;
  }

  let body: WithdrawRequestBody;
  try {
    body = (await request.json()) as WithdrawRequestBody;
  } catch {
    return errorResponse(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  try {
    const requestRow = await createWithdrawRequest({
      actorUserId: auth.session.userId,
      orgId: typeof body.orgId === "string" ? body.orgId : undefined,
      amountCents: typeof body.amountCents === "number" ? body.amountCents : Number(body.amountCents ?? 0),
      bankName: typeof body.bankName === "string" ? body.bankName : "",
      accountNumber: typeof body.accountNumber === "string" ? body.accountNumber : "",
      accountHolder: typeof body.accountHolder === "string" ? body.accountHolder : "",
      note: typeof body.note === "string" ? body.note : undefined
    });
    return successResponse({ request: requestRow }, 201);
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.status, error.code, error.message);
    }
    return errorResponse(500, "WALLET_WITHDRAW_CREATE_FAILED", "Failed to create withdraw request.");
  }
}
