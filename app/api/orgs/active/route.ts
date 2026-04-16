import { type NextRequest, NextResponse } from "next/server";

import { getActiveOrgIdFromRequest, setActiveOrgCookie } from "@/lib/auth/activeOrg";
import { requireApiSession } from "@/lib/auth/middleware";
import {
  getActiveOrganizationForUser,
  listOrganizationsForUser,
  resolvePrimaryOrganizationIdForUser
} from "@/server/services/organizationService";
import { ServiceError } from "@/server/services/serviceError";

type SetActiveOrgRequest = {
  orgId?: unknown;
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
    const cookieOrgId = getActiveOrgIdFromRequest(request);
    const [organizations, activeOrg] = await Promise.all([
      listOrganizationsForUser(auth.session.userId),
      getActiveOrganizationForUser(auth.session.userId, cookieOrgId)
    ]);

    const activeOrgId = activeOrg?.id ?? organizations[0]?.id ?? null;
    const response = NextResponse.json(
      {
        data: {
          activeOrgId,
          activeOrganization: activeOrg,
          organizations
        },
        meta: {}
      },
      { status: 200 }
    );

    if (activeOrgId && activeOrgId !== cookieOrgId) {
      setActiveOrgCookie(response, activeOrgId);
    }

    return response;
  } catch {
    return errorResponse(500, "ACTIVE_ORG_GET_FAILED", "Failed to resolve active business.");
  }
}

export async function PUT(request: NextRequest) {
  const auth = requireApiSession(request);
  if (auth.response) {
    return auth.response;
  }

  let body: SetActiveOrgRequest;
  try {
    body = (await request.json()) as SetActiveOrgRequest;
  } catch {
    return errorResponse(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const candidateOrgId = typeof body.orgId === "string" ? body.orgId.trim() : "";
  if (!candidateOrgId) {
    return errorResponse(400, "MISSING_ORG_ID", "orgId is required.");
  }

  try {
    const orgId = await resolvePrimaryOrganizationIdForUser(auth.session.userId, candidateOrgId);
    const activeOrg = await getActiveOrganizationForUser(auth.session.userId, orgId);
    const response = NextResponse.json(
      {
        data: {
          activeOrgId: orgId,
          activeOrganization: activeOrg
        },
        meta: {}
      },
      { status: 200 }
    );
    setActiveOrgCookie(response, orgId);
    return response;
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.status, error.code, error.message);
    }
    return errorResponse(500, "ACTIVE_ORG_SET_FAILED", "Failed to update active business.");
  }
}
