import { InvoiceStatus } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { publishInvoicePaidEvent, publishInvoiceUpdatedEvent } from "@/lib/ably/publisher";
import { writeAuditLogSafe } from "@/server/services/auditLogService";
import { requireInvoiceAccess, requireInvoiceMembershipRole } from "@/server/services/invoice/access";
import {
  assertMarkPaidProofRule,
  assertMilestoneTypesExist,
  resolveTargetMilestoneTypes
} from "@/server/services/invoice/paymentPolicy";
import {
  buildInvoiceTimelineEvents,
  loadInvoiceForMarkPaid,
  loadTimelineRows,
  markMilestonesPaid,
  updateInvoiceStatusAndFetch
} from "@/server/services/invoice/paymentInternals";
import type {
  GetInvoiceTimelineInput,
  InvoiceTimelineResult,
  MarkInvoicePaidInput,
  MarkInvoicePaidResult
} from "@/server/services/invoice/invoiceTypes";
import { deriveInvoiceStatus, normalize } from "@/server/services/invoice/invoiceUtils";
import { ServiceError } from "@/server/services/serviceError";

export async function markInvoicePaid(input: MarkInvoicePaidInput): Promise<MarkInvoicePaidResult> {
  const orgId = normalize(input.orgId);
  const invoiceId = normalize(input.invoiceId);
  if (!orgId) {
    throw new ServiceError(400, "MISSING_ORG_ID", "orgId is required.");
  }

  if (!invoiceId) {
    throw new ServiceError(400, "MISSING_INVOICE_ID", "invoiceId is required.");
  }

  const actorRole = await requireInvoiceMembershipRole(input.actorUserId, orgId);
  const invoice = await loadInvoiceForMarkPaid(orgId, invoiceId);

  const hasProof = invoice.proofs.length > 0;
  assertMarkPaidProofRule(actorRole, hasProof);

  const now = new Date();
  const targetMilestoneTypes = resolveTargetMilestoneTypes(invoice.kind, input.milestoneType);
  assertMilestoneTypesExist(
    invoice.milestones.map((item) => item.type),
    targetMilestoneTypes
  );

  const refreshedMilestones = await markMilestonesPaid({
    orgId,
    invoiceId: invoice.id,
    targetMilestoneTypes,
    now
  });

  const nextStatus = deriveInvoiceStatus(refreshedMilestones, invoice.status);
  const updated = await updateInvoiceStatusAndFetch({
    orgId,
    invoiceId: invoice.id,
    nextStatus
  });

  await writeAuditLogSafe({
    orgId,
    actorUserId: input.actorUserId,
    action: "invoice.payment_marked",
    entityType: "invoice",
    entityId: updated.id,
    meta: {
      invoiceNo: updated.invoiceNo,
      markedMilestones: targetMilestoneTypes,
      actorRole,
      status: updated.status,
      hadProof: hasProof
    }
  });

  if (updated.status === InvoiceStatus.PAID) {
    void publishInvoicePaidEvent({
      orgId,
      invoiceId: updated.id,
      status: "PAID"
    });
  } else {
    void publishInvoiceUpdatedEvent({
      orgId,
      invoiceId: updated.id,
      status: updated.status
    });
  }

  return {
    ...updated,
    milestones: refreshedMilestones
  };
}

export async function getInvoiceTimeline(input: GetInvoiceTimelineInput): Promise<InvoiceTimelineResult> {
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
      createdAt: true
    }
  });

  if (!invoice) {
    throw new ServiceError(404, "INVOICE_NOT_FOUND", "Invoice does not exist.");
  }

  const [auditRows, proofRows, paidRows] = await loadTimelineRows(orgId, invoice.id);
  const events = buildInvoiceTimelineEvents({
    invoiceId: invoice.id,
    invoiceStatus: invoice.status,
    invoiceCreatedAt: invoice.createdAt,
    auditRows,
    proofRows,
    paidRows
  });

  return {
    invoiceId: invoice.id,
    invoiceNo: invoice.invoiceNo,
    status: invoice.status,
    events
  };
}
