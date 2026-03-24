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

type CrmContextPayload = Awaited<ReturnType<typeof getConversationCrmContext>>;

const CRM_CONTEXT_CACHE_TTL_MS = 8_000;
const crmContextCache = new Map<string, { expiresAt: number; data: CrmContextPayload }>();
const crmContextInflight = new Map<string, Promise<CrmContextPayload>>();

function withServerTiming<T>(response: T, startedAt: number, cacheStatus?: "HIT" | "MISS"): T {
  const durationMs = Number((performance.now() - startedAt).toFixed(1));
  if (response instanceof Response) {
    response.headers.set("Server-Timing", `app;dur=${durationMs}`);
    if (cacheStatus) {
      response.headers.set("X-Cache", cacheStatus);
    }
  }
  return response;
}

async function getCachedCrmContext(cacheKey: string, loader: () => Promise<CrmContextPayload>): Promise<{ data: CrmContextPayload; fromCache: boolean }> {
  const now = Date.now();
  const cached = crmContextCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return { data: cached.data, fromCache: true };
  }

  const inflight = crmContextInflight.get(cacheKey);
  if (inflight) {
    return { data: await inflight, fromCache: true };
  }

  const request = (async () => {
    const data = await loader();
    crmContextCache.set(cacheKey, {
      expiresAt: Date.now() + CRM_CONTEXT_CACHE_TTL_MS,
      data
    });
    return data;
  })();

  crmContextInflight.set(cacheKey, request);
  try {
    return { data: await request, fromCache: false };
  } finally {
    crmContextInflight.delete(cacheKey);
  }
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
    const cacheKey = `${auth.session.userId}:${orgId}:${conversationId}`;
    const { data: result, fromCache } = await getCachedCrmContext(cacheKey, async () =>
      getConversationCrmContext({
        actorUserId: auth.session.userId,
        orgId,
        conversationId
      })
    );

    return withServerTiming(NextResponse.json(
      {
        data: {
          invoices: result.invoices,
          events: result.events
        },
        meta: {}
      },
      { status: 200 }
    ), startedAt, fromCache ? "HIT" : "MISS");
  } catch (error) {
    if (error instanceof ServiceError) {
      return withServerTiming(errorResponse(error.status, error.code, error.message), startedAt);
    }

    return withServerTiming(errorResponse(500, "CRM_CONTEXT_FETCH_FAILED", "Failed to fetch CRM context."), startedAt);
  }
}
