import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { requireInvoiceAccess } from "@/server/services/invoice/access";
import type { InvoiceListResult, ListInvoicesInput } from "@/server/services/invoice/invoiceTypes";
import { normalize, normalizeLimit, normalizePage } from "@/server/services/invoice/invoiceUtils";
import { ServiceError } from "@/server/services/serviceError";

export async function listInvoices(input: ListInvoicesInput): Promise<InvoiceListResult> {
  const orgId = normalize(input.orgId);
  if (!orgId) {
    throw new ServiceError(400, "MISSING_ORG_ID", "orgId is required.");
  }

  await requireInvoiceAccess(input.actorUserId, orgId);
  const page = normalizePage(input.page);
  const limit = normalizeLimit(input.limit);
  const query = normalize(input.q ?? "");

  const baseWhere: Prisma.InvoiceWhereInput = {
    orgId,
    ...(input.status ? { status: input.status } : {}),
    ...(query
      ? {
          OR: [
            { invoiceNo: { contains: query } },
            { publicToken: { contains: query } },
            { customer: { displayName: { contains: query } } },
            { customer: { phoneE164: { contains: query } } }
          ]
        }
      : {})
  };
  const runQuery = async (includeSnapshot: boolean) => {
    const where: Prisma.InvoiceWhereInput = {
      ...baseWhere,
      ...(query && includeSnapshot
        ? {
            OR: [
              ...(baseWhere.OR ?? []),
              { customerDisplayNameSnapshot: { contains: query } }
            ] as Prisma.InvoiceWhereInput[]
          }
        : {})
    };

    const [total, rows] = await prisma.$transaction([
      prisma.invoice.count({ where }),
      prisma.invoice.findMany({
        where,
        orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          customerId: true,
          ...(includeSnapshot ? { customerDisplayNameSnapshot: true } : {}),
          publicToken: true,
          invoiceNo: true,
          status: true,
          kind: true,
          totalCents: true,
          currency: true,
          conversationId: true,
          createdAt: true,
          updatedAt: true,
          customer: {
            select: {
              displayName: true,
              phoneE164: true
            }
          }
        }
      })
    ]);
    return { total, rows, includeSnapshot };
  };

  let result: Awaited<ReturnType<typeof runQuery>>;
  try {
    result = await runQuery(true);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const snapshotUnsupported =
      message.includes("Unknown field `customerDisplayNameSnapshot`") ||
      message.includes("Unknown argument `customerDisplayNameSnapshot`") ||
      message.includes("Unknown column 'customerDisplayNameSnapshot'");
    if (!snapshotUnsupported) {
      throw error;
    }
    result = await runQuery(false);
  }

  const { total, rows, includeSnapshot } = result;

  return {
    invoices: rows.map((row) => ({
      id: row.id,
      customerId: row.customerId,
      publicToken: row.publicToken,
      invoiceNo: row.invoiceNo,
      status: row.status,
      kind: row.kind,
      totalCents: row.totalCents,
      currency: row.currency,
      customerName:
        (includeSnapshot
          ? (row as { customerDisplayNameSnapshot?: string | null }).customerDisplayNameSnapshot
          : null) ?? row.customer.displayName,
      customerPhoneE164: row.customer.phoneE164,
      conversationId: row.conversationId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    })),
    page,
    limit,
    total
  };
}
