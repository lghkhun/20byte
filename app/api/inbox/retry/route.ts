import { type NextRequest, NextResponse } from "next/server";

import { requireApiSession } from "@/lib/auth/middleware";
import { resolvePrimaryOrganizationIdForUser } from "@/server/services/organizationService";
import { retryOutboundMessage } from "@/server/services/messageService";
import { ServiceError } from "@/server/services/serviceError";

type RetryRequest = {
  orgId?: unknown;
  messageId?: unknown;
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

export async function POST(request: NextRequest) {
  const auth = requireApiSession(request);
  if (auth.response) {
    return auth.response;
  }

  let body: RetryRequest;
  try {
    body = (await request.json()) as RetryRequest;
  } catch {
    return errorResponse(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  try {
    const orgId = await resolvePrimaryOrganizationIdForUser(
      auth.session.userId,
      typeof body.orgId === "string" ? body.orgId : ""
    );
    const result = await retryOutboundMessage({
      actorUserId: auth.session.userId,
      orgId,
      messageId: typeof body.messageId === "string" ? body.messageId : ""
    });

    return NextResponse.json(
      {
        data: {
          message: result
        },
        meta: {}
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.status, error.code, error.message);
    }

    return errorResponse(500, "RETRY_OUTBOUND_FAILED", "Failed to retry outbound message.");
  }
}
