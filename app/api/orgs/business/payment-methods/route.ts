import { type NextRequest, NextResponse } from "next/server";

import { requireApiSession } from "@/lib/auth/middleware";
import {
  getOrgInvoicePaymentSettings,
  updateOrgInvoicePaymentSettings
} from "@/server/services/invoiceGatewayService";
import { resolvePrimaryOrganizationIdForUser } from "@/server/services/organizationService";
import { ServiceError } from "@/server/services/serviceError";

type UpdatePaymentMethodRequest = {
  orgId?: unknown;
  enableBankTransfer?: unknown;
  enableQris?: unknown;
  enabledVaMethods?: unknown;
  feePolicy?: unknown;
  autoConfirmLabelEnabled?: unknown;
  paymentMethodsOrder?: unknown;
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

export async function GET(request: NextRequest) {
  const auth = requireApiSession(request);
  if (auth.response) {
    return auth.response;
  }

  try {
    const orgId = await resolvePrimaryOrganizationIdForUser(
      auth.session.userId,
      request.nextUrl.searchParams.get("orgId")?.trim() ?? ""
    );

    const settings = await getOrgInvoicePaymentSettings(orgId);
    return NextResponse.json({ data: { settings }, meta: {} }, { status: 200 });
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.status, error.code, error.message);
    }

    return errorResponse(500, "ORG_PAYMENT_METHOD_SETTINGS_FAILED", "Failed to load payment method settings.");
  }
}

export async function PATCH(request: NextRequest) {
  const auth = requireApiSession(request);
  if (auth.response) {
    return auth.response;
  }

  let body: UpdatePaymentMethodRequest;
  try {
    body = (await request.json()) as UpdatePaymentMethodRequest;
  } catch {
    return errorResponse(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  try {
    const settings = await updateOrgInvoicePaymentSettings({
      actorUserId: auth.session.userId,
      orgId: typeof body.orgId === "string" ? body.orgId : undefined,
      enableBankTransfer: typeof body.enableBankTransfer === "boolean" ? body.enableBankTransfer : undefined,
      enableQris: typeof body.enableQris === "boolean" ? body.enableQris : undefined,
      enabledVaMethods: Array.isArray(body.enabledVaMethods)
        ? body.enabledVaMethods.filter((item): item is string => typeof item === "string")
        : undefined,
      feePolicy: typeof body.feePolicy === "string" ? body.feePolicy : undefined,
      autoConfirmLabelEnabled:
        typeof body.autoConfirmLabelEnabled === "boolean" ? body.autoConfirmLabelEnabled : undefined,
      paymentMethodsOrder: Array.isArray(body.paymentMethodsOrder)
        ? body.paymentMethodsOrder.filter((item): item is string => typeof item === "string")
        : undefined
    });

    return NextResponse.json({ data: { settings }, meta: {} }, { status: 200 });
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.status, error.code, error.message);
    }

    return errorResponse(500, "ORG_PAYMENT_METHOD_SETTINGS_UPDATE_FAILED", "Failed to update payment method settings.");
  }
}
