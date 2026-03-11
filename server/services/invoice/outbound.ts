import { InvoiceStatus } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { publishInvoiceUpdatedEvent } from "@/lib/ably/publisher";
import { writeAuditLogSafe } from "@/server/services/auditLogService";
import { requireInvoiceAccess } from "@/server/services/invoice/access";
import type { SendInvoiceInput, SendInvoiceResult } from "@/server/services/invoice/invoiceTypes";
import { assertInvoiceSendable, buildAutomatedInvoiceText } from "@/server/services/invoice/sendPolicy";
import { buildPublicInvoiceUrl, normalize } from "@/server/services/invoice/invoiceUtils";
import { sendOutboundMessage } from "@/server/services/messageService";
import { ServiceError } from "@/server/services/serviceError";

export async function sendInvoiceToCustomer(input: SendInvoiceInput): Promise<SendInvoiceResult> {
  const orgId = normalize(input.orgId);
  const invoiceId = normalize(input.invoiceId);
  if (!orgId) {
    throw new ServiceError(400, "MISSING_ORG_ID", "orgId is required.");
  }

  if (!invoiceId) {
    throw new ServiceError(400, "MISSING_INVOICE_ID", "invoiceId is required.");
  }

  await requireInvoiceAccess(input.actorUserId, orgId);

  const invoice = await prisma.invoice.findFirst({
    where: {
      id: invoiceId,
      orgId
    },
    select: {
      id: true,
      invoiceNo: true,
      status: true,
      publicToken: true,
      conversationId: true
    }
  });

  if (!invoice) {
    throw new ServiceError(404, "INVOICE_NOT_FOUND", "Invoice does not exist.");
  }

  if (!invoice.conversationId) {
    throw new ServiceError(400, "INVOICE_CONVERSATION_REQUIRED", "Invoice must be linked to conversation to send via chat.");
  }

  assertInvoiceSendable(invoice.status);

  const publicLink = buildPublicInvoiceUrl(invoice.publicToken);
  const automatedText = buildAutomatedInvoiceText(publicLink);

  await sendOutboundMessage({
    actorUserId: input.actorUserId,
    orgId,
    conversationId: invoice.conversationId,
    type: "TEXT",
    text: automatedText
  });

  const updateResult = await prisma.invoice.updateMany({
    where: {
      id: invoice.id,
      orgId
    },
    data: {
      status: invoice.status === InvoiceStatus.DRAFT ? InvoiceStatus.SENT : invoice.status
    }
  });

  if (updateResult.count !== 1) {
    throw new ServiceError(404, "INVOICE_NOT_FOUND", "Invoice does not exist.");
  }

  const updated = await prisma.invoice.findFirst({
    where: {
      id: invoice.id,
      orgId
    },
    select: {
      id: true,
      invoiceNo: true,
      status: true,
      updatedAt: true
    }
  });

  if (!updated) {
    throw new ServiceError(404, "INVOICE_NOT_FOUND", "Invoice does not exist.");
  }

  await writeAuditLogSafe({
    orgId,
    actorUserId: input.actorUserId,
    action: "invoice.sent",
    entityType: "invoice",
    entityId: updated.id,
    meta: {
      invoiceNo: updated.invoiceNo,
      status: updated.status
    }
  });

  void publishInvoiceUpdatedEvent({
    orgId,
    invoiceId: updated.id,
    status: updated.status
  });

  return {
    ...updated,
    publicLink
  };
}
