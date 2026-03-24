import { type NextRequest, NextResponse } from "next/server";

import { requireApiSession } from "@/lib/auth/middleware";
import { resolvePrimaryOrganizationIdForUser } from "@/server/services/organizationService";
import { deleteConversation, getConversationById } from "@/server/services/conversationService";
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

type ConversationDetailPayload = Awaited<ReturnType<typeof getConversationById>>;
const CONVERSATION_DETAIL_CACHE_TTL_MS = 8_000;
const conversationDetailCache = new Map<string, { expiresAt: number; data: ConversationDetailPayload }>();
const conversationDetailInflight = new Map<string, Promise<ConversationDetailPayload>>();

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

async function getCachedConversationDetail(
  cacheKey: string,
  loader: () => Promise<ConversationDetailPayload>
): Promise<{ data: ConversationDetailPayload; fromCache: boolean }> {
  const now = Date.now();
  const cached = conversationDetailCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return { data: cached.data, fromCache: true };
  }

  const inflight = conversationDetailInflight.get(cacheKey);
  if (inflight) {
    return { data: await inflight, fromCache: true };
  }

  const request = (async () => {
    const data = await loader();
    conversationDetailCache.set(cacheKey, {
      expiresAt: Date.now() + CONVERSATION_DETAIL_CACHE_TTL_MS,
      data
    });
    return data;
  })();

  conversationDetailInflight.set(cacheKey, request);
  try {
    return { data: await request, fromCache: false };
  } finally {
    conversationDetailInflight.delete(cacheKey);
  }
}

export async function GET(
  request: NextRequest,
  context: {
    params: {
      conversationId: string;
    };
  }
) {
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
    const { data: conversation, fromCache } = await getCachedConversationDetail(cacheKey, async () =>
      getConversationById(auth.session.userId, orgId, conversationId)
    );
    return withServerTiming(NextResponse.json(
      {
        data: {
          conversation
        },
        meta: {}
      },
      { status: 200 }
    ), startedAt, fromCache ? "HIT" : "MISS");
  } catch (error) {
    if (error instanceof ServiceError) {
      return withServerTiming(errorResponse(error.status, error.code, error.message), startedAt);
    }

    return withServerTiming(errorResponse(500, "CONVERSATION_FETCH_FAILED", "Failed to fetch conversation."), startedAt);
  }
}

export async function DELETE(
  request: NextRequest,
  context: {
    params: {
      conversationId: string;
    };
  }
) {
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
    const deleted = await deleteConversation({
      actorUserId: auth.session.userId,
      orgId,
      conversationId
    });
    const cachePrefix = `${auth.session.userId}:${orgId}:`;
    for (const key of conversationDetailCache.keys()) {
      if (key.startsWith(cachePrefix)) {
        conversationDetailCache.delete(key);
      }
    }
    for (const key of conversationDetailInflight.keys()) {
      if (key.startsWith(cachePrefix)) {
        conversationDetailInflight.delete(key);
      }
    }

    return withServerTiming(NextResponse.json(
      {
        data: {
          conversationId: deleted.id
        }
      },
      { status: 200 }
    ), startedAt);
  } catch (error) {
    if (error instanceof ServiceError) {
      return withServerTiming(errorResponse(error.status, error.code, error.message), startedAt);
    }

    return withServerTiming(errorResponse(500, "CONVERSATION_DELETE_FAILED", "Failed to delete conversation."), startedAt);
  }
}
