import { type NextRequest, NextResponse } from "next/server";

import { requireApiSession } from "@/lib/auth/middleware";
import { resolvePrimaryOrganizationIdForUser } from "@/server/services/organizationService";
import { listConversationMessages } from "@/server/services/messageService";
import { ServiceError } from "@/server/services/serviceError";

const MESSAGES_CACHE_TTL_MS = 900;
const MESSAGES_MAX_CACHE_ENTRIES = 500;

type MessagesResponsePayload = {
  data: {
    messages: Awaited<ReturnType<typeof listConversationMessages>>["messages"];
  };
  meta: {
    limit: number;
    hasMore: boolean;
    nextBeforeMessageId: string | null;
    total?: number;
  };
};

const messagesCache = new Map<string, { expiresAt: number; payload: MessagesResponsePayload }>();
const messagesInflight = new Map<string, Promise<MessagesResponsePayload>>();

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

function buildCacheKey(input: {
  userId: string;
  orgId: string;
  conversationId: string;
  beforeMessageId: string;
  limit: number;
}): string {
  return [
    input.userId,
    input.orgId,
    input.conversationId,
    input.beforeMessageId || "__latest__",
    String(input.limit)
  ].join("::");
}

function pruneMessagesCache(): void {
  const now = Date.now();
  for (const [key, value] of messagesCache) {
    if (value.expiresAt <= now) {
      messagesCache.delete(key);
    }
  }

  if (messagesCache.size <= MESSAGES_MAX_CACHE_ENTRIES) {
    return;
  }

  for (const key of messagesCache.keys()) {
    messagesCache.delete(key);
    if (messagesCache.size <= MESSAGES_MAX_CACHE_ENTRIES) {
      break;
    }
  }
}

export async function GET(request: NextRequest) {
  const startedAt = performance.now();
  const auth = requireApiSession(request);
  if (auth.response) {
    return withServerTiming(auth.response, startedAt);
  }

  const conversationId = request.nextUrl.searchParams.get("conversationId")?.trim() ?? "";
  const limit = parseNumber(request.nextUrl.searchParams.get("limit"), 30);
  const beforeMessageId = request.nextUrl.searchParams.get("beforeMessageId")?.trim() ?? "";
  const fresh = request.nextUrl.searchParams.get("fresh") === "1";

  try {
    const orgId = await resolvePrimaryOrganizationIdForUser(
      auth.session.userId,
      request.nextUrl.searchParams.get("orgId")?.trim() ?? ""
    );
    const cacheKey = buildCacheKey({
      userId: auth.session.userId,
      orgId,
      conversationId,
      beforeMessageId,
      limit
    });

    if (!fresh) {
      const cached = messagesCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        return withServerTiming(NextResponse.json(cached.payload, { status: 200 }), startedAt, "HIT");
      }

      const inflight = messagesInflight.get(cacheKey);
      if (inflight) {
        const payload = await inflight;
        return withServerTiming(NextResponse.json(payload, { status: 200 }), startedAt, "HIT");
      }
    }

    const requestPromise = (async (): Promise<MessagesResponsePayload> => {
      const result = await listConversationMessages({
        actorUserId: auth.session.userId,
        orgId,
        conversationId,
        beforeMessageId,
        limit
      });

      return {
        data: {
          messages: result.messages
        },
        meta: {
          limit: result.limit,
          hasMore: result.hasMore,
          nextBeforeMessageId: result.nextBeforeMessageId,
          total: result.total
        }
      };
    })();

    if (!fresh) {
      messagesInflight.set(cacheKey, requestPromise);
    }

    try {
      const payload = await requestPromise;
      if (!fresh) {
        pruneMessagesCache();
        messagesCache.set(cacheKey, {
          expiresAt: Date.now() + MESSAGES_CACHE_TTL_MS,
          payload
        });
      }
      return withServerTiming(NextResponse.json(payload, { status: 200 }), startedAt, "MISS");
    } finally {
      if (!fresh) {
        messagesInflight.delete(cacheKey);
      }
    }
  } catch (error) {
    if (error instanceof ServiceError) {
      return withServerTiming(errorResponse(error.status, error.code, error.message), startedAt);
    }

    return withServerTiming(errorResponse(500, "MESSAGE_LIST_FAILED", "Failed to list conversation messages."), startedAt);
  }
}
