import { type NextRequest, NextResponse } from "next/server";

import { requireApiSession } from "@/lib/auth/middleware";
import { resolvePrimaryOrganizationIdForUser } from "@/server/services/organizationService";
import { createCatalogItem, listCatalogItems } from "@/server/services/catalogService";
import { ServiceError } from "@/server/services/serviceError";

type CreateCatalogRequest = {
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

function parseInteger(value: string | null): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }

  return parsed;
}

export async function GET(request: NextRequest) {
  const auth = requireApiSession(request);
  if (auth.response) {
    return auth.response;
  }

  const q = request.nextUrl.searchParams.get("q")?.trim();
  const page = parseInteger(request.nextUrl.searchParams.get("page"));
  const limit = parseInteger(request.nextUrl.searchParams.get("limit"));

  try {
    const orgId = await resolvePrimaryOrganizationIdForUser(
      auth.session.userId,
      request.nextUrl.searchParams.get("orgId")?.trim() ?? ""
    );
    const result = await listCatalogItems(auth.session.userId, orgId, q, page, limit);

    return NextResponse.json(
      {
        data: {
          items: result.items
        },
        meta: {
          page: result.page,
          limit: result.limit,
          total: result.total
        }
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.status, error.code, error.message);
    }

    return errorResponse(500, "CATALOG_LIST_FAILED", "Failed to load catalog items.");
  }
}

export async function POST(request: NextRequest) {
  const auth = requireApiSession(request);
  if (auth.response) {
    return auth.response;
  }

  let body: CreateCatalogRequest;
  try {
    body = (await request.json()) as CreateCatalogRequest;
  } catch {
    return errorResponse(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  try {
    const orgId = await resolvePrimaryOrganizationIdForUser(
      auth.session.userId,
      typeof body.orgId === "string" ? body.orgId : ""
    );
    const item = await createCatalogItem({
      actorUserId: auth.session.userId,
      orgId,
      name: typeof body.name === "string" ? body.name : "",
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
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.status, error.code, error.message);
    }

    return errorResponse(500, "CATALOG_CREATE_FAILED", "Failed to create catalog item.");
  }
}
