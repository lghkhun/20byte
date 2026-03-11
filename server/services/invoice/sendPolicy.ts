import { InvoiceStatus } from "@prisma/client";

import { ServiceError } from "@/server/services/serviceError";

export function assertInvoiceSendable(status: InvoiceStatus): void {
  if (status === InvoiceStatus.VOID) {
    throw new ServiceError(400, "INVOICE_VOID", "Void invoice cannot be sent.");
  }

  if (status === InvoiceStatus.PAID || status === InvoiceStatus.PARTIALLY_PAID) {
    throw new ServiceError(400, "INVOICE_NOT_SENDABLE", "Paid invoice cannot be sent again.");
  }
}

export function buildAutomatedInvoiceText(publicLink: string): string {
  return `Here is your invoice: ${publicLink} [Automated]`;
}
