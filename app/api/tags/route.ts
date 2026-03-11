import { type NextRequest, NextResponse } from "next/server";

import { requireApiSession } from "@/lib/auth/middleware";
import { createTag } from "@/server/services/crmService";
import { ServiceError } from "@/server/services/serviceError";

type CreateTagRequest = {
  orgId?: unknown;
  name?: unknown;
  color?: unknown;
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

export async function POST(request: NextRequest) {
  const auth = requireApiSession(request);
  if (auth.response) {
    return auth.response;
  }

  let body: CreateTagRequest;
  try {
    body = (await request.json()) as CreateTagRequest;
  } catch {
    return errorResponse(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  try {
    const tag = await createTag(
      auth.session.userId,
      typeof body.orgId === "string" ? body.orgId : "",
      typeof body.name === "string" ? body.name : "",
      typeof body.color === "string" ? body.color : undefined
    );

    return NextResponse.json(
      {
        data: {
          tag
        },
        meta: {}
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.status, error.code, error.message);
    }

    return errorResponse(500, "TAG_CREATE_FAILED", "Failed to create tag.");
  }
}

