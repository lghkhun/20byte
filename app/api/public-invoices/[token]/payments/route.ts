import { type NextRequest, NextResponse } from "next/server";

import { createPublicInvoicePaymentAttempt } from "@/server/services/invoiceGatewayService";
import { ServiceError } from "@/server/services/serviceError";

type CreatePaymentBody = {
  method?: unknown;
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

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  let body: CreatePaymentBody;
  try {
    body = (await request.json()) as CreatePaymentBody;
  } catch {
    return errorResponse(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const method = typeof body.method === "string" ? body.method : "";
  if (!method.trim()) {
    return errorResponse(400, "INVALID_PAYMENT_METHOD", "method is required.");
  }

  try {
    const token = (await context.params).token;
    const payment = await createPublicInvoicePaymentAttempt({
      publicToken: token,
      method
    });

    return NextResponse.json({ data: { payment }, meta: {} }, { status: 200 });
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.status, error.code, error.message);
    }

    return errorResponse(500, "PUBLIC_INVOICE_PAYMENT_CREATE_FAILED", "Failed to create invoice payment.");
  }
}
