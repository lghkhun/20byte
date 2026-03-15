import { InvoiceStatus, type Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { reserveNextInvoiceNumber } from "@/server/services/invoice/access";
import { generateAndUploadInvoicePdf } from "@/server/services/invoicePdfService";
import type {
  CreateDraftInvoiceInput,
  InvoiceDraftResult,
  NormalizedInvoiceItem,
  NormalizedMilestone
} from "@/server/services/invoice/invoiceTypes";
import {
  createPublicToken,
  isPrismaUniqueError,
  normalizeItems,
  normalizeMilestones,
  normalizeOptional
} from "@/server/services/invoice/invoiceUtils";
import { ServiceError } from "@/server/services/serviceError";

export async function loadDraftCustomerContext(params: {
  orgId: string;
  customerId: string;
  conversationId?: string;
}) {
  const customer = await prisma.customer.findFirst({
    where: {
      id: params.customerId,
      orgId: params.orgId
    },
    select: {
      id: true,
      displayName: true,
      phoneE164: true
    }
  });

  if (!customer) {
    throw new ServiceError(404, "CUSTOMER_NOT_FOUND", "Customer does not exist.");
  }

  if (params.conversationId) {
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: params.conversationId,
        orgId: params.orgId,
        customerId: params.customerId
      },
      select: {
        id: true
      }
    });

    if (!conversation) {
      throw new ServiceError(404, "CONVERSATION_NOT_FOUND", "Conversation does not exist for this customer.");
    }
  }

  return customer;
}

export function computeDraftInputDerived(input: CreateDraftInvoiceInput) {
  const normalizedItems = normalizeItems(input.items);
  const subtotalCents = normalizedItems.reduce((accumulator, item) => accumulator + item.amountCents, 0);
  const totalCents = subtotalCents;
  const normalizedMilestones = normalizeMilestones(input.kind, totalCents, input.milestones);

  return {
    normalizedItems,
    subtotalCents,
    totalCents,
    normalizedMilestones
  };
}

export async function listOrgBankAccounts(orgId: string) {
  return prisma.orgBankAccount.findMany({
    where: {
      orgId
    },
    orderBy: {
      createdAt: "asc"
    },
    take: 5,
    select: {
      bankName: true,
      accountNumber: true,
      accountHolder: true
    }
  });
}

export async function createDraftInvoiceWithRetry(params: {
  orgId: string;
  customerId: string;
  conversationId?: string;
  actorUserId: string;
  kind: CreateDraftInvoiceInput["kind"];
  currency: string;
  dueDate?: Date;
  bankAccounts: Array<{ bankName: string; accountNumber: string; accountHolder: string }>;
  normalizedItems: NormalizedInvoiceItem[];
  normalizedMilestones: NormalizedMilestone[];
  subtotalCents: number;
  totalCents: number;
}): Promise<InvoiceDraftResult> {
  let created: InvoiceDraftResult | null = null;
  let attempt = 0;

  while (attempt < 3 && !created) {
    attempt += 1;
    try {
      created = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const now = new Date();
        const invoiceNo = await reserveNextInvoiceNumber(tx, params.orgId, now);

        return tx.invoice.create({
          data: {
            orgId: params.orgId,
            customerId: params.customerId,
            conversationId: params.conversationId ?? null,
            invoiceNo,
            kind: params.kind,
            status: InvoiceStatus.DRAFT,
            currency: params.currency,
            subtotalCents: params.subtotalCents,
            totalCents: params.totalCents,
            dueDate: params.dueDate ?? null,
            publicToken: createPublicToken(),
            bankAccountsJson: JSON.stringify(params.bankAccounts),
            createdByUserId: params.actorUserId,
            items: {
              create: params.normalizedItems.map((item) => ({
                ...item,
                orgId: params.orgId
              }))
            },
            milestones: {
              create: params.normalizedMilestones.map((milestone) => ({
                ...milestone,
                orgId: params.orgId
              }))
            }
          },
          select: {
            id: true,
            invoiceNo: true,
            status: true,
            subtotalCents: true,
            totalCents: true,
            currency: true,
            milestones: {
              select: {
                id: true,
                type: true,
                amountCents: true,
                dueDate: true,
                status: true
              },
              orderBy: {
                type: "asc"
              }
            },
            createdAt: true
          }
        });
      });
    } catch (error) {
      if (isPrismaUniqueError(error) && attempt < 3) {
        continue;
      }

      throw error;
    }
  }

  if (!created) {
    throw new ServiceError(500, "INVOICE_NUMBER_RESERVATION_FAILED", "Failed to reserve unique invoice number.");
  }

  return created;
}

export async function generateDraftPdfAndPersist(params: {
  orgId: string;
  created: InvoiceDraftResult;
  customer: { displayName: string | null; phoneE164: string };
  currency: string;
  dueDate?: Date;
  normalizedItems: NormalizedInvoiceItem[];
  bankAccounts: Array<{ bankName: string; accountNumber: string; accountHolder: string }>;
}) {
  const pdfUrl = await generateAndUploadInvoicePdf({
    orgId: params.orgId,
    invoiceId: params.created.id,
    invoiceNo: params.created.invoiceNo,
    status: params.created.status,
    customerName: params.customer.displayName,
    customerPhoneE164: params.customer.phoneE164,
    currency: params.currency,
    subtotalCents: params.created.subtotalCents,
    totalCents: params.created.totalCents,
    dueDate: params.dueDate ?? null,
    items: params.normalizedItems,
    milestones: params.created.milestones,
    bankAccounts: params.bankAccounts
  });

  if (pdfUrl) {
    await prisma.invoice.updateMany({
      where: {
        id: params.created.id,
        orgId: params.orgId
      },
      data: {
        pdfUrl
      }
    });
  }

  return pdfUrl;
}

export function normalizeConversationId(value?: string) {
  return normalizeOptional(value);
}
