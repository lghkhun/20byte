import { type NextRequest, NextResponse } from "next/server";

import { requireApiSession } from "@/lib/auth/middleware";
import { resolvePrimaryOrganizationIdForUser } from "@/server/services/organizationService";
import { createCrmPipelineStage } from "@/server/services/crmPipelineService";
import { ServiceError } from "@/server/services/serviceError";

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function POST(
  request: NextRequest,
  context: {
    params: {
      pipelineId: string;
    };
  }
) {
  const auth = requireApiSession(request);
  if (auth.response) {
    return auth.response;
  }

  let body: { name?: unknown; color?: unknown; orgId?: unknown };
  try {
    body = (await request.json()) as { name?: unknown; color?: unknown; orgId?: unknown };
  } catch {
    return errorResponse(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  try {
    const orgId = await resolvePrimaryOrganizationIdForUser(auth.session.userId, typeof body.orgId === "string" ? body.orgId : "");
    const pipeline = await createCrmPipelineStage({
      actorUserId: auth.session.userId,
      orgId,
      pipelineId: context.params.pipelineId,
      name: typeof body.name === "string" ? body.name : "",
      color: typeof body.color === "string" ? body.color : ""
    });
    return NextResponse.json({ data: { pipeline }, meta: {} }, { status: 201 });
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.status, error.code, error.message);
    }
    return errorResponse(500, "CRM_STAGE_CREATE_FAILED", "Failed to create CRM stage.");
  }
}
