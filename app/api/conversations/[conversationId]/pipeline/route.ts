import { type NextRequest, NextResponse } from "next/server";

import { requireApiSession } from "@/lib/auth/middleware";
import { resolvePrimaryOrganizationIdForUser } from "@/server/services/organizationService";
import { assignConversationPipeline } from "@/server/services/crmPipelineService";
import { getConversationById } from "@/server/services/conversationService";
import { ServiceError } from "@/server/services/serviceError";

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{conversationId: string;}> }
) {
  const auth = requireApiSession(request);
  if (auth.response) {
    return auth.response;
  }

  let body: { pipelineId?: unknown; stageId?: unknown; orgId?: unknown };
  try {
    body = (await request.json()) as { pipelineId?: unknown; stageId?: unknown; orgId?: unknown };
  } catch {
    return errorResponse(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  try {
    const orgId = await resolvePrimaryOrganizationIdForUser(auth.session.userId, typeof body.orgId === "string" ? body.orgId : "");
    await assignConversationPipeline({
      actorUserId: auth.session.userId,
      orgId,
      conversationId: (await context.params).conversationId,
      pipelineId: typeof body.pipelineId === "string" ? body.pipelineId : "",
      stageId: typeof body.stageId === "string" ? body.stageId : ""
    });

    const conversation = await getConversationById(auth.session.userId, orgId, (await context.params).conversationId);
    return NextResponse.json({ data: { conversation }, meta: {} }, { status: 200 });
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.status, error.code, error.message);
    }
    return errorResponse(500, "CRM_PIPELINE_ASSIGN_FAILED", "Failed to update CRM pipeline.");
  }
}
