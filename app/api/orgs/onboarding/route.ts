import { type NextRequest, NextResponse } from "next/server";

import { requireApiSession } from "@/lib/auth/middleware";
import { getOrganizationOnboardingStatus } from "@/server/services/organizationService";
import { ServiceError } from "@/server/services/serviceError";

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

  const orgId = request.nextUrl.searchParams.get("orgId")?.trim() ?? "";
  if (!orgId) {
    return errorResponse(400, "MISSING_ORG_ID", "orgId is required.");
  }

  try {
    const onboarding = await getOrganizationOnboardingStatus(auth.session.userId, orgId);
    return NextResponse.json(
      {
        data: {
          onboarding
        },
        meta: {}
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.status, error.code, error.message);
    }

    return errorResponse(500, "ONBOARDING_STATUS_FAILED", "Failed to fetch onboarding status.");
  }
}

