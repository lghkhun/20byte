import { type NextRequest, NextResponse } from "next/server";

import { requireApiSession } from "@/lib/auth/middleware";
import { resolvePrimaryOrganizationIdForUser } from "@/server/services/organizationService";
import { assignConversation } from "@/server/services/conversationService";
import { ServiceError } from "@/server/services/serviceError";

type AssignConversationRequest = {
  orgId?: unknown;
  conversationId?: unknown;
  assigneeUserId?: unknown;
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

export async function POST(request: NextRequest) {
  const auth = requireApiSession(request);
  if (auth.response) {
    return auth.response;
  }

  let body: AssignConversationRequest;
  try {
    body = (await request.json()) as AssignConversationRequest;
  } catch {
    return errorResponse(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  try {
    const orgId = await resolvePrimaryOrganizationIdForUser(
      auth.session.userId,
      typeof body.orgId === "string" ? body.orgId : ""
    );
    const assignment = await assignConversation({
      actorUserId: auth.session.userId,
      orgId,
      conversationId: typeof body.conversationId === "string" ? body.conversationId : "",
      assigneeUserId: typeof body.assigneeUserId === "string" ? body.assigneeUserId : undefined
    });

    return NextResponse.json(
      {
        data: {
          assignment
        },
        meta: {}
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.status, error.code, error.message);
    }

    return errorResponse(500, "CONVERSATION_ASSIGN_FAILED", "Failed to assign conversation.");
  }
}
