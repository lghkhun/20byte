import { type NextRequest, NextResponse } from "next/server";

import { requireApiSession } from "@/lib/auth/middleware";
import { getMetaIntegration, upsertMetaIntegration } from "@/server/services/metaIntegrationService";
import { ServiceError } from "@/server/services/serviceError";

type UpdateMetaIntegrationRequest = {
  orgId?: unknown;
  pixelId?: unknown;
  accessToken?: unknown;
  testEventCode?: unknown;
  enabled?: unknown;
};

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json(
    {
      error: {
        code,
        message
      }
    },
    { status }
  );
}

export async function GET(request: NextRequest) {
  const auth = requireApiSession(request);
  if (auth.response) {
    return auth.response;
  }

  try {
    const integration = await getMetaIntegration(auth.session.userId, request.nextUrl.searchParams.get("orgId")?.trim() ?? "");
    return NextResponse.json(
      {
        data: {
          integration
        },
        meta: {}
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.status, error.code, error.message);
    }
    return errorResponse(500, "META_INTEGRATION_LOAD_FAILED", "Failed to load Meta integration.");
  }
}

export async function PATCH(request: NextRequest) {
  const auth = requireApiSession(request);
  if (auth.response) {
    return auth.response;
  }

  let body: UpdateMetaIntegrationRequest;
  try {
    body = (await request.json()) as UpdateMetaIntegrationRequest;
  } catch {
    return errorResponse(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  if (typeof body.pixelId !== "string" || !body.pixelId.trim()) {
    return errorResponse(400, "INVALID_META_PIXEL_ID", "pixelId is required.");
  }

  if (typeof body.enabled !== "boolean") {
    return errorResponse(400, "INVALID_META_ENABLED", "enabled must be boolean.");
  }

  if (body.accessToken !== undefined && body.accessToken !== null && typeof body.accessToken !== "string") {
    return errorResponse(400, "INVALID_META_ACCESS_TOKEN", "accessToken must be a string when provided.");
  }

  if (body.testEventCode !== undefined && body.testEventCode !== null && typeof body.testEventCode !== "string") {
    return errorResponse(400, "INVALID_META_TEST_EVENT_CODE", "testEventCode must be a string when provided.");
  }

  try {
    const integration = await upsertMetaIntegration({
      actorUserId: auth.session.userId,
      orgId: typeof body.orgId === "string" ? body.orgId : undefined,
      pixelId: body.pixelId,
      accessToken: typeof body.accessToken === "string" ? body.accessToken : undefined,
      testEventCode: typeof body.testEventCode === "string" ? body.testEventCode : null,
      enabled: body.enabled
    });

    return NextResponse.json(
      {
        data: {
          integration
        },
        meta: {}
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.status, error.code, error.message);
    }
    return errorResponse(500, "META_INTEGRATION_UPDATE_FAILED", "Failed to update Meta integration.");
  }
}
