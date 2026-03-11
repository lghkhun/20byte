import { type NextRequest, NextResponse } from "next/server";

import { requireApiSession } from "@/lib/auth/middleware";
import { getInvoiceTimeline } from "@/server/services/invoiceService";
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

  const orgId = request.nextUrl.searchParams.get("orgId")?.trim() ?? "";

  try {
    const timeline = await getInvoiceTimeline({
      actorUserId: auth.session.userId,
      orgId,
      invoiceId: context.params.invoiceId
    });

    return NextResponse.json(
      {
        data: {
          timeline
        },
        meta: {}
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.status, error.code, error.message);
    }

    return errorResponse(500, "INVOICE_TIMELINE_FAILED", "Failed to fetch invoice timeline.");
  }
}
