import type { InvoiceStatus } from "@prisma/client";

export type OrgItem = {
  id: string;
  name: string;
};

export type InvoiceItem = {
  id: string;
  customerId: string;
  publicToken: string;
  invoiceNo: string;
  status: InvoiceStatus;
  kind: "FULL" | "DP_AND_FINAL";
  totalCents: number;
  currency: string;
  customerName: string | null;
  customerPhoneE164: string;
  conversationId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TimelineEvent = {
  id: string;
  type: "INVOICE_CREATED" | "INVOICE_SENT" | "PROOF_ATTACHED" | "PAYMENT_MARKED" | "INVOICE_COMPLETED";
  label: string;
  at: string;
};

export type InvoiceTimeline = {
  invoiceId: string;
  invoiceNo: string;
  status: InvoiceStatus;
  events: TimelineEvent[];
};

export type ApiError = {
  error?: {
    message?: string;
  };
};
