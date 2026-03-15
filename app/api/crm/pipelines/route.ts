import { type NextRequest, NextResponse } from "next/server";

import { requireApiSession } from "@/lib/auth/middleware";
import { resolvePrimaryOrganizationIdForUser } from "@/server/services/organizationService";
import { createCrmPipeline, listCrmPipelines } from "@/server/services/crmPipelineService";
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
    const pipelines = await listCrmPipelines(auth.session.userId, orgId);
    return NextResponse.json({ data: { pipelines }, meta: {} }, { status: 200 });
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.status, error.code, error.message);
    }
    return errorResponse(500, "CRM_PIPELINE_LIST_FAILED", "Failed to load CRM pipelines.");
  }
}

export async function POST(request: NextRequest) {
  const auth = requireApiSession(request);
  if (auth.response) {
    return auth.response;
  }

  let body: { name?: unknown; orgId?: unknown };
  try {
    body = (await request.json()) as { name?: unknown; orgId?: unknown };
  } catch {
    return errorResponse(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  try {
    const orgId = await resolvePrimaryOrganizationIdForUser(auth.session.userId, typeof body.orgId === "string" ? body.orgId : "");
    const pipeline = await createCrmPipeline({
      actorUserId: auth.session.userId,
      orgId,
      name: typeof body.name === "string" ? body.name : ""
    });
    return NextResponse.json({ data: { pipeline }, meta: {} }, { status: 201 });
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.status, error.code, error.message);
    }
    return errorResponse(500, "CRM_PIPELINE_CREATE_FAILED", "Failed to create CRM pipeline.");
  }
}
