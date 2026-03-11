import { type NextRequest, NextResponse } from "next/server";

import { requireApiSession } from "@/lib/auth/middleware";
import { getConversationCrmContext } from "@/server/services/inboxCrmService";
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

type RouteParams = {
  params: {
    conversationId: string;
  };
};

export async function GET(request: NextRequest, context: RouteParams) {
  const auth = requireApiSession(request);
  if (auth.response) {
    return auth.response;
  }

  const orgId = request.nextUrl.searchParams.get("orgId")?.trim() ?? "";
  const conversationId = context.params.conversationId;

  try {
    const result = await getConversationCrmContext({
      actorUserId: auth.session.userId,
      orgId,
      conversationId
    });

    return NextResponse.json(
      {
        data: {
          invoices: result.invoices,
          events: result.events
        },
        meta: {}
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.status, error.code, error.message);
    }

    return errorResponse(500, "CRM_CONTEXT_FETCH_FAILED", "Failed to fetch CRM context.");
  }
}
