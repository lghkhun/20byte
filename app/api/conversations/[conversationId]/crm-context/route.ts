import { type NextRequest, NextResponse } from "next/server";

import { requireApiSession } from "@/lib/auth/middleware";
import { resolvePrimaryOrganizationIdForUser } from "@/server/services/organizationService";
import { getConversationCrmContext } from "@/server/services/inboxCrmService";
import { ServiceError } from "@/server/services/serviceError";

const CRM_CONTEXT_CACHE_TTL_MS = 1_000;
const CRM_CONTEXT_MAX_CACHE_ENTRIES = 500;

type CrmContextResponsePayload = {
  data: {
    invoices: Awaited<ReturnType<typeof getConversationCrmContext>>["invoices"];
    events: Awaited<ReturnType<typeof getConversationCrmContext>>["events"];
  };
  meta: Record<string, never>;
};

const crmContextCache = new Map<string, { expiresAt: number; payload: CrmContextResponsePayload }>();
const crmContextInflight = new Map<string, Promise<CrmContextResponsePayload>>();

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
  params: Promise<{
    conversationId: string;
  }>;
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

function buildCacheKey(input: { userId: string; orgId: string; conversationId: string }): string {
  return `${input.userId}::${input.orgId}::${input.conversationId}`;
}

function pruneCrmContextCache(): void {
  const now = Date.now();
  for (const [key, value] of crmContextCache) {
    if (value.expiresAt <= now) {
      crmContextCache.delete(key);
    }
  }

  if (crmContextCache.size <= CRM_CONTEXT_MAX_CACHE_ENTRIES) {
    return;
  }

  for (const key of crmContextCache.keys()) {
    crmContextCache.delete(key);
    if (crmContextCache.size <= CRM_CONTEXT_MAX_CACHE_ENTRIES) {
      break;
    }
  }
}

export async function GET(request: NextRequest, context: RouteParams) {
  const startedAt = performance.now();
  const auth = requireApiSession(request);
  if (auth.response) {
    return withServerTiming(auth.response, startedAt);
  }

  const conversationId = (await context.params).conversationId;
  const fresh = request.nextUrl.searchParams.get("fresh") === "1";

  try {
    const orgId = await resolvePrimaryOrganizationIdForUser(
      auth.session.userId,
      request.nextUrl.searchParams.get("orgId")?.trim() ?? ""
    );
    const cacheKey = buildCacheKey({
      userId: auth.session.userId,
      orgId,
      conversationId
    });

    if (!fresh) {
      const cached = crmContextCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        return withServerTiming(NextResponse.json(cached.payload, { status: 200 }), startedAt, "HIT");
      }

      const inflight = crmContextInflight.get(cacheKey);
      if (inflight) {
        const payload = await inflight;
        return withServerTiming(NextResponse.json(payload, { status: 200 }), startedAt, "HIT");
      }
    }

    const requestPromise = (async (): Promise<CrmContextResponsePayload> => {
      const result = await getConversationCrmContext({
        actorUserId: auth.session.userId,
        orgId,
        conversationId
      });

      return {
        data: {
          invoices: result.invoices,
          events: result.events
        },
        meta: {}
      };
    })();

    if (!fresh) {
      crmContextInflight.set(cacheKey, requestPromise);
    }

    try {
      const payload = await requestPromise;
      if (!fresh) {
        pruneCrmContextCache();
        crmContextCache.set(cacheKey, {
          expiresAt: Date.now() + CRM_CONTEXT_CACHE_TTL_MS,
          payload
        });
      }
      return withServerTiming(NextResponse.json(payload, { status: 200 }), startedAt, "MISS");
    } finally {
      if (!fresh) {
        crmContextInflight.delete(cacheKey);
      }
    }
  } catch (error) {
    if (error instanceof ServiceError) {
      return withServerTiming(errorResponse(error.status, error.code, error.message), startedAt);
    }

    return withServerTiming(errorResponse(500, "CRM_CONTEXT_FETCH_FAILED", "Failed to fetch CRM context."), startedAt);
  }
}
