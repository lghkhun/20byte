import type { NextRequest } from "next/server";

import { errorResponse, successResponse } from "@/lib/api/http";
import { requireApiSession } from "@/lib/auth/middleware";
import { requireSuperadmin } from "@/server/services/platformAccessService";
import { applySubscriptionActionBySuperadmin, parseSuperadminSubscriptionAction } from "@/server/services/superadminService";
import { ServiceError } from "@/server/services/serviceError";

type ActionRequest = {
  action?: unknown;
  extendDays?: unknown;
};

export async function POST(request: NextRequest, context: { params: Promise<{ orgId: string }> }) {
  const auth = requireApiSession(request);
  if (auth.response) {
    return auth.response;
  }

  let body: ActionRequest;
  try {
    body = (await request.json()) as ActionRequest;
  } catch {
    return errorResponse(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const action = parseSuperadminSubscriptionAction(body.action);
  if (!action) {
    return errorResponse(400, "INVALID_ACTION", "Invalid subscription action.");
  }

  try {
    await requireSuperadmin(auth.session.userId, auth.session.email);
    const updated = await applySubscriptionActionBySuperadmin({
      actorUserId: auth.session.userId,
      orgId: (await context.params).orgId,
      action,
      extendDays: typeof body.extendDays === "number" ? body.extendDays : undefined
    });

    return successResponse({ subscription: updated }, 200);
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.status, error.code, error.message);
    }

    return errorResponse(500, "SA_SUBSCRIPTION_ACTION_FAILED", "Failed to apply subscription action.");
  }
}
