import type { NextRequest } from "next/server";

import { errorResponse, successResponse } from "@/lib/api/http";
import { enforceAuthRateLimit } from "@/lib/auth/rateLimit";
import { requestPasswordReset } from "@/server/services/authService";
import { ServiceError } from "@/server/services/serviceError";

type ForgotPasswordRequest = {
  identifier?: unknown;
  email?: unknown;
};

export async function POST(request: NextRequest) {
  let body: ForgotPasswordRequest;
  try {
    body = (await request.json()) as ForgotPasswordRequest;
  } catch {
    return errorResponse(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const identifier =
    typeof body.identifier === "string"
      ? body.identifier
      : typeof body.email === "string"
        ? body.email
        : "";

  const rateLimitResponse = await enforceAuthRateLimit({
    request,
    scope: "forgot-password",
    identity: identifier
  });
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    await requestPasswordReset({ identifier });
    return successResponse(
      {
        accepted: true,
        message: "Jika akun ditemukan, link atur ulang password sudah dikirim ke email terdaftar."
      },
      200
    );
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.status, error.code, error.message);
    }

    return errorResponse(500, "FORGOT_PASSWORD_FAILED", "Failed to process forgot password request.");
  }
}
