import { type NextRequest, NextResponse } from "next/server";

import { requireApiSession } from "@/lib/auth/middleware";
import { resolvePrimaryOrganizationIdForUser } from "@/server/services/organizationService";
import { listCrmPipelineKanbanBoard } from "@/server/services/crmPipelineService";
import { ServiceError } from "@/server/services/serviceError";

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function GET(request: NextRequest) {
  const auth = requireApiSession(request);
  if (auth.response) {
    return auth.response;
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
    return NextResponse.json({ data: { board }, meta: {} }, { status: 200 });
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.status, error.code, error.message);
    }
    return errorResponse(500, "CRM_PIPELINE_BOARD_FAILED", "Failed to load CRM pipeline board.");
  }
}
