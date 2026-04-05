import { type NextRequest, NextResponse } from "next/server";

import { requireApiSession } from "@/lib/auth/middleware";
import { resolvePrimaryOrganizationIdForUser } from "@/server/services/organizationService";
import { createCustomerNote, listCustomerNotes } from "@/server/services/crmService";
import { ServiceError } from "@/server/services/serviceError";

type CreateNoteRequest = {
  orgId?: unknown;
  content?: unknown;
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

function parseNumber(value: string | null, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return parsed;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{customerId: string;}> }
) {
  const auth = requireApiSession(request);
  if (auth.response) {
    return auth.response;
  }

  const customerId = (await context.params).customerId;
  const page = parseNumber(request.nextUrl.searchParams.get("page"), 1);
  const limit = parseNumber(request.nextUrl.searchParams.get("limit"), 20);

  try {
    const orgId = await resolvePrimaryOrganizationIdForUser(
      auth.session.userId,
      request.nextUrl.searchParams.get("orgId")?.trim() ?? ""
    );
    const result = await listCustomerNotes(auth.session.userId, orgId, customerId, page, limit);
    return NextResponse.json(
      {
        data: {
          notes: result.notes
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

    return errorResponse(500, "CUSTOMER_NOTE_LIST_FAILED", "Failed to load customer notes.");
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{customerId: string;}> }
) {
  const auth = requireApiSession(request);
  if (auth.response) {
    return auth.response;
  }

  let body: CreateNoteRequest;
  try {
    body = (await request.json()) as CreateNoteRequest;
  } catch {
    return errorResponse(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  try {
    const orgId = await resolvePrimaryOrganizationIdForUser(
      auth.session.userId,
      typeof body.orgId === "string" ? body.orgId : ""
    );
    const note = await createCustomerNote(
      auth.session.userId,
      orgId,
      (await context.params).customerId,
      typeof body.content === "string" ? body.content : ""
    );
    return NextResponse.json(
      {
        data: {
          note
        },
        meta: {}
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.status, error.code, error.message);
    }

    return errorResponse(500, "CUSTOMER_NOTE_CREATE_FAILED", "Failed to create customer note.");
  }
}
