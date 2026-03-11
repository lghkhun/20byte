import type { NextRequest } from "next/server";

import { errorResponse, successResponse } from "@/lib/api/http";
import { ServiceError } from "@/server/services/serviceError";
import { registerUser } from "@/server/services/authService";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  try {
    const result = await registerUser((body ?? {}) as Record<string, unknown>);
    return successResponse(
      {
        user: result.user
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
