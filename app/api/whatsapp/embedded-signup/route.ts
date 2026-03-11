import type { NextRequest } from "next/server";

import { errorResponse, successResponse } from "@/lib/api/http";
import { requireApiSession } from "@/lib/auth/middleware";
import { ServiceError } from "@/server/services/serviceError";
import { completeEmbeddedSignup, getEmbeddedSignupContext } from "@/server/services/whatsappService";

type CompleteSignupRequest = {
  orgId?: unknown;
  metaBusinessId?: unknown;
  wabaId?: unknown;
  phoneNumberId?: unknown;
  displayPhone?: unknown;
  accessToken?: unknown;
};

export async function GET(request: NextRequest) {
  const auth = requireApiSession(request);
  if (auth.response) {
    return auth.response;
  }

  const orgId = request.nextUrl.searchParams.get("orgId")?.trim() ?? "";
  if (!orgId) {
    return errorResponse(400, "MISSING_ORG_ID", "orgId is required.");
  }

  try {
    const context = await getEmbeddedSignupContext(auth.session.userId, orgId);
    return successResponse(
      {
        embeddedSignup: context
      },
      200
    );
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.status, error.code, error.message);
    }

    return errorResponse(500, "WHATSAPP_EMBEDDED_CONTEXT_FAILED", "Failed to fetch embedded signup context.");
  }
}

export async function POST(request: NextRequest) {
  const auth = requireApiSession(request);
  if (auth.response) {
    return auth.response;
  }

  let body: CompleteSignupRequest;
  try {
    body = (await request.json()) as CompleteSignupRequest;
  } catch {
    return errorResponse(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  try {
    const account = await completeEmbeddedSignup({
      actorUserId: auth.session.userId,
      orgId: typeof body.orgId === "string" ? body.orgId : "",
      metaBusinessId: typeof body.metaBusinessId === "string" ? body.metaBusinessId : "",
      wabaId: typeof body.wabaId === "string" ? body.wabaId : "",
      phoneNumberId: typeof body.phoneNumberId === "string" ? body.phoneNumberId : "",
      displayPhone: typeof body.displayPhone === "string" ? body.displayPhone : "",
      accessToken: typeof body.accessToken === "string" ? body.accessToken : ""
    });

    return successResponse(
      {
        waAccount: account
      },
      200
    );
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.status, error.code, error.message);
    }

    return errorResponse(500, "WHATSAPP_EMBEDDED_CONNECT_FAILED", "Failed to complete WhatsApp connection.");
  }
}
