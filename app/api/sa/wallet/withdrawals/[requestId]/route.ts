import type { NextRequest } from "next/server";

import { errorResponse, successResponse } from "@/lib/api/http";
import { requireApiSession } from "@/lib/auth/middleware";
import { requireSuperadmin } from "@/server/services/platformAccessService";
import { processWithdrawRequestAction } from "@/server/services/invoiceGatewayService";
import { ServiceError } from "@/server/services/serviceError";

type ProcessBody = {
  action?: unknown;
  note?: unknown;
};

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ requestId: string }> }
) {
  const auth = requireApiSession(request);
  if (auth.response) {
    return auth.response;
  }

  let body: ProcessBody;
  try {
    body = (await request.json()) as ProcessBody;
  } catch {
    return errorResponse(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const actionRaw = typeof body.action === "string" ? body.action.trim().toUpperCase() : "";
  if (actionRaw !== "APPROVE" && actionRaw !== "PAID" && actionRaw !== "REJECT") {
    return errorResponse(400, "INVALID_ACTION", "action must be APPROVE, PAID, or REJECT.");
  }

  try {
    await requireSuperadmin(auth.session.userId, auth.session.email);
    const updated = await processWithdrawRequestAction({
      actorUserId: auth.session.userId,
      requestId: (await context.params).requestId,
      action: actionRaw,
      note: typeof body.note === "string" ? body.note : undefined
    });
    return successResponse({ request: updated }, 200);
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.status, error.code, error.message);
    }
    return errorResponse(500, "WITHDRAW_PROCESS_FAILED", "Failed to process withdraw request.");
  }
}
