export type CrmInvoiceItem = {
  id: string;
  invoiceNo: string;
  status: string;
  kind: "FULL" | "DP_AND_FINAL";
  totalCents: number;
  currency: string;
  proofCount: number;
  createdAt: string;
};

export type CrmActivityItem = {
  id: string;
  type: "CONVERSATION_STARTED" | "INVOICE_CREATED" | "INVOICE_SENT" | "PROOF_ATTACHED" | "INVOICE_PAID";
  label: string;
  time: string;
};

export type CrmTimelineItem = {
  id: string;
  label: string;
  time: string | null;
};
