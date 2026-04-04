import { type NextRequest, NextResponse } from "next/server";

import { requireApiSession } from "@/lib/auth/middleware";
import { resolvePrimaryOrganizationIdForUser } from "@/server/services/organizationService";
import { listConversationMessages } from "@/server/services/messageService";
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

  const conversationId = request.nextUrl.searchParams.get("conversationId")?.trim() ?? "";
  const limit = parseNumber(request.nextUrl.searchParams.get("limit"), 30);
  const beforeMessageId = request.nextUrl.searchParams.get("beforeMessageId")?.trim() ?? "";

  try {
    const orgId = await resolvePrimaryOrganizationIdForUser(
      auth.session.userId,
      request.nextUrl.searchParams.get("orgId")?.trim() ?? ""
    );
    const result = await listConversationMessages({
      actorUserId: auth.session.userId,
      orgId,
      conversationId,
      beforeMessageId,
      limit
    });

    return NextResponse.json(
      {
        data: {
          messages: result.messages
        },
        meta: {
          limit: result.limit,
          hasMore: result.hasMore,
          nextBeforeMessageId: result.nextBeforeMessageId,
          total: result.total
        }
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.status, error.code, error.message);
    }

    return errorResponse(500, "MESSAGE_LIST_FAILED", "Failed to list conversation messages.");
  }
}
