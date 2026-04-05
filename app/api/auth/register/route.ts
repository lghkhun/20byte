import type { NextRequest } from "next/server";

import { errorResponse, successResponse } from "@/lib/api/http";
import { enforceAuthRateLimit } from "@/lib/auth/rateLimit";
import { ServiceError } from "@/server/services/serviceError";
import { registerUser } from "@/server/services/authService";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const normalizedBody = (body ?? {}) as Record<string, unknown>;
  const identityRaw =
    typeof normalizedBody.email === "string"
      ? normalizedBody.email
      : typeof normalizedBody.phone === "string"
        ? normalizedBody.phone
        : "";
  const rateLimitResponse = await enforceAuthRateLimit({
    request,
    scope: "register",
    identity: identityRaw
  });
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const result = await registerUser(normalizedBody);
    return successResponse(
      {
        user: result.user,
        organization: result.organization
      },
      201
    );
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.status, error.code, error.message);
    }

    return errorResponse(500, "REGISTER_FAILED", "Failed to register user.");
  }
}
