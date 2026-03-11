import { prisma } from "@/lib/db/prisma";
import { canAccessInbox } from "@/lib/permissions/orgPermissions";
import { ServiceError } from "@/server/services/serviceError";

type GetConversationCrmContextInput = {
  actorUserId: string;
  orgId: string;
  conversationId: string;
};

type CrmInvoiceSummary = {
  id: string;
  invoiceNo: string;
  status: string;
  kind: "FULL" | "DP_AND_FINAL";
  totalCents: number;
  currency: string;
  proofCount: number;
  createdAt: Date;
};

type CrmActivityEvent = {
  id: string;
  type: "CONVERSATION_STARTED" | "INVOICE_CREATED" | "INVOICE_SENT" | "PROOF_ATTACHED" | "INVOICE_PAID";
  label: string;
  time: Date;
};

export type ConversationCrmContextResult = {
  invoices: CrmInvoiceSummary[];
  events: CrmActivityEvent[];
};

function normalize(value: string): string {
  return value.trim();
}

async function requireInboxMembership(userId: string, orgId: string) {
  const membership = await prisma.orgMember.findUnique({
    where: {
      orgId_userId: {
        orgId,
        userId
      }
    },
    select: {
      role: true
    }
  });

  if (!membership) {
    throw new ServiceError(403, "ORG_ACCESS_DENIED", "You do not have access to this organization.");
  }

  if (!canAccessInbox(membership.role)) {
    throw new ServiceError(403, "FORBIDDEN_INBOX_ACCESS", "Your role cannot access inbox conversations.");
  }
}

export async function getConversationCrmContext(
  input: GetConversationCrmContextInput
): Promise<ConversationCrmContextResult> {
  const orgId = normalize(input.orgId);
  const conversationId = normalize(input.conversationId);

  if (!orgId) {
    throw new ServiceError(400, "MISSING_ORG_ID", "orgId is required.");
  }

  if (!conversationId) {
    throw new ServiceError(400, "MISSING_CONVERSATION_ID", "conversationId is required.");
  }

  await requireInboxMembership(input.actorUserId, orgId);

  const conversation = await prisma.conversation.findFirst({
    where: {
      id: conversationId,
      orgId
    },
    select: {
      id: true,
      createdAt: true
    }
  });

  if (!conversation) {
    throw new ServiceError(404, "CONVERSATION_NOT_FOUND", "Conversation does not exist.");
  }

  const invoices = await prisma.invoice.findMany({
    where: {
      orgId,
      conversationId: conversation.id
    },
    orderBy: {
      createdAt: "desc"
    },
    select: {
      id: true,
      invoiceNo: true,
      status: true,
      kind: true,
      totalCents: true,
      currency: true,
      createdAt: true,
      _count: {
        select: {
          proofs: true
        }
      }
    }
  });

  const invoiceIds = invoices.map((invoice) => invoice.id);
  const [sentLogs, proofs, paidMilestones] =
    invoiceIds.length > 0
      ? await Promise.all([
          prisma.auditLog.findMany({
            where: {
              orgId,
              entityType: "invoice",
              action: "invoice.sent",
              entityId: {
                in: invoiceIds
              }
            },
            select: {
              id: true,
              createdAt: true,
              entityId: true
            },
            orderBy: {
              createdAt: "desc"
            },
            take: 100
          }),
          prisma.paymentProof.findMany({
            where: {
              orgId,
              invoiceId: {
                in: invoiceIds
              }
            },
            select: {
              id: true,
              createdAt: true,
              invoice: {
                select: {
                  id: true,
                  invoiceNo: true
                }
              }
            },
            orderBy: {
              createdAt: "desc"
            },
            take: 100
          }),
          prisma.paymentMilestone.findMany({
            where: {
              orgId,
              invoiceId: {
                in: invoiceIds
              },
              status: "PAID",
              paidAt: {
                not: null
              }
            },
            select: {
              id: true,
              type: true,
              paidAt: true,
              invoice: {
                select: {
                  id: true,
                  invoiceNo: true
                }
              }
            },
            orderBy: {
              paidAt: "desc"
            },
            take: 100
          })
        ])
      : [[], [], []];

  const invoiceNoById = new Map(invoices.map((invoice) => [invoice.id, invoice.invoiceNo]));

  const events: CrmActivityEvent[] = [
    {
      id: `conversation-started-${conversation.id}`,
      type: "CONVERSATION_STARTED",
      label: "Conversation started",
      time: conversation.createdAt
    }
  ];

  for (const invoice of invoices) {
    events.push({
      id: `invoice-created-${invoice.id}`,
      type: "INVOICE_CREATED",
      label: `Invoice ${invoice.invoiceNo} created`,
      time: invoice.createdAt
    });
  }

  for (const entry of sentLogs) {
    const invoiceNo = invoiceNoById.get(entry.entityId);
    if (!invoiceNo) {
      continue;
    }

    events.push({
      id: `invoice-sent-${entry.id}`,
      type: "INVOICE_SENT",
      label: `Invoice ${invoiceNo} sent to customer`,
      time: entry.createdAt
    });
  }

  for (const proof of proofs) {
    events.push({
      id: `proof-attached-${proof.id}`,
      type: "PROOF_ATTACHED",
      label: `Payment proof attached to ${proof.invoice.invoiceNo}`,
      time: proof.createdAt
    });
  }

  for (const milestone of paidMilestones) {
    if (!milestone.paidAt) {
      continue;
    }

    events.push({
      id: `invoice-paid-${milestone.id}`,
      type: "INVOICE_PAID",
      label: `Invoice ${milestone.invoice.invoiceNo} marked paid (${milestone.type})`,
      time: milestone.paidAt
    });
  }

  events.sort((left, right) => right.time.getTime() - left.time.getTime());

  return {
    invoices: invoices.map((invoice) => ({
      id: invoice.id,
      invoiceNo: invoice.invoiceNo,
      status: invoice.status,
      kind: invoice.kind,
      totalCents: invoice.totalCents,
      currency: invoice.currency,
      proofCount: invoice._count.proofs,
      createdAt: invoice.createdAt
    })),
    events
  };
}
