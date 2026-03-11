import { type NextRequest, NextResponse } from "next/server";

import { requireApiSession } from "@/lib/auth/middleware";
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

  const orgId = request.nextUrl.searchParams.get("orgId")?.trim() ?? "";
  const conversationId = request.nextUrl.searchParams.get("conversationId")?.trim() ?? "";
  const page = parseNumber(request.nextUrl.searchParams.get("page"), 1);
  const limit = parseNumber(request.nextUrl.searchParams.get("limit"), 30);

  try {
    const result = await listConversationMessages({
      actorUserId: auth.session.userId,
      orgId,
      conversationId,
      page,
      limit
    });

    return NextResponse.json(
      {
        data: {
          messages: result.messages
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

    return errorResponse(500, "MESSAGE_LIST_FAILED", "Failed to list conversation messages.");
  }
}
