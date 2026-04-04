import { InvoiceStatus } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import type { InvoiceTimelineEvent } from "@/server/services/invoice/invoiceTypes";
import { ServiceError } from "@/server/services/serviceError";

export async function loadInvoiceForMarkPaid(orgId: string, invoiceId: string) {
  const invoice = await prisma.invoice.findFirst({
    where: {
      id: invoiceId,
      orgId
    },
    select: {
      id: true,
      conversationId: true,
      invoiceNo: true,
      status: true,
      kind: true,
      currency: true,
      totalCents: true,
      customer: {
        select: {
          phoneE164: true
        }
      },
      conversation: {
        select: {
          trackingId: true
        }
      },
      milestones: {
        select: {
          id: true,
          type: true,
          status: true,
          paidAt: true
        },
        orderBy: {
          type: "asc"
        }
      },
      proofs: {
        select: {
          id: true
        }
      }
    }
  });

  if (!invoice) {
    throw new ServiceError(404, "INVOICE_NOT_FOUND", "Invoice does not exist.");
  }

  if (invoice.status === InvoiceStatus.VOID) {
    throw new ServiceError(400, "INVOICE_VOID", "Void invoice cannot be marked paid.");
  }

  if (invoice.status === InvoiceStatus.PAID) {
    throw new ServiceError(400, "INVOICE_ALREADY_PAID", "Invoice already paid.");
  }

  if (invoice.status === InvoiceStatus.DRAFT) {
    throw new ServiceError(400, "INVOICE_NOT_SENT", "Draft invoice must be sent before payment marking.");
  }

  return invoice;
}

export async function markMilestonesPaid(params: {
  orgId: string;
  invoiceId: string;
  targetMilestoneTypes: Array<"FULL" | "DP" | "FINAL">;
  now: Date;
}) {
  await prisma.paymentMilestone.updateMany({
    where: {
      orgId: params.orgId,
      invoiceId: params.invoiceId,
      type: {
        in: params.targetMilestoneTypes
      },
      status: "PENDING"
    },
    data: {
      status: "PAID",
      paidAt: params.now
    }
  });

  return prisma.paymentMilestone.findMany({
    where: {
      orgId: params.orgId,
      invoiceId: params.invoiceId
    },
    orderBy: {
      type: "asc"
    },
    select: {
      id: true,
      type: true,
      status: true,
      paidAt: true
    }
  });
}

export async function updateInvoiceStatusAndFetch(params: {
  orgId: string;
  invoiceId: string;
  nextStatus: InvoiceStatus;
}) {
  const updateResult = await prisma.invoice.updateMany({
    where: {
      id: params.invoiceId,
      orgId: params.orgId
    },
    data: {
      status: params.nextStatus
    }
  });

  if (updateResult.count !== 1) {
    throw new ServiceError(404, "INVOICE_NOT_FOUND", "Invoice does not exist.");
  }

  const updated = await prisma.invoice.findFirst({
    where: {
      id: params.invoiceId,
      orgId: params.orgId
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

  return updated;
}

export async function loadTimelineRows(orgId: string, invoiceId: string) {
  return Promise.all([
    prisma.auditLog.findMany({
      where: {
        orgId,
        entityType: "invoice",
        entityId: invoiceId,
        action: {
          in: ["invoice.sent", "invoice.payment_marked"]
        }
      },
      orderBy: {
        createdAt: "desc"
      },
      select: {
        id: true,
        action: true,
        createdAt: true
      }
    }),
    prisma.paymentProof.findMany({
      where: {
        orgId,
        invoiceId
      },
      orderBy: {
        createdAt: "desc"
      },
      select: {
        id: true,
        milestoneType: true,
        createdAt: true
      }
    }),
    prisma.paymentMilestone.findMany({
      where: {
        orgId,
        invoiceId,
        status: "PAID",
        paidAt: {
          not: null
        }
      },
      orderBy: {
        paidAt: "desc"
      },
      select: {
        id: true,
        type: true,
        paidAt: true
      }
    })
  ]);
}

export function buildInvoiceTimelineEvents(params: {
  invoiceId: string;
  invoiceStatus: InvoiceStatus;
  invoiceCreatedAt: Date;
  auditRows: Array<{ id: string; action: string; createdAt: Date }>;
  proofRows: Array<{ id: string; milestoneType: string | null; createdAt: Date }>;
  paidRows: Array<{ id: string; type: string; paidAt: Date | null }>;
}): InvoiceTimelineEvent[] {
  const events: InvoiceTimelineEvent[] = [
    {
      id: `invoice-created-${params.invoiceId}`,
      type: "INVOICE_CREATED",
      label: "Invoice dibuat",
      at: params.invoiceCreatedAt
    }
  ];

  for (const row of params.auditRows) {
    if (row.action === "invoice.sent") {
      events.push({
        id: `invoice-sent-${row.id}`,
        type: "INVOICE_SENT",
        label: "Invoice dikirim ke pelanggan",
        at: row.createdAt
      });
      continue;
    }

    events.push({
      id: `invoice-payment-marked-${row.id}`,
      type: "PAYMENT_MARKED",
      label: "Pembayaran ditandai oleh tim",
      at: row.createdAt
    });
  }

  for (const proof of params.proofRows) {
    events.push({
      id: `proof-attached-${proof.id}`,
      type: "PROOF_ATTACHED",
      label: `Bukti pembayaran terlampir${proof.milestoneType ? ` (${proof.milestoneType})` : ""}`,
      at: proof.createdAt
    });
  }

  for (const paid of params.paidRows) {
    if (!paid.paidAt) {
      continue;
    }

    events.push({
      id: `milestone-paid-${paid.id}`,
      type: "PAYMENT_MARKED",
      label: `Termin ${paid.type} ditandai lunas`,
      at: paid.paidAt
    });
  }

  if (params.invoiceStatus === InvoiceStatus.PAID) {
    const completedAt = params.paidRows[0]?.paidAt ?? params.auditRows.find((item) => item.action === "invoice.payment_marked")?.createdAt;
    if (completedAt) {
      events.push({
        id: `invoice-completed-${params.invoiceId}`,
        type: "INVOICE_COMPLETED",
        label: "Invoice selesai (lunas penuh)",
        at: completedAt
      });
    }
  }

  events.sort((left, right) => right.at.getTime() - left.at.getTime());

  return events;
}
