import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { errorResponse } from "@/lib/api/http";
import { requireApiSession } from "@/lib/auth/middleware";
import { requireSuperadmin } from "@/server/services/platformAccessService";
import { ServiceError } from "@/server/services/serviceError";
import { listPlatformAuditLogs, normalizePlatformAuditLogLimit } from "@/server/services/superadminService";

function csvEscape(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

export async function GET(request: NextRequest) {
  const auth = requireApiSession(request);
  if (auth.response) {
    return auth.response;
  }

  const query = request.nextUrl.searchParams.get("query");
  const action = request.nextUrl.searchParams.get("action");
  const targetType = request.nextUrl.searchParams.get("targetType");
  const limitRaw = request.nextUrl.searchParams.get("limit");
  const limit = normalizePlatformAuditLogLimit(limitRaw ? Number(limitRaw) : 5000);
  const dateFromRaw = request.nextUrl.searchParams.get("dateFrom");
  const dateToRaw = request.nextUrl.searchParams.get("dateTo");
  const dateFrom = dateFromRaw ? new Date(`${dateFromRaw}T00:00:00.000Z`) : null;
  const dateTo = dateToRaw ? new Date(`${dateToRaw}T23:59:59.999Z`) : null;

  try {
    await requireSuperadmin(auth.session.userId, auth.session.email);

    const logs = await listPlatformAuditLogs({
      limit,
      query,
      action,
      targetType,
      dateFrom: dateFrom && Number.isFinite(dateFrom.getTime()) ? dateFrom : null,
      dateTo: dateTo && Number.isFinite(dateTo.getTime()) ? dateTo : null
    });

    const rows = [
      ["time", "actor", "action", "target_type", "target_id", "meta_json"],
      ...logs.map((log) => [
        log.createdAt.toISOString(),
        log.actor?.email ?? log.actorUserId,
        log.action,
        log.targetType,
        log.targetId,
        log.meta ? JSON.stringify(log.meta) : "{}"
      ])
    ];

    const csv = rows.map((row) => row.map((cell) => csvEscape(cell)).join(",")).join("\n");
    const filename = `superadmin-audit-${new Date().toISOString().slice(0, 19).replaceAll(":", "-")}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename=\"${filename}\"`
      }
    });
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.status, error.code, error.message);
    }

    return errorResponse(500, "SA_AUDIT_EXPORT_FAILED", "Failed to export platform audit logs.");
  }
}
