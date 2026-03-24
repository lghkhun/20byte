import type { NextRequest } from "next/server";

import { errorResponse, successResponse } from "@/lib/api/http";
import { getPakasirConfig } from "@/lib/env";
import { processPakasirWebhook } from "@/server/services/billingService";
import { ServiceError } from "@/server/services/serviceError";

export async function POST(request: NextRequest) {
  const webhookToken = getPakasirConfig().webhookToken;
  if (webhookToken) {
    const providedToken = request.headers.get("x-pakasir-token")?.trim() ?? "";
    if (!providedToken || providedToken !== webhookToken) {
      return errorResponse(401, "INVALID_WEBHOOK_TOKEN", "Invalid webhook token.");
    }
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return errorResponse(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  try {
    const result = await processPakasirWebhook(body);
    return successResponse(result, 200);
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.status, error.code, error.message);
    }

    return errorResponse(500, "PAKASIR_WEBHOOK_FAILED", "Failed to process webhook.");
  }
}
