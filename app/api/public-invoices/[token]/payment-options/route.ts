import { type NextRequest, NextResponse } from "next/server";

import { getPublicInvoicePaymentOptions } from "@/server/services/invoiceGatewayService";
import { ServiceError } from "@/server/services/serviceError";

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

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const token = (await context.params).token;
    const data = await getPublicInvoicePaymentOptions(token);
    return NextResponse.json({ data, meta: {} }, { status: 200 });
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.status, error.code, error.message);
    }

    return errorResponse(500, "PUBLIC_INVOICE_PAYMENT_OPTIONS_FAILED", "Failed to load payment options.");
  }
}
