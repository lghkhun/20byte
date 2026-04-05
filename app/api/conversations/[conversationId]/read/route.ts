import { type NextRequest, NextResponse } from "next/server";

import { requireApiSession } from "@/lib/auth/middleware";
import { markConversationAsRead } from "@/server/services/conversationService";
import { resolvePrimaryOrganizationIdForUser } from "@/server/services/organizationService";
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

function withServerTiming<T>(response: T, startedAt: number): T {
  const durationMs = Number((performance.now() - startedAt).toFixed(1));
  if (response instanceof Response) {
    response.headers.set("Server-Timing", `app;dur=${durationMs}`);
  }
  return response;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{conversationId: string;}> }
) {
  const startedAt = performance.now();
  const auth = requireApiSession(request);
  if (auth.response) {
    return withServerTiming(auth.response, startedAt);
  }

  try {
    const orgId = await resolvePrimaryOrganizationIdForUser(
      auth.session.userId,
      request.nextUrl.searchParams.get("orgId")?.trim() ?? ""
    );

    const result = await markConversationAsRead({
      actorUserId: auth.session.userId,
      orgId,
      conversationId: (await context.params).conversationId
    });

    return withServerTiming(
      NextResponse.json(
        {
          data: result,
          meta: {}
        },
        { status: 200 }
      ),
      startedAt
    );
  } catch (error) {
    if (error instanceof ServiceError) {
      return withServerTiming(errorResponse(error.status, error.code, error.message), startedAt);
    }

    return withServerTiming(errorResponse(500, "CONVERSATION_MARK_READ_FAILED", "Failed to mark conversation as read."), startedAt);
  }
}
