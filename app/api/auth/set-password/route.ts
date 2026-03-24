import type { NextRequest } from "next/server";

import { errorResponse, successResponse } from "@/lib/api/http";
import { setSessionCookie } from "@/lib/auth/session";
import { createSessionToken } from "@/lib/auth/session";
import { setPasswordFromSetupToken } from "@/server/services/accountSetupService";
import { ServiceError } from "@/server/services/serviceError";

type SetPasswordRequest = {
  token?: unknown;
  newPassword?: unknown;
};

export async function POST(request: NextRequest) {
  let body: SetPasswordRequest;
  try {
    body = (await request.json()) as SetPasswordRequest;
  } catch {
    return errorResponse(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const token = typeof body.token === "string" ? body.token : "";
  const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";

  try {
    const result = await setPasswordFromSetupToken({ token, newPassword });
    const response = successResponse(
      {
        user: result.user
      },
      200
    );

    const sessionToken = createSessionToken({
      userId: result.user.id,
      email: result.user.email,
      name: result.user.name
    });
    setSessionCookie(response, sessionToken);
    return response;
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.status, error.code, error.message);
    }

    return errorResponse(500, "SET_PASSWORD_FAILED", "Failed to set password.");
  }
}
