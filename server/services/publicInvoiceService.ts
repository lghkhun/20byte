import type { InvoiceStatus } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";

type PublicInvoiceBankAccount = {
  bankName: string;
  accountNumber: string;
  accountHolder: string;
};

type PublicInvoiceItem = {
  id: string;
  name: string;
  description: string | null;
  qty: number;
  unit: string | null;
  priceCents: number;
  amountCents: number;
};

type PublicInvoiceMilestone = {
  id: string;
  type: string;
  amountCents: number;
  dueDate: Date | null;
  status: string;
};

type PublicInvoiceProof = {
  id: string;
  milestoneType: string | null;
  mediaUrl: string;
  mimeType: string | null;
  createdAt: Date;
};

export type PublicInvoiceDetail = {
  id: string;
  invoiceNo: string;
  status: InvoiceStatus;
  kind: string;
  currency: string;
  pdfUrl: string | null;
  subtotalCents: number;
  totalCents: number;
  dueDate: Date | null;
  createdAt: Date;
  orgName: string;
  customerName: string | null;
  customerPhoneE164: string;
  items: PublicInvoiceItem[];
  milestones: PublicInvoiceMilestone[];
  proofs: PublicInvoiceProof[];
  bankAccounts: PublicInvoiceBankAccount[];
};

function normalize(value: string): string {
  return value.trim();
}

function parseBankAccountsJson(raw: string): PublicInvoiceBankAccount[] {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    const rows: PublicInvoiceBankAccount[] = [];
    for (const row of parsed) {
      if (!row || typeof row !== "object") {
        continue;
      }

      const bankName = (row as { bankName?: unknown }).bankName;
      const accountNumber = (row as { accountNumber?: unknown }).accountNumber;
      const accountHolder = (row as { accountHolder?: unknown }).accountHolder;
      if (typeof bankName !== "string" || typeof accountNumber !== "string" || typeof accountHolder !== "string") {
        continue;
      }

      rows.push({
        bankName: bankName.trim(),
        accountNumber: accountNumber.trim(),
        accountHolder: accountHolder.trim()
      });
    }

    return rows;
  } catch {
    return [];
  }
}

export async function getPublicInvoiceByToken(publicTokenInput: string): Promise<PublicInvoiceDetail | null> {
  const publicToken = normalize(publicTokenInput);
  if (!publicToken) {
    return null;
  }

  const invoice = await prisma.invoice.findUnique({
    where: {
      publicToken
    },
    select: {
      id: true,
      invoiceNo: true,
      status: true,
      kind: true,
      currency: true,
      pdfUrl: true,
      subtotalCents: true,
      totalCents: true,
      dueDate: true,
      createdAt: true,
      bankAccountsJson: true,
      org: {
        select: {
          name: true
        }
      },
      customer: {
        select: {
          displayName: true,
          phoneE164: true
        }
      },
      items: {
        select: {
          id: true,
          name: true,
          description: true,
          qty: true,
          unit: true,
          priceCents: true,
          amountCents: true
        },
        orderBy: {
          id: "asc"
        }
      },
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
      proofs: {
        select: {
          id: true,
          milestoneType: true,
          mediaUrl: true,
          mimeType: true,
          createdAt: true
        },
        orderBy: {
          createdAt: "desc"
        }
      }
    }
  });

  if (!invoice) {
    return null;
  }

  return {
    id: invoice.id,
    invoiceNo: invoice.invoiceNo,
    status: invoice.status,
    kind: invoice.kind,
    currency: invoice.currency,
    pdfUrl: invoice.pdfUrl,
    subtotalCents: invoice.subtotalCents,
    totalCents: invoice.totalCents,
    dueDate: invoice.dueDate,
    createdAt: invoice.createdAt,
    orgName: invoice.org.name,
    customerName: invoice.customer.displayName,
    customerPhoneE164: invoice.customer.phoneE164,
    items: invoice.items,
    milestones: invoice.milestones,
    proofs: invoice.proofs,
    bankAccounts: parseBankAccountsJson(invoice.bankAccountsJson)
  };
}
