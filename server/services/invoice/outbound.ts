import { InvoiceStatus } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { publishInvoiceUpdatedEvent } from "@/lib/ably/publisher";
import { enqueueMetaEventJob } from "@/server/queues/metaEventQueue";
import { writeAuditLogSafe } from "@/server/services/auditLogService";
import { syncConversationCrmStageFromInvoice } from "@/server/services/crmPipelineService";
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
      customerId: true,
      currency: true,
      totalCents: true,
      status: true,
      publicToken: true,
      conversationId: true,
      customer: {
        select: {
          phoneE164: true
        }
      },
      conversation: {
        select: {
          trackingId: true,
          fbclid: true,
          fbc: true,
          fbp: true,
          ctwaClid: true,
          wabaId: true
        }
      }
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

  try {
    await syncConversationCrmStageFromInvoice({
      orgId,
      conversationId: invoice.conversationId,
      target: "INVOICE_SENT"
    });
  } catch (error) {
    console.warn("[invoice.outbound] failed to sync CRM stage after send", {
      orgId,
      conversationId: invoice.conversationId,
      invoiceId: updated.id,
      error
    });
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
  void enqueueMetaEventJob({
    orgId,
    kind: "INITIATE_CHECKOUT",
    customerId: invoice.customerId,
    invoiceId: invoice.id,
    invoiceNo: invoice.invoiceNo,
    dedupeKey: `initiate_checkout:${invoice.invoiceNo}`,
    customerPhoneE164: invoice.customer.phoneE164,
    trackingId: invoice.conversation?.trackingId ?? undefined,
    fbclid: invoice.conversation?.fbclid ?? undefined,
    fbc: invoice.conversation?.fbc ?? undefined,
    fbp: invoice.conversation?.fbp ?? undefined,
    ctwaClid: invoice.conversation?.ctwaClid ?? undefined,
    wabaId: invoice.conversation?.wabaId ?? undefined,
    currency: invoice.currency,
    value: invoice.totalCents / 100
  }).catch(() => undefined);

  return {
    ...updated,
    publicLink
  };
}
