import type { NextRequest } from "next/server";

import { errorResponse, successResponse } from "@/lib/api/http";
import { requireApiSession } from "@/lib/auth/middleware";
import { requireSuperadmin } from "@/server/services/platformAccessService";
import { ServiceError } from "@/server/services/serviceError";
import { listPlatformAuditLogs } from "@/server/services/superadminService";

export async function GET(request: NextRequest) {
  const auth = requireApiSession(request);
  if (auth.response) {
    return auth.response;
  }

  const limitRaw = request.nextUrl.searchParams.get("limit");
  const parsedLimit = limitRaw ? Number.parseInt(limitRaw, 10) : undefined;
  const query = request.nextUrl.searchParams.get("query");
  const action = request.nextUrl.searchParams.get("action");
  const targetType = request.nextUrl.searchParams.get("targetType");
  const dateFromRaw = request.nextUrl.searchParams.get("dateFrom");
  const dateToRaw = request.nextUrl.searchParams.get("dateTo");
  const dateFrom = dateFromRaw ? new Date(`${dateFromRaw}T00:00:00.000Z`) : null;
  const dateTo = dateToRaw ? new Date(`${dateToRaw}T23:59:59.999Z`) : null;

  try {
    await requireSuperadmin(auth.session.userId, auth.session.email);
    const logs = await listPlatformAuditLogs({
      limit: Number.isFinite(parsedLimit) ? parsedLimit : undefined,
      query,
      action,
      targetType,
      dateFrom: dateFrom && Number.isFinite(dateFrom.getTime()) ? dateFrom : null,
      dateTo: dateTo && Number.isFinite(dateTo.getTime()) ? dateTo : null
    });
    return successResponse({ logs }, 200);
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.status, error.code, error.message);
    }

    return errorResponse(500, "SA_AUDIT_LOGS_FAILED", "Failed to load platform audit logs.");
  }
}
