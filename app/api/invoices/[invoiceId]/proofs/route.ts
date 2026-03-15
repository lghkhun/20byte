import { PaymentMilestoneType } from "@prisma/client";
import { type NextRequest, NextResponse } from "next/server";

import { requireApiSession } from "@/lib/auth/middleware";
import { resolvePrimaryOrganizationIdForUser } from "@/server/services/organizationService";
import { attachPaymentProofFromMessage } from "@/server/services/paymentProofService";
import { ServiceError } from "@/server/services/serviceError";

type AttachProofRequest = {
  orgId?: unknown;
  messageId?: unknown;
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

  let body: AttachProofRequest;
  try {
    body = (await request.json()) as AttachProofRequest;
  } catch {
    return errorResponse(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  try {
    const orgId = await resolvePrimaryOrganizationIdForUser(
      auth.session.userId,
      typeof body.orgId === "string" ? body.orgId : ""
    );
    const proof = await attachPaymentProofFromMessage({
      actorUserId: auth.session.userId,
      orgId,
      invoiceId: context.params.invoiceId,
      messageId: typeof body.messageId === "string" ? body.messageId : "",
      milestoneType: parseMilestoneType(body.milestoneType)
    });

    return NextResponse.json(
      {
        data: {
          proof
        },
        meta: {}
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.status, error.code, error.message);
    }

    return errorResponse(500, "PROOF_ATTACH_FAILED", "Failed to attach payment proof.");
  }
}
