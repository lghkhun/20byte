import { type NextRequest, NextResponse } from "next/server";

import { requireApiSession } from "@/lib/auth/middleware";
import {
  createOrganizationForUser,
  listOrganizationsForUser
} from "@/server/services/organizationService";
import { ServiceError } from "@/server/services/serviceError";

type CreateOrganizationRequest = {
  name?: unknown;
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
    const organizations = await listOrganizationsForUser(auth.session.userId);
    return NextResponse.json(
      {
        data: {
          organizations
        },
        meta: {}
      },
      { status: 200 }
    );
  } catch {
    return errorResponse(500, "ORG_LIST_FAILED", "Failed to fetch organizations.");
  }
}

export async function POST(request: NextRequest) {
  const auth = requireApiSession(request);
  if (auth.response) {
    return auth.response;
  }

  let body: CreateOrganizationRequest;
  try {
    body = (await request.json()) as CreateOrganizationRequest;
  } catch {
    return errorResponse(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const name = typeof body.name === "string" ? body.name : "";

  try {
    const organization = await createOrganizationForUser({
      userId: auth.session.userId,
      name
    });

    return NextResponse.json(
      {
        data: {
          organization
        },
        meta: {}
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.status, error.code, error.message);
    }

    return errorResponse(500, "ORG_CREATE_FAILED", "Failed to create organization.");
  }
}

