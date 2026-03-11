import { InvoiceKind, type InvoiceStatus, PaymentMilestoneType } from "@prisma/client";

export type InvoiceItemDraft = {
  id: string;
  name: string;
  qty: number;
  priceCents: number;
  unit: string;
  description: string;
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
  orgId: string | null;
  customerId: string | null;
  conversationId: string | null;
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
      description: ""
    }
  ];
}

export function createDefaultMilestones(kind: InvoiceKind, totalCents: number): MilestoneDraft[] {
  if (kind === InvoiceKind.DP_AND_FINAL) {
    const dpAmount = Math.floor(totalCents / 2);
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
