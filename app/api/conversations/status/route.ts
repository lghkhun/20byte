import { ConversationStatus } from "@prisma/client";
import { type NextRequest, NextResponse } from "next/server";

import { requireApiSession } from "@/lib/auth/middleware";
import { updateConversationStatus } from "@/server/services/conversationService";
import { ServiceError } from "@/server/services/serviceError";

type UpdateConversationStatusRequest = {
  orgId?: unknown;
  conversationId?: unknown;
  status?: unknown;
};

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

function parseConversationStatus(value: unknown): ConversationStatus | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toUpperCase();
  if (normalized === ConversationStatus.OPEN || normalized === ConversationStatus.CLOSED) {
    return normalized;
  }

  return null;
}

export async function POST(request: NextRequest) {
  const auth = requireApiSession(request);
  if (auth.response) {
    return auth.response;
  }

  let body: UpdateConversationStatusRequest;
  try {
    body = (await request.json()) as UpdateConversationStatusRequest;
  } catch {
    return errorResponse(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const status = parseConversationStatus(body.status);
  if (!status) {
    return errorResponse(400, "INVALID_CONVERSATION_STATUS", "status must be OPEN or CLOSED.");
  }

  try {
    const conversation = await updateConversationStatus({
      actorUserId: auth.session.userId,
      orgId: typeof body.orgId === "string" ? body.orgId : "",
      conversationId: typeof body.conversationId === "string" ? body.conversationId : "",
      status
    });

    return NextResponse.json(
      {
        data: {
          conversation
        },
        meta: {}
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.status, error.code, error.message);
    }

    return errorResponse(500, "CONVERSATION_STATUS_UPDATE_FAILED", "Failed to update conversation status.");
  }
}
