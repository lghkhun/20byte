import { InvoiceKind, InvoiceStatus, PaymentMilestoneType } from "@prisma/client";
import { type NextRequest, NextResponse } from "next/server";

import { requireApiSession } from "@/lib/auth/middleware";
import { resolvePrimaryOrganizationIdForUser } from "@/server/services/organizationService";
import { createDraftInvoice, listInvoices } from "@/server/services/invoiceService";
import { ServiceError } from "@/server/services/serviceError";

type InvoiceItemInput = {
  name?: unknown;
  qty?: unknown;
  priceCents?: unknown;
  unit?: unknown;
  description?: unknown;
  discountType?: unknown;
  discountValue?: unknown;
  taxLabel?: unknown;
};

type MilestoneInput = {
  type?: unknown;
  amountCents?: unknown;
  dueDate?: unknown;
};

type CreateInvoiceRequest = {
  orgId?: unknown;
  customerId?: unknown;
  conversationId?: unknown;
  kind?: unknown;
  currency?: unknown;
  notes?: unknown;
  terms?: unknown;
  dueDate?: unknown;
  items?: unknown;
  invoiceDiscountType?: unknown;
  invoiceDiscountValue?: unknown;
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

function parseInvoiceKind(value: unknown): InvoiceKind | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toUpperCase();
  if (normalized === InvoiceKind.FULL || normalized === InvoiceKind.DP_AND_FINAL) {
    return normalized;
  }

  return null;
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

function parseDiscountType(value: unknown): "%" | "IDR" | undefined {
  if (value === "%") {
    return "%";
  }
  if (value === "IDR") {
    return "IDR";
  }
  return undefined;
}

function parsePositiveNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null;
  }

  return value;
}

function parseNonNegativeNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return null;
  }

  return value;
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

function parseItems(value: unknown): InvoiceItemInput[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  return value as InvoiceItemInput[];
}

function parseMilestones(value: unknown): MilestoneInput[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    return [];
  }

  return value as MilestoneInput[];
}

export async function POST(request: NextRequest) {
  const auth = requireApiSession(request);
  if (auth.response) {
    return auth.response;
  }

  let body: CreateInvoiceRequest;
  try {
    body = (await request.json()) as CreateInvoiceRequest;
  } catch {
    return errorResponse(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const kind = parseInvoiceKind(body.kind);
  if (!kind) {
    return errorResponse(400, "INVALID_INVOICE_KIND", "kind must be FULL or DP_AND_FINAL.");
  }

  const itemsInput = parseItems(body.items);
  if (!itemsInput || itemsInput.length === 0) {
    return errorResponse(400, "INVOICE_ITEMS_REQUIRED", "At least one invoice item is required.");
  }

  const milestonesInput = parseMilestones(body.milestones);
  if (milestonesInput && milestonesInput.length === 0 && body.milestones !== undefined) {
    return errorResponse(400, "INVALID_MILESTONES", "milestones must be a non-empty array when provided.");
  }

  const normalizedItems = itemsInput.map((item) => ({
    name: typeof item.name === "string" ? item.name : "",
    qty: parsePositiveNumber(item.qty),
    priceCents: parsePositiveNumber(item.priceCents),
    unit: typeof item.unit === "string" ? item.unit : undefined,
    description: typeof item.description === "string" ? item.description : undefined,
    discountType: parseDiscountType(item.discountType),
    discountValue: parseNonNegativeNumber(item.discountValue) ?? undefined,
    taxLabel: typeof item.taxLabel === "string" ? item.taxLabel : undefined
  }));

  if (normalizedItems.some((item) => !item.name.trim() || !item.qty || !item.priceCents)) {
    return errorResponse(400, "INVALID_INVOICE_ITEM", "Each item must include name, qty, and priceCents.");
  }

  const normalizedMilestones =
    milestonesInput?.map((milestone) => ({
      type: parseMilestoneType(milestone.type),
      amountCents: parsePositiveNumber(milestone.amountCents),
      dueDate: parseDate(milestone.dueDate)
    })) ?? undefined;

  if (normalizedMilestones && normalizedMilestones.some((milestone) => !milestone.type || !milestone.amountCents)) {
    return errorResponse(400, "INVALID_MILESTONE", "Each milestone must include valid type and amountCents.");
  }

  try {
    const orgId = await resolvePrimaryOrganizationIdForUser(
      auth.session.userId,
      typeof body.orgId === "string" ? body.orgId : ""
    );
    const created = await createDraftInvoice({
      actorUserId: auth.session.userId,
      orgId,
      customerId: typeof body.customerId === "string" ? body.customerId : "",
      conversationId: typeof body.conversationId === "string" ? body.conversationId : undefined,
      kind,
      currency: typeof body.currency === "string" ? body.currency : undefined,
      notes: typeof body.notes === "string" ? body.notes : undefined,
      terms: typeof body.terms === "string" ? body.terms : undefined,
      dueDate: parseDate(body.dueDate),
      items: normalizedItems as Array<{
        name: string;
        qty: number;
        priceCents: number;
        unit?: string;
        description?: string;
        discountType?: "%" | "IDR";
        discountValue?: number;
        taxLabel?: string;
      }>,
      invoiceDiscount: {
        type: body.invoiceDiscountType === "IDR" ? "IDR" : "%",
        value: parseNonNegativeNumber(body.invoiceDiscountValue) ?? 0
      },
      milestones: normalizedMilestones as
        | Array<{
            type: PaymentMilestoneType;
            amountCents: number;
            dueDate?: Date;
          }>
        | undefined
    });

    return NextResponse.json(
      {
        data: {
          invoice: created
        },
        meta: {}
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.status, error.code, error.message);
    }

    console.error("[api/invoices][POST] unexpected error", error);
    const fallbackMessage =
      process.env.NODE_ENV !== "production" && error instanceof Error && error.message
        ? `Failed to create invoice: ${error.message}`
        : "Failed to create invoice.";
    return errorResponse(500, "INVOICE_CREATE_FAILED", fallbackMessage);
  }
}

function parseNumber(value: string | null, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return parsed;
}

export async function GET(request: NextRequest) {
  const auth = requireApiSession(request);
  if (auth.response) {
    return auth.response;
  }

  const page = parseNumber(request.nextUrl.searchParams.get("page"), 1);
  const limit = parseNumber(request.nextUrl.searchParams.get("limit"), 20);
  const statusValue = request.nextUrl.searchParams.get("status")?.trim().toUpperCase() ?? "";
  const status = Object.values(InvoiceStatus).includes(statusValue as InvoiceStatus)
    ? (statusValue as InvoiceStatus)
    : undefined;
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";

  try {
    const orgId = await resolvePrimaryOrganizationIdForUser(
      auth.session.userId,
      request.nextUrl.searchParams.get("orgId")?.trim() ?? ""
    );
    const result = await listInvoices({
      actorUserId: auth.session.userId,
      orgId,
      page,
      limit,
      status,
      q
    });

    return NextResponse.json(
      {
        data: {
          invoices: result.invoices
        },
        meta: {
          page: result.page,
          limit: result.limit,
          total: result.total
        }
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.status, error.code, error.message);
    }

    return errorResponse(500, "INVOICE_LIST_FAILED", "Failed to list invoices.");
  }
}
