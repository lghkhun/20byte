import { type NextRequest, NextResponse } from "next/server";

import { requireApiSession } from "@/lib/auth/middleware";
import { resolvePrimaryOrganizationIdForUser } from "@/server/services/organizationService";
import { sendInvoiceToCustomer } from "@/server/services/invoiceService";
import { ServiceError } from "@/server/services/serviceError";

type SendInvoiceRequest = {
  orgId?: unknown;
};

async function parseOptionalJsonBody<T>(request: NextRequest): Promise<T> {
  const contentLength = request.headers.get("content-length");
  if (contentLength === "0") {
    return {} as T;
  }

  const rawBody = await request.text();
  if (!rawBody.trim()) {
    return {} as T;
  }

  return JSON.parse(rawBody) as T;
}

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
  context: { params: Promise<{invoiceId: string;}> }
) {
  const auth = requireApiSession(request);
  if (auth.response) {
    return auth.response;
  }

  let body: SendInvoiceRequest;
  try {
    body = await parseOptionalJsonBody<SendInvoiceRequest>(request);
  } catch {
    return errorResponse(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  try {
    const orgId = await resolvePrimaryOrganizationIdForUser(
      auth.session.userId,
      typeof body.orgId === "string" ? body.orgId : ""
    );
    const invoice = await sendInvoiceToCustomer({
      actorUserId: auth.session.userId,
      orgId,
      invoiceId: (await context.params).invoiceId
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
