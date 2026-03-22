import { type NextRequest, NextResponse } from "next/server";

import { requireApiSession } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { requireInvoiceAccess } from "@/server/services/invoice/access";
import { deleteDraftInvoice } from "@/server/services/invoiceService";
import { resolvePrimaryOrganizationIdForUser } from "@/server/services/organizationService";
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

function parseBankAccountsJson(raw: string): Array<{ bankName: string; accountNumber: string; accountHolder: string }> {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((row) => {
        if (!row || typeof row !== "object") {
          return null;
        }

        const bankName = (row as { bankName?: unknown }).bankName;
        const accountNumber = (row as { accountNumber?: unknown }).accountNumber;
        const accountHolder = (row as { accountHolder?: unknown }).accountHolder;
        if (typeof bankName !== "string" || typeof accountNumber !== "string" || typeof accountHolder !== "string") {
          return null;
        }

        return {
          bankName: bankName.trim(),
          accountNumber: accountNumber.trim(),
          accountHolder: accountHolder.trim()
        };
      })
      .filter((row): row is { bankName: string; accountNumber: string; accountHolder: string } => row !== null);
  } catch {
    return [];
  }
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

  try {
    const orgId = await resolvePrimaryOrganizationIdForUser(
      auth.session.userId,
      request.nextUrl.searchParams.get("orgId")?.trim() ?? ""
    );
    await requireInvoiceAccess(auth.session.userId, orgId);

    const invoice = await prisma.invoice.findFirst({
      where: {
        id: context.params.invoiceId,
        orgId
      },
      select: {
        id: true,
        invoiceNo: true,
        publicToken: true,
        status: true,
        kind: true,
        currency: true,
        subtotalCents: true,
        grossSubtotalCents: true,
        lineDiscountCents: true,
        invoiceDiscountType: true,
        invoiceDiscountValue: true,
        invoiceDiscountCents: true,
        taxCents: true,
        totalCents: true,
        dueDate: true,
        notes: true,
        terms: true,
        createdAt: true,
        updatedAt: true,
        conversationId: true,
        customerId: true,
        bankAccountsJson: true,
        customer: {
          select: {
            displayName: true,
            phoneE164: true
          }
        },
        items: {
          orderBy: {
            id: "asc"
          },
          select: {
            id: true,
            name: true,
            description: true,
            qty: true,
            unit: true,
            priceCents: true,
            subtotalCents: true,
            discountType: true,
            discountValue: true,
            discountCents: true,
            taxLabel: true,
            taxRateBps: true,
            taxCents: true,
            amountCents: true
          }
        },
        milestones: {
          orderBy: {
            type: "asc"
          },
          select: {
            id: true,
            type: true,
            amountCents: true,
            dueDate: true,
            status: true,
            paidAt: true
          }
        }
      }
    });

    if (!invoice) {
      return errorResponse(404, "INVOICE_NOT_FOUND", "Invoice does not exist.");
    }

    return NextResponse.json(
      {
        data: {
          invoice: {
            ...invoice,
            customerName: invoice.customer.displayName,
            customerPhoneE164: invoice.customer.phoneE164,
            bankAccounts: parseBankAccountsJson(invoice.bankAccountsJson)
          }
        },
        meta: {}
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.status, error.code, error.message);
    }

    return errorResponse(500, "INVOICE_FETCH_FAILED", "Failed to fetch invoice.");
  }
}

export async function DELETE(
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

  try {
    const orgId = await resolvePrimaryOrganizationIdForUser(
      auth.session.userId,
      request.nextUrl.searchParams.get("orgId")?.trim() ?? ""
    );
    const deleted = await deleteDraftInvoice({
      actorUserId: auth.session.userId,
      orgId,
      invoiceId: context.params.invoiceId
    });

    return NextResponse.json(
      {
        data: {
          deleted
        },
        meta: {}
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.status, error.code, error.message);
    }

    return errorResponse(500, "INVOICE_DELETE_FAILED", "Failed to delete invoice.");
  }
}
