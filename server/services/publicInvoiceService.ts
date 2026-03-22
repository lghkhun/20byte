import type { InvoiceStatus } from "@prisma/client";

import { getProxyAssetUrl, getPublicObjectKeyFromUrl } from "@/lib/r2/client";
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
  subtotalCents: number;
  discountType: string;
  discountValue: number;
  discountCents: number;
  taxLabel: string | null;
  taxRateBps: number;
  taxCents: number;
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
  grossSubtotalCents: number;
  lineDiscountCents: number;
  invoiceDiscountType: string;
  invoiceDiscountValue: number;
  invoiceDiscountCents: number;
  taxCents: number;
  totalCents: number;
  dueDate: Date | null;
  createdAt: Date;
  notes: string | null;
  terms: string | null;
  orgName: string;
  orgResponsibleName: string | null;
  orgBusinessNpwp: string | null;
  orgLogoUrl: string | null;
  orgSignatureUrl: string | null;
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

function normalizeAssetUrlForClient(value: string | null): string | null {
  const normalized = value?.trim() ?? "";
  if (!normalized) {
    return null;
  }
  const objectKey = getPublicObjectKeyFromUrl(normalized);
  if (!objectKey) {
    return normalized;
  }
  return getProxyAssetUrl(objectKey);
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

function isMissingInvoiceSelectFieldError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message;
  return (
    message.includes("Unknown field `notes` for select statement on model `Invoice`") ||
    message.includes("Unknown field `terms` for select statement on model `Invoice`")
  );
}

export async function getPublicInvoiceByToken(publicTokenInput: string): Promise<PublicInvoiceDetail | null> {
  const publicToken = normalize(publicTokenInput);
  if (!publicToken) {
    return null;
  }

  const baseSelect = {
    id: true,
    invoiceNo: true,
    status: true,
    kind: true,
    currency: true,
    pdfUrl: true,
    subtotalCents: true,
    grossSubtotalCents: true,
    lineDiscountCents: true,
    invoiceDiscountType: true,
    invoiceDiscountValue: true,
    invoiceDiscountCents: true,
    taxCents: true,
    totalCents: true,
    dueDate: true,
    createdAt: true,
    bankAccountsJson: true,
    org: {
      select: {
        name: true,
        responsibleName: true,
        businessNpwp: true,
        logoUrl: true,
        invoiceSignatureUrl: true
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
        subtotalCents: true,
        discountType: true,
        discountValue: true,
        discountCents: true,
        taxLabel: true,
        taxRateBps: true,
        taxCents: true,
        amountCents: true
      },
      orderBy: {
        id: "asc" as const
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
        type: "asc" as const
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
        createdAt: "desc" as const
      }
    }
  };

  let invoice: Record<string, unknown> | null = null;
  try {
    invoice = (await prisma.invoice.findUnique({
      where: {
        publicToken
      },
      select: {
        ...baseSelect,
        notes: true,
        terms: true
      }
    })) as unknown as Record<string, unknown> | null;
  } catch (error) {
    if (!isMissingInvoiceSelectFieldError(error)) {
      throw error;
    }

    invoice = (await prisma.invoice.findUnique({
      where: {
        publicToken
      },
      select: baseSelect
    })) as unknown as Record<string, unknown> | null;
  }

  if (!invoice) {
    return null;
  }

  return {
    id: invoice.id as string,
    invoiceNo: invoice.invoiceNo as string,
    status: invoice.status as InvoiceStatus,
    kind: invoice.kind as string,
    currency: invoice.currency as string,
    pdfUrl: normalizeAssetUrlForClient((invoice.pdfUrl as string | null) ?? null),
    subtotalCents: invoice.subtotalCents as number,
    grossSubtotalCents: invoice.grossSubtotalCents as number,
    lineDiscountCents: invoice.lineDiscountCents as number,
    invoiceDiscountType: invoice.invoiceDiscountType as string,
    invoiceDiscountValue: invoice.invoiceDiscountValue as number,
    invoiceDiscountCents: invoice.invoiceDiscountCents as number,
    taxCents: invoice.taxCents as number,
    totalCents: invoice.totalCents as number,
    dueDate: (invoice.dueDate as Date | null) ?? null,
    createdAt: invoice.createdAt as Date,
    notes: "notes" in invoice ? (invoice.notes as string | null) : null,
    terms: "terms" in invoice ? (invoice.terms as string | null) : null,
    orgName: (invoice.org as { name: string }).name,
    orgResponsibleName: (invoice.org as { responsibleName: string | null }).responsibleName,
    orgBusinessNpwp: (invoice.org as { businessNpwp: string | null }).businessNpwp,
    orgLogoUrl: normalizeAssetUrlForClient((invoice.org as { logoUrl: string | null }).logoUrl),
    orgSignatureUrl: normalizeAssetUrlForClient((invoice.org as { invoiceSignatureUrl: string | null }).invoiceSignatureUrl),
    customerName: (invoice.customer as { displayName: string | null }).displayName,
    customerPhoneE164: (invoice.customer as { phoneE164: string }).phoneE164,
    items: invoice.items as PublicInvoiceItem[],
    milestones: invoice.milestones as PublicInvoiceMilestone[],
    proofs: ((invoice.proofs as PublicInvoiceProof[]) ?? []).map((proof) => ({
      ...proof,
      mediaUrl: normalizeAssetUrlForClient(proof.mediaUrl) ?? proof.mediaUrl
    })),
    bankAccounts: parseBankAccountsJson(invoice.bankAccountsJson as string)
  };
}
