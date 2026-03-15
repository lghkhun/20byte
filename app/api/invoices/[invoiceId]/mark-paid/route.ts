import { PaymentMilestoneType } from "@prisma/client";
import { type NextRequest, NextResponse } from "next/server";

import { requireApiSession } from "@/lib/auth/middleware";
import { resolvePrimaryOrganizationIdForUser } from "@/server/services/organizationService";
import { markInvoicePaid } from "@/server/services/invoiceService";
import { ServiceError } from "@/server/services/serviceError";

type MarkPaidRequest = {
  orgId?: unknown;
  milestoneType?: unknown;
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

function parseMilestoneType(value: unknown): PaymentMilestoneType | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim().toUpperCase();
  if (normalized === PaymentMilestoneType.FULL) {
    return PaymentMilestoneType.FULL;
  }

  if (normalized === PaymentMilestoneType.DP) {
    return PaymentMilestoneType.DP;
  }

  if (normalized === PaymentMilestoneType.FINAL) {
    return PaymentMilestoneType.FINAL;
  }

  return undefined;
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

  let body: MarkPaidRequest;
  try {
    body = (await request.json()) as MarkPaidRequest;
  } catch {
    return errorResponse(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  try {
    const orgId = await resolvePrimaryOrganizationIdForUser(
      auth.session.userId,
      typeof body.orgId === "string" ? body.orgId : ""
    );
    const invoice = await markInvoicePaid({
      actorUserId: auth.session.userId,
      orgId,
      invoiceId: context.params.invoiceId,
      milestoneType: parseMilestoneType(body.milestoneType)
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

    return errorResponse(500, "INVOICE_MARK_PAID_FAILED", "Failed to mark invoice paid.");
  }
}
