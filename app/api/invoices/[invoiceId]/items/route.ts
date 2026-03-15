import { PaymentMilestoneType } from "@prisma/client";
import { type NextRequest, NextResponse } from "next/server";

import { requireApiSession } from "@/lib/auth/middleware";
import { resolvePrimaryOrganizationIdForUser } from "@/server/services/organizationService";
import { editInvoiceItems, type CreateInvoiceItemInput, type InvoiceMilestoneInput } from "@/server/services/invoiceService";
import { ServiceError } from "@/server/services/serviceError";

type InvoiceItemInput = {
  name?: unknown;
  qty?: unknown;
  priceCents?: unknown;
  unit?: unknown;
  description?: unknown;
};

type MilestoneInput = {
  type?: unknown;
  amountCents?: unknown;
  dueDate?: unknown;
};

type EditInvoiceItemsRequest = {
  orgId?: unknown;
  items?: unknown;
  milestones?: unknown;
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

function parsePositiveNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null;
  }

  return Math.floor(value);
}

function parseDate(value: unknown): Date | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  return parsed;
}

function parseMilestoneType(value: unknown): PaymentMilestoneType | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toUpperCase();
  if (
    normalized === PaymentMilestoneType.FULL ||
    normalized === PaymentMilestoneType.DP ||
    normalized === PaymentMilestoneType.FINAL
  ) {
    return normalized;
  }

  return null;
}

function parseItems(value: unknown): CreateInvoiceItemInput[] | null {
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }

  const mapped = (value as InvoiceItemInput[]).map((item) => ({
    name: typeof item.name === "string" ? item.name : "",
    qty: parsePositiveNumber(item.qty) ?? 0,
    priceCents: parsePositiveNumber(item.priceCents) ?? 0,
    unit: typeof item.unit === "string" ? item.unit : undefined,
    description: typeof item.description === "string" ? item.description : undefined
  }));

  if (mapped.some((item) => !item.name.trim() || item.qty <= 0 || item.priceCents <= 0)) {
    return null;
  }

  return mapped;
}

function parseMilestones(value: unknown): InvoiceMilestoneInput[] | undefined | null {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }

  const mapped = (value as MilestoneInput[]).map((milestone) => ({
    type: parseMilestoneType(milestone.type),
    amountCents: parsePositiveNumber(milestone.amountCents),
    dueDate: parseDate(milestone.dueDate)
  }));

  if (mapped.some((milestone) => !milestone.type || !milestone.amountCents)) {
    return null;
  }

  return mapped as InvoiceMilestoneInput[];
}

export async function PATCH(
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

  let body: EditInvoiceItemsRequest;
  try {
    body = (await request.json()) as EditInvoiceItemsRequest;
  } catch {
    return errorResponse(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const items = parseItems(body.items);
  if (!items) {
    return errorResponse(400, "INVALID_INVOICE_ITEM", "Each item must include name, qty, and priceCents.");
  }

  const milestones = parseMilestones(body.milestones);
  if (milestones === null) {
    return errorResponse(400, "INVALID_MILESTONE", "Milestones must contain valid type and amountCents.");
  }

  try {
    const orgId = await resolvePrimaryOrganizationIdForUser(
      auth.session.userId,
      typeof body.orgId === "string" ? body.orgId : ""
    );
    const invoice = await editInvoiceItems({
      actorUserId: auth.session.userId,
      orgId,
      invoiceId: context.params.invoiceId,
      items,
      milestones
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

    return errorResponse(500, "INVOICE_ITEM_EDIT_FAILED", "Failed to edit invoice items.");
  }
}
