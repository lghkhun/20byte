import type { NextRequest } from "next/server";

import { requireApiSession } from "@/lib/auth/middleware";
import { errorResponse, successResponse } from "@/lib/api/http";
import { normalizeWhatsAppDestination } from "@/lib/whatsapp/e164";
import { getPrimaryOrganizationForUser } from "@/server/services/organizationService";
import { sendBaileysTestMessage } from "@/server/services/baileysService";
import { ServiceError } from "@/server/services/serviceError";

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
    const primaryOrganization = await getPrimaryOrganizationForUser(auth.session.userId);
    const orgId = typeof body.orgId === "string" && body.orgId.trim() ? body.orgId : primaryOrganization?.id ?? "";
    const result = await sendBaileysTestMessage({
      actorUserId: auth.session.userId,
      orgId,
      toPhoneE164: normalizeWhatsAppDestination(typeof body.toPhoneE164 === "string" ? body.toPhoneE164 : "") ?? ""
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
