import { type NextRequest, NextResponse } from "next/server";
import { ConversationStatus } from "@prisma/client";

import { requireApiSession } from "@/lib/auth/middleware";
import { resolvePrimaryOrganizationIdForUser } from "@/server/services/organizationService";
import { createConversation, listConversations } from "@/server/services/conversationService";
import { ServiceError } from "@/server/services/serviceError";

type CreateConversationRequest = {
  orgId?: unknown;
  phoneE164?: unknown;
  customerDisplayName?: unknown;
};

type ConversationListFilter = "UNASSIGNED" | "MY" | "ALL";

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

function parseFilter(value: string | null): ConversationListFilter {
  if (!value) {
    return "UNASSIGNED";
  }

  const normalized = value.trim().toUpperCase();
  if (normalized === "MY" || normalized === "ALL" || normalized === "UNASSIGNED") {
    return normalized;
  }

  return "UNASSIGNED";
}

function parseStatus(value: string | null): ConversationStatus {
  if (!value) {
    return ConversationStatus.OPEN;
  }

  const normalized = value.trim().toUpperCase();
  return normalized === ConversationStatus.CLOSED ? ConversationStatus.CLOSED : ConversationStatus.OPEN;
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

export async function GET(request: NextRequest) {
  const startedAt = performance.now();
  const auth = requireApiSession(request);
  if (auth.response) {
    return withServerTiming(auth.response, startedAt);
  }

  const filter = parseFilter(request.nextUrl.searchParams.get("filter"));
  const status = parseStatus(request.nextUrl.searchParams.get("status"));
  const page = parseNumber(request.nextUrl.searchParams.get("page"), 1);
  const limit = parseNumber(request.nextUrl.searchParams.get("limit"), 20);
  const query = request.nextUrl.searchParams.get("query")?.trim() ?? "";

  try {
    const orgId = await resolvePrimaryOrganizationIdForUser(
      auth.session.userId,
      request.nextUrl.searchParams.get("orgId")?.trim() ?? ""
    );
    const result = await listConversations({
      actorUserId: auth.session.userId,
      orgId,
      filter,
      status,
      page,
      limit,
      query
    });
    return withServerTiming(
      NextResponse.json(
        {
          data: {
            conversations: result.conversations
          },
          meta: {
            page: result.page,
            limit: result.limit,
            total: result.total
          }
        },
        { status: 200 }
      ),
      startedAt
    );
  } catch (error) {
    if (error instanceof ServiceError) {
      if (error.code === "ORG_NOT_FOUND") {
        return withServerTiming(NextResponse.json(
          {
            data: {
              conversations: []
            },
            meta: {
              page,
              limit,
              total: 0
            }
          },
          { status: 200 }
        ), startedAt);
      }
      return withServerTiming(errorResponse(error.status, error.code, error.message), startedAt);
    }

    return withServerTiming(errorResponse(500, "CONVERSATION_LIST_FAILED", "Failed to list conversations."), startedAt);
  }
}

export async function POST(request: NextRequest) {
  const startedAt = performance.now();
  const auth = requireApiSession(request);
  if (auth.response) {
    return withServerTiming(auth.response, startedAt);
  }

  let body: CreateConversationRequest;
  try {
    body = (await request.json()) as CreateConversationRequest;
  } catch {
    return withServerTiming(errorResponse(400, "INVALID_JSON", "Request body must be valid JSON."), startedAt);
  }

  try {
    const orgId = await resolvePrimaryOrganizationIdForUser(
      auth.session.userId,
      typeof body.orgId === "string" ? body.orgId : ""
    );
    const conversation = await createConversation({
      actorUserId: auth.session.userId,
      orgId,
      phoneE164: typeof body.phoneE164 === "string" ? body.phoneE164 : "",
      customerDisplayName: typeof body.customerDisplayName === "string" ? body.customerDisplayName : undefined
    });

    return withServerTiming(NextResponse.json(
      {
        data: {
          conversation
        },
        meta: {}
      },
      { status: 201 }
    ), startedAt);
  } catch (error) {
    if (error instanceof ServiceError) {
      return withServerTiming(errorResponse(error.status, error.code, error.message), startedAt);
    }

    return withServerTiming(errorResponse(500, "CONVERSATION_CREATE_FAILED", "Failed to create conversation."), startedAt);
  }
}
