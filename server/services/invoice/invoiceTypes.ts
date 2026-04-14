import type { InvoiceKind, InvoiceStatus, PaymentMilestoneType } from "@prisma/client";

export type InvoiceMilestoneInput = {
  type: PaymentMilestoneType;
  amountCents: number;
  dueDate?: Date;
};

export type CreateInvoiceItemInput = {
  name: string;
  qty: number;
  priceCents: number;
  unit?: string;
  description?: string;
  discountType?: "%" | "IDR";
  discountValue?: number;
  taxLabel?: string;
};

export type NormalizedInvoiceItem = {
  name: string;
  description: string | null;
  qty: number;
  unit: string | null;
  priceCents: number;
  subtotalCents: number;
  discountType: "%" | "IDR";
  discountValue: number;
  discountCents: number;
  taxLabel: string | null;
  taxRateBps: number;
  taxCents: number;
  amountCents: number;
};

export type InvoiceDiscountInput = {
  type: "%" | "IDR";
  value: number;
};

export type NormalizedMilestone = {
  type: PaymentMilestoneType;
  amountCents: number;
  dueDate: Date | null;
  status: "PENDING";
};

export type CreateDraftInvoiceInput = {
  actorUserId: string;
  orgId: string;
  customerId: string;
  conversationId?: string;
  customerDisplayNameSnapshot?: string;
  kind: InvoiceKind;
  currency?: string;
  notes?: string;
  terms?: string;
  items: CreateInvoiceItemInput[];
  invoiceDiscount?: InvoiceDiscountInput;
  milestones?: InvoiceMilestoneInput[];
  dueDate?: Date;
};

export type EditInvoiceItemsInput = {
  actorUserId: string;
  orgId: string;
  invoiceId: string;
  customerDisplayNameSnapshot?: string;
  notes?: string;
  terms?: string;
  items: CreateInvoiceItemInput[];
  invoiceDiscount?: InvoiceDiscountInput;
  milestones?: InvoiceMilestoneInput[];
};

export type InvoiceDraftResult = {
  id: string;
  invoiceNo: string;
  status: InvoiceStatus;
  subtotalCents: number;
  totalCents: number;
  currency: string;
  milestones: Array<{
    id: string;
    type: PaymentMilestoneType;
    amountCents: number;
    dueDate: Date | null;
    status: string;
  }>;
  createdAt: Date;
};

export type InvoiceItemsEditResult = {
  id: string;
  invoiceNo: string;
  subtotalCents: number;
  totalCents: number;
  milestones: Array<{
    id: string;
    type: PaymentMilestoneType;
    amountCents: number;
    dueDate: Date | null;
    status: string;
  }>;
  updatedAt: Date;
};

export type MarkInvoicePaidInput = {
  actorUserId: string;
  orgId: string;
  invoiceId: string;
  milestoneType?: PaymentMilestoneType;
};

export type MarkInvoicePaidResult = {
  id: string;
  invoiceNo: string;
  status: InvoiceStatus;
  milestones: Array<{
    id: string;
    type: PaymentMilestoneType;
    status: string;
    paidAt: Date | null;
  }>;
  updatedAt: Date;
};

export type SendInvoiceInput = {
  actorUserId: string;
  orgId: string;
  invoiceId: string;
};

export type SendInvoiceResult = {
  id: string;
  invoiceNo: string;
  status: InvoiceStatus;
  publicLink: string;
  updatedAt: Date;
};

export type InvoiceListItem = {
  id: string;
  customerId: string;
  publicToken: string;
  invoiceNo: string;
  status: InvoiceStatus;
  kind: InvoiceKind;
  totalCents: number;
  currency: string;
  customerName: string | null;
  customerPhoneE164: string;
  conversationId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type InvoiceListResult = {
  invoices: InvoiceListItem[];
  page: number;
  limit: number;
  total: number;
};

export type InvoiceTimelineEvent = {
  id: string;
  type:
    | "INVOICE_CREATED"
    | "INVOICE_SENT"
    | "PROOF_ATTACHED"
    | "PAYMENT_MARKED"
    | "INVOICE_COMPLETED";
  label: string;
  at: Date;
};

export type InvoiceTimelineResult = {
  invoiceId: string;
  invoiceNo: string;
  status: InvoiceStatus;
  events: InvoiceTimelineEvent[];
};

export type ListInvoicesInput = {
  actorUserId: string;
  orgId: string;
  page?: number;
  limit?: number;
  status?: InvoiceStatus;
  q?: string;
};

export type GetInvoiceTimelineInput = {
  actorUserId: string;
  orgId: string;
  invoiceId: string;
};
