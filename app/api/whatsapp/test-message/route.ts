import type { NextRequest } from "next/server";

import { requireApiSession } from "@/lib/auth/middleware";
import { errorResponse, successResponse } from "@/lib/api/http";
import { ServiceError } from "@/server/services/serviceError";
import { sendOnboardingTestMessage } from "@/server/services/whatsappService";

type TestMessageRequest = {
  orgId?: unknown;
  toPhoneE164?: unknown;
};

export async function POST(request: NextRequest) {
  const auth = requireApiSession(request);
  if (auth.response) {
    return auth.response;
  }

  let body: TestMessageRequest;
  try {
    body = (await request.json()) as TestMessageRequest;
  } catch {
    return errorResponse(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  try {
    const result = await sendOnboardingTestMessage({
      actorUserId: auth.session.userId,
      orgId: typeof body.orgId === "string" ? body.orgId : "",
      toPhoneE164: typeof body.toPhoneE164 === "string" ? body.toPhoneE164 : ""
    });

    return successResponse(
      {
        verification: result
      },
      200
    );
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.status, error.code, error.message);
    }

    return errorResponse(500, "WHATSAPP_TEST_MESSAGE_FAILED", "Failed to send test message.");
  }
}
