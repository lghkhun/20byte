import { type NextRequest, NextResponse } from "next/server";

import { requireApiSession } from "@/lib/auth/middleware";
import { sendInvoiceToCustomer } from "@/server/services/invoiceService";
import { ServiceError } from "@/server/services/serviceError";

type SendInvoiceRequest = {
  orgId?: unknown;
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
  context: {
    params: {
      invoiceId: string;
    };
  }
) {
  const auth = requireApiSession(request);
  if (auth.response) {
    return auth.response;
  }

  let body: SendInvoiceRequest;
  try {
    body = (await request.json()) as SendInvoiceRequest;
  } catch {
    return errorResponse(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  try {
    const invoice = await sendInvoiceToCustomer({
      actorUserId: auth.session.userId,
      orgId: typeof body.orgId === "string" ? body.orgId : "",
      invoiceId: context.params.invoiceId
    });

    return NextResponse.json(
      {
        data: {
          invoice
        },
        meta: {}
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.status, error.code, error.message);
    }

    return errorResponse(500, "INVOICE_SEND_FAILED", "Failed to send invoice.");
  }
}
