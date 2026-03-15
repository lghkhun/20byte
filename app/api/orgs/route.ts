import { type NextRequest, NextResponse } from "next/server";

import { requireApiSession } from "@/lib/auth/middleware";
import { listOrganizationsForUser } from "@/server/services/organizationService";

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
    return errorResponse(500, "ORG_LIST_FAILED", "Failed to fetch businesses.");
  }
}

export async function POST(request: NextRequest) {
  const auth = requireApiSession(request);
  if (auth.response) {
    return auth.response;
  }
  void auth;
  return errorResponse(
    410,
    "BUSINESS_CREATE_RETIRED",
    "Create business flow has been retired from the app. This MVP uses a single internal business per account."
  );
}
