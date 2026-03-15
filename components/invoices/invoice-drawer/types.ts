import { InvoiceKind, type InvoiceStatus, PaymentMilestoneType } from "@prisma/client";

export type InvoiceItemDraft = {
  id: string;
  name: string;
  qty: number;
  priceCents: number;
  unit: string;
  description: string;
  discountType: "%" | "IDR";
  discountValue: number;
  taxLabel: string;
};

export type InvoiceSummary = {
  subtotalCents: number;
  lineDiscountCents: number;
  invoiceDiscountCents: number;
  taxCents: number;
  totalCents: number;
};

export type MilestoneDraft = {
  type: PaymentMilestoneType;
  amountCents: number;
  dueDate: string;
};

export type CreateInvoiceResponse = {
  data?: {
    invoice?: {
      id: string;
      invoiceNo: string;
      totalCents: number;
      status?: InvoiceStatus;
    };
  };
  error?: {
    message?: string;
  };
};

export type EditInvoiceResponse = {
  data?: {
    invoice?: {
      id: string;
      invoiceNo: string;
      totalCents: number;
      status?: InvoiceStatus;
    };
  };
  error?: {
    message?: string;
  };
};

export type SendInvoiceResponse = {
  data?: {
    invoice?: {
      id: string;
      invoiceNo: string;
      status: InvoiceStatus;
      publicLink: string;
    };
  };
  error?: {
    message?: string;
  };
};

export type MarkPaidResponse = {
  data?: {
    invoice?: {
      id: string;
      invoiceNo: string;
      status: InvoiceStatus;
    };
  };
  error?: {
    message?: string;
  };
};

export type InvoiceDrawerProps = {
  open: boolean;
  customerId: string | null;
  conversationId: string | null;
  orgId?: string | null;
  customerDisplayName?: string | null;
  customerPhoneE164?: string | null;
  onClose: () => void;
};

export function toRupiahLabel(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
  }).format(value);
}

export function createDefaultItems(): InvoiceItemDraft[] {
  return [
    {
      id: "item-1",
      name: "",
      qty: 1,
      priceCents: 0,
      unit: "",
      description: "",
      discountType: "%",
      discountValue: 0,
      taxLabel: ""
    }
  ];
}

export const INVOICE_TAX_OPTIONS = [
  { value: "", label: "Tanpa Pajak", ratePercent: 0 },
  { value: "PPN_11", label: "PPN 11%", ratePercent: 11 },
  { value: "PPN_12", label: "PPN 12%", ratePercent: 12 },
  { value: "PPH_21_25", label: "PPh 21 2.5%", ratePercent: 2.5 },
  { value: "PPH_21_3", label: "PPh 21 3%", ratePercent: 3 },
  { value: "PPH_23_4", label: "PPh 23 4%", ratePercent: 4 }
] as const;

export function getInvoiceTaxRate(label: string): number {
  return INVOICE_TAX_OPTIONS.find((option) => option.value === label)?.ratePercent ?? 0;
}

export function clampPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(100, value));
}

export function clampMoney(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.floor(value));
}

export function computeInvoiceLine(item: InvoiceItemDraft) {
  const qty = Math.max(0, Math.floor(item.qty || 0));
  const unitPriceCents = clampMoney(item.priceCents);
  const subtotalCents = qty * unitPriceCents;
  const discountCents =
    item.discountType === "%"
      ? Math.round((subtotalCents * clampPercent(item.discountValue)) / 100)
      : Math.min(subtotalCents, clampMoney(item.discountValue));
  const taxableBaseCents = Math.max(0, subtotalCents - discountCents);
  const taxCents = Math.round((taxableBaseCents * getInvoiceTaxRate(item.taxLabel)) / 100);

  return {
    qty,
    unitPriceCents,
    subtotalCents,
    discountCents,
    taxableBaseCents,
    taxCents,
    totalCents: taxableBaseCents + taxCents
  };
}

export function computeInvoiceSummary(
  items: InvoiceItemDraft[],
  invoiceDiscountType: "%" | "IDR",
  invoiceDiscountValue: number
): InvoiceSummary {
  const lineTotals = items.map(computeInvoiceLine);
  const subtotalCents = lineTotals.reduce((sum, line) => sum + line.subtotalCents, 0);
  const lineDiscountCents = lineTotals.reduce((sum, line) => sum + line.discountCents, 0);
  const taxCents = lineTotals.reduce((sum, line) => sum + line.taxCents, 0);
  const afterLineAdjustments = Math.max(0, subtotalCents - lineDiscountCents);
  const invoiceDiscountCents =
    invoiceDiscountType === "%"
      ? Math.round((afterLineAdjustments * clampPercent(invoiceDiscountValue)) / 100)
      : Math.min(afterLineAdjustments, clampMoney(invoiceDiscountValue));

  return {
    subtotalCents,
    lineDiscountCents,
    invoiceDiscountCents,
    taxCents,
    totalCents: Math.max(0, afterLineAdjustments - invoiceDiscountCents + taxCents)
  };
}

export function createDefaultMilestones(kind: InvoiceKind, totalCents: number, dpPercentage = 50): MilestoneDraft[] {
  if (kind === InvoiceKind.DP_AND_FINAL) {
    const normalizedDpPercentage = clampPercent(dpPercentage);
    const dpAmount = Math.round(totalCents * (normalizedDpPercentage / 100));
    return [
      { type: PaymentMilestoneType.DP, amountCents: dpAmount, dueDate: "" },
      { type: PaymentMilestoneType.FINAL, amountCents: totalCents - dpAmount, dueDate: "" }
    ];
  }

  return [{ type: PaymentMilestoneType.FULL, amountCents: totalCents, dueDate: "" }];
}

export function makeId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}
