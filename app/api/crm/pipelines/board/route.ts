import { type NextRequest, NextResponse } from "next/server";

import { requireApiSession } from "@/lib/auth/middleware";
import { resolvePrimaryOrganizationIdForUser } from "@/server/services/organizationService";
import { listCrmPipelineKanbanBoard } from "@/server/services/crmPipelineService";
import { ServiceError } from "@/server/services/serviceError";

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

function withServerTiming<T>(response: T, startedAt: number): T {
  const durationMs = Number((performance.now() - startedAt).toFixed(1));
  if (response instanceof Response) {
    response.headers.set("Server-Timing", `app;dur=${durationMs}`);
  }
  return response;
}

export async function GET(request: NextRequest) {
  const startedAt = performance.now();
  const auth = requireApiSession(request);
  if (auth.response) {
    return withServerTiming(auth.response, startedAt);
  }

  try {
    const orgId = await resolvePrimaryOrganizationIdForUser(auth.session.userId, request.nextUrl.searchParams.get("orgId") ?? "");
    const board = await listCrmPipelineKanbanBoard({
      actorUserId: auth.session.userId,
      orgId,
      pipelineId: request.nextUrl.searchParams.get("pipelineId") ?? "",
      status: request.nextUrl.searchParams.get("status") ?? "OPEN",
      assigneeUserId: request.nextUrl.searchParams.get("assigneeUserId") ?? "ALL",
      activityFrom: request.nextUrl.searchParams.get("activityFrom") ?? "",
      activityTo: request.nextUrl.searchParams.get("activityTo") ?? ""
    });
    return withServerTiming(NextResponse.json({ data: { board }, meta: {} }, { status: 200 }), startedAt);
  } catch (error) {
    if (error instanceof ServiceError) {
      return withServerTiming(errorResponse(error.status, error.code, error.message), startedAt);
    }
    return withServerTiming(errorResponse(500, "CRM_PIPELINE_BOARD_FAILED", "Failed to load CRM pipeline board."), startedAt);
  }
}
