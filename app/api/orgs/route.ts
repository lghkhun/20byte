import { type NextRequest, NextResponse } from "next/server";

import { getActiveOrgIdFromRequest, setActiveOrgCookie } from "@/lib/auth/activeOrg";
import { requireApiSession } from "@/lib/auth/middleware";
import { createBusinessProvisioningCheckout } from "@/server/services/billingService";
import {
  getActiveOrganizationForUser,
  listOrganizationsForUser
} from "@/server/services/organizationService";
import { ServiceError } from "@/server/services/serviceError";

type ProvisioningRequest = {
  businessName?: unknown;
  paymentMethod?: unknown;
  planMonths?: unknown;
  couponCode?: unknown;
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
    const sorted = activeOrgId
      ? [...organizations].sort((left, right) => {
          if (left.id === activeOrgId) {
            return -1;
          }
          if (right.id === activeOrgId) {
            return 1;
          }
          return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
        })
      : organizations;

    const response = NextResponse.json(
      {
        data: {
          organizations: sorted,
          activeOrgId
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
    return errorResponse(500, "ORG_LIST_FAILED", "Failed to fetch businesses.");
  }
}

export async function POST(request: NextRequest) {
  const auth = requireApiSession(request);
  if (auth.response) {
    return auth.response;
  }

  let body: ProvisioningRequest;
  try {
    body = (await request.json()) as ProvisioningRequest;
  } catch {
    return errorResponse(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  try {
    const result = await createBusinessProvisioningCheckout({
      actorUserId: auth.session.userId,
      businessName: body.businessName,
      paymentMethod: typeof body.paymentMethod === "string" ? body.paymentMethod : undefined,
      couponCode: typeof body.couponCode === "string" ? body.couponCode : undefined,
      planMonths:
        typeof body.planMonths === "number"
          ? body.planMonths
          : typeof body.planMonths === "string" && body.planMonths.trim()
            ? Number(body.planMonths)
            : undefined
    });

    return NextResponse.json(
      {
        data: result,
        meta: {}
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.status, error.code, error.message);
    }

    return errorResponse(500, "BUSINESS_PROVISIONING_FAILED", "Failed to start business provisioning checkout.");
  }
}
