import { type NextRequest, NextResponse } from "next/server";

import { requireApiSession } from "@/lib/auth/middleware";
import { resolvePrimaryOrganizationIdForUser } from "@/server/services/organizationService";
import { assignTagToCustomer, listCustomerTags } from "@/server/services/crmService";
import { ServiceError } from "@/server/services/serviceError";

type AssignTagRequest = {
  orgId?: unknown;
  tagId?: unknown;
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

export async function GET(
  request: NextRequest,
  context: {
    params: {
      customerId: string;
    };
  }
) {
  const auth = requireApiSession(request);
  if (auth.response) {
    return auth.response;
  }

  const customerId = context.params.customerId;

  try {
    const orgId = await resolvePrimaryOrganizationIdForUser(
      auth.session.userId,
      request.nextUrl.searchParams.get("orgId")?.trim() ?? ""
    );
    const tags = await listCustomerTags(auth.session.userId, orgId, customerId);
    return NextResponse.json(
      {
        data: {
          tags
        },
        meta: {}
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.status, error.code, error.message);
    }

    return errorResponse(500, "CUSTOMER_TAG_LIST_FAILED", "Failed to load customer tags.");
  }
}

export async function POST(
  request: NextRequest,
  context: {
    params: {
      customerId: string;
    };
  }
) {
  const auth = requireApiSession(request);
  if (auth.response) {
    return auth.response;
  }

  let body: AssignTagRequest;
  try {
    body = (await request.json()) as AssignTagRequest;
  } catch {
    return errorResponse(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  try {
    const orgId = await resolvePrimaryOrganizationIdForUser(
      auth.session.userId,
      typeof body.orgId === "string" ? body.orgId : ""
    );
    const tag = await assignTagToCustomer(
      auth.session.userId,
      orgId,
      context.params.customerId,
      typeof body.tagId === "string" ? body.tagId : ""
    );
    return NextResponse.json(
      {
        data: {
          tag
        },
        meta: {}
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.status, error.code, error.message);
    }

    return errorResponse(500, "CUSTOMER_TAG_ASSIGN_FAILED", "Failed to assign tag to customer.");
  }
}
