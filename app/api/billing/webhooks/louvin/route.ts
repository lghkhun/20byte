import type { NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";

import { errorResponse, successResponse } from "@/lib/api/http";
import { getLouvinConfig } from "@/lib/env";
import { processPakasirWebhook } from "@/server/services/billingService";
import {
  processInvoicePakasirWebhook,
  processTopupPakasirWebhook
} from "@/server/services/invoiceGatewayService";
import { ServiceError } from "@/server/services/serviceError";

function hasSameToken(expected: string, provided: string): boolean {
  const expectedBuffer = Buffer.from(expected, "utf8");
  const providedBuffer = Buffer.from(provided, "utf8");
  if (expectedBuffer.length !== providedBuffer.length) {
    return false;
  }
  return timingSafeEqual(expectedBuffer, providedBuffer);
}

export async function POST(request: NextRequest) {
  const webhookToken = getLouvinConfig().webhookToken;
  if (webhookToken) {
    const providedToken = request.headers.get("x-louvin-token")?.trim() ?? "";
    if (!providedToken || !hasSameToken(webhookToken, providedToken)) {
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
    const data = (body.data && typeof body.data === "object" ? body.data : body) as Record<string, unknown>;
    const orderId = typeof data.order_id === "string" ? data.order_id.trim() : "";
    const normalized = {
      order_id: orderId,
      amount: data.amount,
      status: data.status
    };

    let result: unknown;
    if (orderId.startsWith("INVPAY-")) {
      result = await processInvoicePakasirWebhook(normalized);
    } else if (orderId.startsWith("TOPUP-")) {
      result = await processTopupPakasirWebhook(normalized);
    } else {
      result = await processPakasirWebhook(normalized);
    }
    return successResponse(result, 200);
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.status, error.code, error.message);
    }

    return errorResponse(500, "LOUVIN_WEBHOOK_FAILED", "Failed to process webhook.");
  }
}
