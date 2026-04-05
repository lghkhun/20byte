import { type NextRequest, NextResponse } from "next/server";

import { requireApiSession } from "@/lib/auth/middleware";
import { resolvePrimaryOrganizationIdForUser } from "@/server/services/organizationService";
import { createCrmPipelineStage } from "@/server/services/crmPipelineService";
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

export async function POST(
  request: NextRequest,
  context: { params: Promise<{pipelineId: string;}> }
) {
  const startedAt = performance.now();
  const auth = requireApiSession(request);
  if (auth.response) {
    return withServerTiming(auth.response, startedAt);
  }

  let body: { name?: unknown; color?: unknown; orgId?: unknown };
  try {
    body = (await request.json()) as { name?: unknown; color?: unknown; orgId?: unknown };
  } catch {
    return withServerTiming(errorResponse(400, "INVALID_JSON", "Request body must be valid JSON."), startedAt);
  }

  try {
    const orgId = await resolvePrimaryOrganizationIdForUser(auth.session.userId, typeof body.orgId === "string" ? body.orgId : "");
    const pipeline = await createCrmPipelineStage({
      actorUserId: auth.session.userId,
      orgId,
      pipelineId: (await context.params).pipelineId,
      name: typeof body.name === "string" ? body.name : "",
      color: typeof body.color === "string" ? body.color : ""
    });
    return withServerTiming(NextResponse.json({ data: { pipeline }, meta: {} }, { status: 201 }), startedAt);
  } catch (error) {
    if (error instanceof ServiceError) {
      return withServerTiming(errorResponse(error.status, error.code, error.message), startedAt);
    }
    return withServerTiming(errorResponse(500, "CRM_STAGE_CREATE_FAILED", "Failed to create CRM stage."), startedAt);
  }
}
