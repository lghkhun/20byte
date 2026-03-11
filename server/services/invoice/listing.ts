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

  const where: Prisma.InvoiceWhereInput = {
    orgId,
    ...(input.status ? { status: input.status } : {})
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

  return {
    invoices: rows.map((row) => ({
      id: row.id,
      invoiceNo: row.invoiceNo,
      status: row.status,
      kind: row.kind,
      totalCents: row.totalCents,
      currency: row.currency,
      customerName: row.customer.displayName,
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
