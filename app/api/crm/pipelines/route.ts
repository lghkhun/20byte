import { type NextRequest, NextResponse } from "next/server";

import { requireApiSession } from "@/lib/auth/middleware";
import { resolvePrimaryOrganizationIdForUser } from "@/server/services/organizationService";
import { createCrmPipeline, listCrmPipelines } from "@/server/services/crmPipelineService";
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
    const pipelines = await listCrmPipelines(auth.session.userId, orgId);
    return withServerTiming(NextResponse.json({ data: { pipelines }, meta: {} }, { status: 200 }), startedAt);
  } catch (error) {
    if (error instanceof ServiceError) {
      return withServerTiming(errorResponse(error.status, error.code, error.message), startedAt);
    }
    return withServerTiming(errorResponse(500, "CRM_PIPELINE_LIST_FAILED", "Failed to load CRM pipelines."), startedAt);
  }
}

export async function POST(request: NextRequest) {
  const startedAt = performance.now();
  const auth = requireApiSession(request);
  if (auth.response) {
    return withServerTiming(auth.response, startedAt);
  }

  let body: { name?: unknown; orgId?: unknown };
  try {
    body = (await request.json()) as { name?: unknown; orgId?: unknown };
  } catch {
    return withServerTiming(errorResponse(400, "INVALID_JSON", "Request body must be valid JSON."), startedAt);
  }

  try {
    const orgId = await resolvePrimaryOrganizationIdForUser(auth.session.userId, typeof body.orgId === "string" ? body.orgId : "");
    const pipeline = await createCrmPipeline({
      actorUserId: auth.session.userId,
      orgId,
      name: typeof body.name === "string" ? body.name : ""
    });
    return withServerTiming(NextResponse.json({ data: { pipeline }, meta: {} }, { status: 201 }), startedAt);
  } catch (error) {
    if (error instanceof ServiceError) {
      return withServerTiming(errorResponse(error.status, error.code, error.message), startedAt);
    }
    return withServerTiming(errorResponse(500, "CRM_PIPELINE_CREATE_FAILED", "Failed to create CRM pipeline."), startedAt);
  }
}
