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

export async function GET(request: NextRequest) {
  const auth = requireApiSession(request);
  if (auth.response) {
    return auth.response;
  }

  const filter = parseFilter(request.nextUrl.searchParams.get("filter"));
  const status = parseStatus(request.nextUrl.searchParams.get("status"));
  const page = parseNumber(request.nextUrl.searchParams.get("page"), 1);
  const limit = parseNumber(request.nextUrl.searchParams.get("limit"), 20);

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
      limit
    });

    return NextResponse.json(
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
    );
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.status, error.code, error.message);
    }

    return errorResponse(500, "CONVERSATION_LIST_FAILED", "Failed to list conversations.");
  }
}

export async function POST(request: NextRequest) {
  const auth = requireApiSession(request);
  if (auth.response) {
    return auth.response;
  }

  let body: CreateConversationRequest;
  try {
    body = (await request.json()) as CreateConversationRequest;
  } catch {
    return errorResponse(400, "INVALID_JSON", "Request body must be valid JSON.");
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

    return NextResponse.json(
      {
        data: {
          conversation
        },
        meta: {}
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.status, error.code, error.message);
    }

    return errorResponse(500, "CONVERSATION_CREATE_FAILED", "Failed to create conversation.");
  }
}
