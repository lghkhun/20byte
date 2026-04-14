import { type NextRequest, NextResponse } from "next/server";

import { requireApiSession } from "@/lib/auth/middleware";
import { resolvePrimaryOrganizationIdForUser } from "@/server/services/organizationService";
import { listCrmPipelineKanbanBoard } from "@/server/services/crmPipelineService";
import { ServiceError } from "@/server/services/serviceError";

const CRM_BOARD_CACHE_TTL_MS = 1_000;
const CRM_BOARD_MAX_CACHE_ENTRIES = 400;

type CrmBoardResponsePayload = {
  data: {
    board: Awaited<ReturnType<typeof listCrmPipelineKanbanBoard>>;
  };
  meta: Record<string, never>;
};

const crmBoardCache = new Map<string, { expiresAt: number; payload: CrmBoardResponsePayload }>();
const crmBoardInflight = new Map<string, Promise<CrmBoardResponsePayload>>();

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
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

function parsePositiveInt(value: string | null): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return undefined;
  }

  return parsed;
}

function buildCacheKey(input: {
  userId: string;
  orgId: string;
  pipelineId: string;
  status: string;
  assigneeUserId: string;
  activityFrom: string;
  activityTo: string;
  cardLimit: number | undefined;
  chatScope: string;
}): string {
  return [
    input.userId,
    input.orgId,
    input.pipelineId || "__default__",
    input.status || "OPEN",
    input.chatScope || "ALL",
    input.assigneeUserId || "ALL",
    input.activityFrom || "__none__",
    input.activityTo || "__none__",
    String(input.cardLimit ?? 80)
  ].join("::");
}

function pruneCrmBoardCache(): void {
  const now = Date.now();
  for (const [key, value] of crmBoardCache) {
    if (value.expiresAt <= now) {
      crmBoardCache.delete(key);
    }
  }

  if (crmBoardCache.size <= CRM_BOARD_MAX_CACHE_ENTRIES) {
    return;
  }

  for (const key of crmBoardCache.keys()) {
    crmBoardCache.delete(key);
    if (crmBoardCache.size <= CRM_BOARD_MAX_CACHE_ENTRIES) {
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

  const pipelineId = request.nextUrl.searchParams.get("pipelineId") ?? "";
  const status = request.nextUrl.searchParams.get("status") ?? "OPEN";
  const assigneeUserId = request.nextUrl.searchParams.get("assigneeUserId") ?? "ALL";
  const activityFrom = request.nextUrl.searchParams.get("activityFrom") ?? "";
  const activityTo = request.nextUrl.searchParams.get("activityTo") ?? "";
  const chatScope = request.nextUrl.searchParams.get("chatScope") ?? "ALL";
  const cardLimit = parsePositiveInt(request.nextUrl.searchParams.get("cardLimit"));
  const fresh = request.nextUrl.searchParams.get("fresh") === "1";

  try {
    const orgId = await resolvePrimaryOrganizationIdForUser(
      auth.session.userId,
      request.nextUrl.searchParams.get("orgId") ?? ""
    );
    const cacheKey = buildCacheKey({
      userId: auth.session.userId,
      orgId,
      pipelineId,
      status,
      chatScope,
      assigneeUserId,
      activityFrom,
      activityTo,
      cardLimit
    });

    if (!fresh) {
      const cached = crmBoardCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        return withServerTiming(
          NextResponse.json(cached.payload, { status: 200 }),
          startedAt,
          "HIT"
        );
      }
      const inflight = crmBoardInflight.get(cacheKey);
      if (inflight) {
        const payload = await inflight;
        return withServerTiming(NextResponse.json(payload, { status: 200 }), startedAt, "HIT");
      }
    }

    const requestPromise = (async (): Promise<CrmBoardResponsePayload> => {
      const board = await listCrmPipelineKanbanBoard({
        actorUserId: auth.session.userId,
        orgId,
        pipelineId,
        status,
        chatScope,
        assigneeUserId,
        activityFrom,
        activityTo,
        cardLimit
      });

      return {
        data: { board },
        meta: {}
      };
    })();

    if (!fresh) {
      crmBoardInflight.set(cacheKey, requestPromise);
    }

    try {
      const payload = await requestPromise;
      if (!fresh) {
        pruneCrmBoardCache();
        crmBoardCache.set(cacheKey, {
          expiresAt: Date.now() + CRM_BOARD_CACHE_TTL_MS,
          payload
        });
      }
      return withServerTiming(NextResponse.json(payload, { status: 200 }), startedAt, "MISS");
    } finally {
      if (!fresh) {
        crmBoardInflight.delete(cacheKey);
      }
    }
  } catch (error) {
    if (error instanceof ServiceError) {
      return withServerTiming(errorResponse(error.status, error.code, error.message), startedAt);
    }
    return withServerTiming(
      errorResponse(500, "CRM_PIPELINE_BOARD_FAILED", "Failed to load CRM pipeline board."),
      startedAt
    );
  }
}
