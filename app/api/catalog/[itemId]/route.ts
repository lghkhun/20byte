import { type NextRequest, NextResponse } from "next/server";

import { requireApiSession } from "@/lib/auth/middleware";
import { resolvePrimaryOrganizationIdForUser } from "@/server/services/organizationService";
import { deleteCatalogItem, updateCatalogItem } from "@/server/services/catalogService";
import { ServiceError } from "@/server/services/serviceError";

type UpdateCatalogRequest = {
  orgId?: unknown;
  name?: unknown;
  category?: unknown;
  unit?: unknown;
  priceCents?: unknown;
  currency?: unknown;
  attachmentUrl?: unknown;
  attachmentType?: unknown;
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

export async function PATCH(
  request: NextRequest,
  context: {
    params: {
      itemId: string;
    };
  }
) {
  const auth = requireApiSession(request);
  if (auth.response) {
    return auth.response;
  }

  let body: UpdateCatalogRequest;
  try {
    body = (await request.json()) as UpdateCatalogRequest;
  } catch {
    return errorResponse(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  try {
    const orgId = await resolvePrimaryOrganizationIdForUser(
      auth.session.userId,
      typeof body.orgId === "string" ? body.orgId : ""
    );
    const item = await updateCatalogItem({
      actorUserId: auth.session.userId,
      orgId,
      itemId: context.params.itemId,
      name: typeof body.name === "string" ? body.name : undefined,
      category: typeof body.category === "string" ? body.category : undefined,
      unit: typeof body.unit === "string" ? body.unit : undefined,
      priceCents: typeof body.priceCents === "number" ? body.priceCents : undefined,
      currency: typeof body.currency === "string" ? body.currency : undefined,
      attachmentUrl: typeof body.attachmentUrl === "string" ? body.attachmentUrl : undefined,
      attachmentType: typeof body.attachmentType === "string" ? body.attachmentType : undefined
    });

    return NextResponse.json(
      {
        data: {
          item
        },
        meta: {}
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.status, error.code, error.message);
    }

    return errorResponse(500, "CATALOG_UPDATE_FAILED", "Failed to update catalog item.");
  }
}

export async function DELETE(
  request: NextRequest,
  context: {
    params: {
      itemId: string;
    };
  }
) {
  const auth = requireApiSession(request);
  if (auth.response) {
    return auth.response;
  }

  try {
    const orgId = await resolvePrimaryOrganizationIdForUser(
      auth.session.userId,
      request.nextUrl.searchParams.get("orgId")?.trim() ?? ""
    );
    await deleteCatalogItem(auth.session.userId, orgId, context.params.itemId);

    return NextResponse.json(
      {
        data: {
          deleted: true
        },
        meta: {}
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.status, error.code, error.message);
    }

    return errorResponse(500, "CATALOG_DELETE_FAILED", "Failed to delete catalog item.");
  }
}
