import { type NextRequest, NextResponse } from "next/server";

import { requireApiSession } from "@/lib/auth/middleware";
import { resolvePrimaryOrganizationIdForUser } from "@/server/services/organizationService";
import { getConversationById } from "@/server/services/conversationService";
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

export async function GET(
  request: NextRequest,
  context: {
    params: {
      conversationId: string;
    };
  }
) {
  const auth = requireApiSession(request);
  if (auth.response) {
    return auth.response;
  }

  const conversationId = context.params.conversationId;

  try {
    const orgId = await resolvePrimaryOrganizationIdForUser(
      auth.session.userId,
      request.nextUrl.searchParams.get("orgId")?.trim() ?? ""
    );
    const conversation = await getConversationById(auth.session.userId, orgId, conversationId);
    return NextResponse.json(
      {
        data: {
          conversation
        },
        meta: {}
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.status, error.code, error.message);
    }

    return errorResponse(500, "CONVERSATION_FETCH_FAILED", "Failed to fetch conversation.");
  }
}
