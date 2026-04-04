import { type NextRequest, NextResponse } from "next/server";

import { requireApiSession } from "@/lib/auth/middleware";
import { resolvePrimaryOrganizationIdForUser } from "@/server/services/organizationService";
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

function withServerTiming<T>(response: T, startedAt: number, cacheStatus?: "HIT" | "MISS"): T {
  const durationMs = Number((performance.now() - startedAt).toFixed(1));
  if (response instanceof Response) {
    response.headers.set("Server-Timing", `app;dur=${durationMs}`);
    if (cacheStatus) {
      response.headers.set("X-Cache", cacheStatus);
    }
    response.headers.set("Cache-Control", "no-store");
  }
  return response;
}

export async function GET(request: NextRequest, context: RouteParams) {
  const startedAt = performance.now();
  const auth = requireApiSession(request);
  if (auth.response) {
    return withServerTiming(auth.response, startedAt);
  }

  const conversationId = context.params.conversationId;

  try {
    const orgId = await resolvePrimaryOrganizationIdForUser(
      auth.session.userId,
      request.nextUrl.searchParams.get("orgId")?.trim() ?? ""
    );
    const result = await getConversationCrmContext({
      actorUserId: auth.session.userId,
      orgId,
      conversationId
    });

    return withServerTiming(NextResponse.json(
      {
        data: {
          invoices: result.invoices,
          events: result.events
        },
        meta: {}
      },
      { status: 200 }
    ), startedAt);
  } catch (error) {
    if (error instanceof ServiceError) {
      return withServerTiming(errorResponse(error.status, error.code, error.message), startedAt);
    }

    return withServerTiming(errorResponse(500, "CRM_CONTEXT_FETCH_FAILED", "Failed to fetch CRM context."), startedAt);
  }
}
