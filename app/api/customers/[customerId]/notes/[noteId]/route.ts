import { type NextRequest, NextResponse } from "next/server";

import { requireApiSession } from "@/lib/auth/middleware";
import { resolvePrimaryOrganizationIdForUser } from "@/server/services/organizationService";
import { deleteCustomerNote, updateCustomerNote } from "@/server/services/crmService";
import { ServiceError } from "@/server/services/serviceError";

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function PATCH(
  request: NextRequest,
  context: {
    params: {
      customerId: string;
      noteId: string;
    };
  }
) {
  const auth = requireApiSession(request);
  if (auth.response) {
    return auth.response;
  }

  let body: { orgId?: unknown; content?: unknown };
  try {
    body = (await request.json()) as { orgId?: unknown; content?: unknown };
  } catch {
    return errorResponse(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  try {
    const orgId = await resolvePrimaryOrganizationIdForUser(auth.session.userId, typeof body.orgId === "string" ? body.orgId : "");
    const note = await updateCustomerNote(
      auth.session.userId,
      orgId,
      context.params.customerId,
      context.params.noteId,
      typeof body.content === "string" ? body.content : ""
    );
    return NextResponse.json({ data: { note }, meta: {} }, { status: 200 });
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.status, error.code, error.message);
    }
    return errorResponse(500, "CUSTOMER_NOTE_UPDATE_FAILED", "Failed to update customer note.");
  }
}

export async function DELETE(
  request: NextRequest,
  context: {
    params: {
      customerId: string;
      noteId: string;
    };
  }
) {
  const auth = requireApiSession(request);
  if (auth.response) {
    return auth.response;
  }

  try {
    const orgId = await resolvePrimaryOrganizationIdForUser(auth.session.userId, request.nextUrl.searchParams.get("orgId") ?? "");
    await deleteCustomerNote(auth.session.userId, orgId, context.params.customerId, context.params.noteId);
    return NextResponse.json({ data: { deleted: true }, meta: {} }, { status: 200 });
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.status, error.code, error.message);
    }
    return errorResponse(500, "CUSTOMER_NOTE_DELETE_FAILED", "Failed to delete customer note.");
  }
}
