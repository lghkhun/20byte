import { ConversationStatus } from "@prisma/client";

import { publishConversationUpdatedEvent } from "@/lib/ably/publisher";
import { prisma } from "@/lib/db/prisma";
import { canAccessInbox } from "@/lib/permissions/orgPermissions";
import { assertOrgBillingAccess } from "@/server/services/billingService";
import { normalizeLegacyLocalInvoiceLinks } from "@/server/services/conversation/utils";
import { ServiceError } from "@/server/services/serviceError";

type PipelineStageItem = {
  id: string;
  name: string;
  color: string;
  position: number;
};

export type CrmPipelineItem = {
  id: string;
  name: string;
  isDefault: boolean;
  stages: PipelineStageItem[];
};

export type CrmPipelineKanbanCard = {
  id: string;
  customerName: string;
  customerPhoneE164: string;
  status: "OPEN" | "CLOSED";
  assignedToMemberId: string | null;
  unreadCount: number;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  invoiceCount: number;
  unpaidInvoiceCount: number;
};

export type CrmPipelineKanbanColumn = {
  stageId: string;
  stageName: string;
  stageColor: string;
  position: number;
  cardCount: number;
  hasMore: boolean;
  cards: CrmPipelineKanbanCard[];
};

export type CrmPipelineAssigneeOption = {
  orgMemberId: string;
  userId: string;
  name: string | null;
  email: string;
  role: string;
};

export type CrmPipelineKanbanBoard = {
  pipeline: CrmPipelineItem;
  columns: CrmPipelineKanbanColumn[];
  assignees: CrmPipelineAssigneeOption[];
  unassigned: {
    cardCount: number;
    hasMore: boolean;
    cards: CrmPipelineKanbanCard[];
  };
};

function normalize(value: string | undefined): string {
  return (value ?? "").trim();
}

async function requireCrmAccess(userId: string, orgId: string) {
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
    throw new ServiceError(403, "ORG_ACCESS_DENIED", "You do not have access to this business.");
  }

  if (!canAccessInbox(membership.role)) {
    throw new ServiceError(403, "FORBIDDEN_CRM_ACCESS", "Your role cannot manage CRM pipelines.");
  }

  await assertOrgBillingAccess(orgId, "write");
}

function mapPipeline(row: {
  id: string;
  name: string;
  isDefault: boolean;
  stages: Array<{ id: string; name: string; color: string; position: number }>;
}): CrmPipelineItem {
  return {
    id: row.id,
    name: row.name,
    isDefault: row.isDefault,
    stages: row.stages
      .slice()
      .sort((left, right) => left.position - right.position)
      .map((stage) => ({
        id: stage.id,
        name: stage.name,
        color: stage.color,
        position: stage.position
      }))
  };
}

function toConversationStatus(status: string | undefined): ConversationStatus | undefined {
  const normalized = normalize(status);
  if (!normalized || normalized === "ALL") {
    return undefined;
  }

  if (normalized === "OPEN") {
    return ConversationStatus.OPEN;
  }

  if (normalized === "CLOSED") {
    return ConversationStatus.CLOSED;
  }

  throw new ServiceError(400, "INVALID_CONVERSATION_STATUS", "status must be OPEN, CLOSED, or ALL.");
}

function parseDateInput(value: string | undefined, field: "activityFrom" | "activityTo"): Date | undefined {
  const normalized = normalize(value);
  if (!normalized) {
    return undefined;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw new ServiceError(400, "INVALID_DATE_FILTER", `${field} must be in YYYY-MM-DD format.`);
  }

  const suffix = field === "activityTo" ? "T23:59:59.999Z" : "T00:00:00.000Z";
  const date = new Date(`${normalized}${suffix}`);
  if (Number.isNaN(date.getTime())) {
    throw new ServiceError(400, "INVALID_DATE_FILTER", `${field} is not a valid date.`);
  }

  return date;
}

function normalizeCardLimit(value: number | undefined): number {
  if (!value || Number.isNaN(value)) {
    return 80;
  }

  const rounded = Math.floor(value);
  if (rounded < 20) {
    return 20;
  }
  if (rounded > 320) {
    return 320;
  }

  return rounded;
}

function mapKanbanCard(row: {
  id: string;
  status: ConversationStatus;
  assignedToMemberId: string | null;
  unreadCount: number;
  lastMessageAt: Date | null;
  customer: {
    phoneE164: string;
    displayName: string | null;
  };
  messages: Array<{
    text: string | null;
    type: string;
    fileName: string | null;
  }>;
}, invoiceCounters: { total: number; unpaid: number }): CrmPipelineKanbanCard {
  const latestMessage = row.messages[0] ?? null;
  const fallbackPreview = latestMessage?.type === "TEXT" ? "" : latestMessage?.fileName || latestMessage?.type || "";
  const latestTextPreview = normalizeLegacyLocalInvoiceLinks(latestMessage?.text?.trim() || "");

  return {
    id: row.id,
    customerName: row.customer.displayName?.trim() || row.customer.phoneE164,
    customerPhoneE164: row.customer.phoneE164,
    status: row.status,
    assignedToMemberId: row.assignedToMemberId,
    unreadCount: row.unreadCount,
    lastMessageAt: row.lastMessageAt ? row.lastMessageAt.toISOString() : null,
    lastMessagePreview: latestTextPreview || fallbackPreview || null,
    invoiceCount: invoiceCounters.total,
    unpaidInvoiceCount: invoiceCounters.unpaid
  };
}

export async function ensureDefaultCrmPipeline(orgId: string): Promise<void> {
  const existing = await prisma.crmPipeline.findFirst({
    where: { orgId },
    select: { id: true }
  });

  if (existing) {
    return;
  }

  try {
    await prisma.crmPipeline.create({
      data: {
        orgId,
        name: "Pipeline Default",
        isDefault: true,
        stages: {
          create: [
            { orgId, name: "Inisiasi Chat", color: "sky", position: 0 },
            { orgId, name: "Survey Kebutuhan", color: "amber", position: 1 },
            { orgId, name: "Penawaran & Follow Up", color: "violet", position: 2 },
            { orgId, name: "Closing & Pembayaran", color: "emerald", position: 3 }
          ]
        }
      }
    });
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && (error as { code?: string }).code === "P2002") {
      // Another request already created the default pipeline.
      return;
    }
    throw error;
  }
}

export async function listCrmPipelines(actorUserId: string, orgIdInput: string): Promise<CrmPipelineItem[]> {
  const orgId = normalize(orgIdInput);
  if (!orgId) {
    throw new ServiceError(400, "MISSING_ORG_ID", "orgId is required.");
  }

  await requireCrmAccess(actorUserId, orgId);
  await ensureDefaultCrmPipeline(orgId);

  const rows = await prisma.crmPipeline.findMany({
    where: { orgId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    select: {
      id: true,
      name: true,
      isDefault: true,
      stages: {
        orderBy: { position: "asc" },
        select: {
          id: true,
          name: true,
          color: true,
          position: true
        }
      }
    }
  });

  return rows.map(mapPipeline);
}

export async function listCrmPipelineKanbanBoard(input: {
  actorUserId: string;
  orgId: string;
  pipelineId?: string;
  status?: string;
  assigneeUserId?: string;
  activityFrom?: string;
  activityTo?: string;
  cardLimit?: number;
}): Promise<CrmPipelineKanbanBoard> {
  const orgId = normalize(input.orgId);
  const pipelineId = normalize(input.pipelineId);
  const status = toConversationStatus(input.status);
  const assigneeUserId = normalize(input.assigneeUserId);
  const activityFrom = parseDateInput(input.activityFrom, "activityFrom");
  const activityTo = parseDateInput(input.activityTo, "activityTo");
  const cardLimit = normalizeCardLimit(input.cardLimit);

  if (!orgId) {
    throw new ServiceError(400, "MISSING_ORG_ID", "orgId is required.");
  }
  if (activityFrom && activityTo && activityFrom.getTime() > activityTo.getTime()) {
    throw new ServiceError(400, "INVALID_DATE_RANGE", "activityFrom must be before or equal to activityTo.");
  }

  await requireCrmAccess(input.actorUserId, orgId);
  await ensureDefaultCrmPipeline(orgId);

  const pipelineRow =
    (pipelineId
      ? await prisma.crmPipeline.findFirst({
          where: {
            id: pipelineId,
            orgId
          },
          select: {
            id: true,
            name: true,
            isDefault: true,
            stages: {
              orderBy: { position: "asc" },
              select: {
                id: true,
                name: true,
                color: true,
                position: true
              }
            }
          }
        })
      : null) ??
    (await prisma.crmPipeline.findFirst({
      where: { orgId },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      select: {
        id: true,
        name: true,
        isDefault: true,
        stages: {
          orderBy: { position: "asc" },
          select: {
            id: true,
            name: true,
            color: true,
            position: true
          }
        }
      }
    }));

  if (!pipelineRow) {
    throw new ServiceError(404, "CRM_PIPELINE_NOT_FOUND", "CRM pipeline does not exist.");
  }

  const pipeline = mapPipeline(pipelineRow);

  let assignedToMemberIdFilter: string | null | undefined;
  if (assigneeUserId === "UNASSIGNED") {
    assignedToMemberIdFilter = null;
  } else if (assigneeUserId && assigneeUserId !== "ALL") {
    const assigneeMembership = await prisma.orgMember.findUnique({
      where: {
        orgId_userId: {
          orgId,
          userId: assigneeUserId
        }
      },
      select: {
        id: true
      }
    });

    if (!assigneeMembership) {
      throw new ServiceError(404, "ASSIGNEE_NOT_FOUND", "Selected assignee does not exist in this organization.");
    }

    assignedToMemberIdFilter = assigneeMembership.id;
  }

  const [assigneeMemberships, conversations] = await Promise.all([
    prisma.orgMember.findMany({
      where: {
        orgId
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true
          }
        }
      },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }]
    }),
    prisma.conversation.findMany({
      where: {
        orgId,
        ...(status ? { status } : {}),
        ...(assignedToMemberIdFilter === undefined ? {} : { assignedToMemberId: assignedToMemberIdFilter }),
        ...((activityFrom || activityTo)
          ? {
              lastMessageAt: {
                ...(activityFrom ? { gte: activityFrom } : {}),
                ...(activityTo ? { lte: activityTo } : {})
              }
            }
          : {}),
        OR: [{ crmPipelineId: pipeline.id }, { crmPipelineId: null }]
      },
      orderBy: [{ lastMessageAt: "desc" }, { updatedAt: "desc" }],
      select: {
        id: true,
        status: true,
        assignedToMemberId: true,
        unreadCount: true,
        lastMessageAt: true,
        crmStageId: true,
        customer: {
          select: {
            phoneE164: true,
            displayName: true
          }
        },
        messages: {
          take: 1,
          orderBy: { createdAt: "desc" },
          select: {
            text: true,
            type: true,
            fileName: true
          }
        }
      }
    })
  ]);

  const conversationIds = conversations.map((conversation) => conversation.id);
  const [totalInvoiceGroup, unpaidInvoiceGroup] = conversationIds.length
    ? await Promise.all([
        prisma.invoice.groupBy({
          by: ["conversationId"],
          where: {
            orgId,
            conversationId: {
              in: conversationIds
            }
          },
          _count: {
            _all: true
          }
        }),
        prisma.invoice.groupBy({
          by: ["conversationId"],
          where: {
            orgId,
            conversationId: {
              in: conversationIds
            },
            status: {
              notIn: ["PAID", "VOID"]
            }
          },
          _count: {
            _all: true
          }
        })
      ])
    : [[], []];

  const totalInvoiceMap = new Map<string, number>();
  for (const item of totalInvoiceGroup) {
    if (!item.conversationId) {
      continue;
    }
    totalInvoiceMap.set(item.conversationId, item._count._all);
  }

  const unpaidInvoiceMap = new Map<string, number>();
  for (const item of unpaidInvoiceGroup) {
    if (!item.conversationId) {
      continue;
    }
    unpaidInvoiceMap.set(item.conversationId, item._count._all);
  }

  const cardsByStage = new Map<string, CrmPipelineKanbanCard[]>();
  const unassignedCards: CrmPipelineKanbanCard[] = [];

  for (const stage of pipeline.stages) {
    cardsByStage.set(stage.id, []);
  }

  for (const conversation of conversations) {
    const card = mapKanbanCard(conversation, {
      total: totalInvoiceMap.get(conversation.id) ?? 0,
      unpaid: unpaidInvoiceMap.get(conversation.id) ?? 0
    });
    if (!conversation.crmStageId || !cardsByStage.has(conversation.crmStageId)) {
      unassignedCards.push(card);
      continue;
    }

    cardsByStage.get(conversation.crmStageId)?.push(card);
  }

  return {
    pipeline,
    columns: pipeline.stages.map((stage) => {
      const cards = cardsByStage.get(stage.id) ?? [];
      const boundedCards = cards.slice(0, cardLimit);
      return {
        stageId: stage.id,
        stageName: stage.name,
        stageColor: stage.color,
        position: stage.position,
        cardCount: cards.length,
        hasMore: cards.length > boundedCards.length,
        cards: boundedCards
      };
    }),
    assignees: assigneeMemberships.map((membership) => ({
      orgMemberId: membership.id,
      userId: membership.user.id,
      name: membership.user.name,
      email: membership.user.email,
      role: membership.role
    })),
    unassigned: {
      cardCount: unassignedCards.length,
      hasMore: unassignedCards.length > cardLimit,
      cards: unassignedCards.slice(0, cardLimit)
    }
  };
}

export async function createCrmPipeline(input: {
  actorUserId: string;
  orgId: string;
  name: string;
}): Promise<CrmPipelineItem> {
  const orgId = normalize(input.orgId);
  const name = normalize(input.name);
  if (!orgId) {
    throw new ServiceError(400, "MISSING_ORG_ID", "orgId is required.");
  }
  if (!name) {
    throw new ServiceError(400, "MISSING_PIPELINE_NAME", "Pipeline name is required.");
  }

  await requireCrmAccess(input.actorUserId, orgId);
  await ensureDefaultCrmPipeline(orgId);

  const created = await prisma.crmPipeline.create({
    data: {
      orgId,
      name,
      stages: {
        create: [{ orgId, name: "Leads Masuk", color: "sky", position: 0 }]
      }
    },
    select: {
      id: true,
      name: true,
      isDefault: true,
      stages: {
        orderBy: { position: "asc" },
        select: {
          id: true,
          name: true,
          color: true,
          position: true
        }
      }
    }
  });

  return mapPipeline(created);
}

export async function createCrmPipelineStage(input: {
  actorUserId: string;
  orgId: string;
  pipelineId: string;
  name: string;
  color?: string;
}): Promise<CrmPipelineItem> {
  const orgId = normalize(input.orgId);
  const pipelineId = normalize(input.pipelineId);
  const name = normalize(input.name);
  if (!orgId || !pipelineId || !name) {
    throw new ServiceError(400, "INVALID_STAGE_INPUT", "Pipeline and stage name are required.");
  }

  await requireCrmAccess(input.actorUserId, orgId);

  const pipelineInOrg = await prisma.crmPipeline.findFirst({
    where: {
      id: pipelineId,
      orgId
    },
    select: {
      id: true
    }
  });

  if (!pipelineInOrg) {
    throw new ServiceError(404, "CRM_PIPELINE_NOT_FOUND", "CRM pipeline does not exist.");
  }

  await prisma.$transaction(async (tx) => {
    const stageCount = await tx.crmPipelineStage.count({
      where: {
        orgId,
        pipelineId: pipelineInOrg.id
      }
    });

    await tx.crmPipelineStage.create({
      data: {
        orgId,
        pipelineId: pipelineInOrg.id,
        name,
        color: normalize(input.color) || "emerald",
        position: stageCount
      }
    });
  });

  const pipeline = await prisma.crmPipeline.findFirst({
    where: {
      id: pipelineInOrg.id,
      orgId
    },
    select: {
      id: true,
      name: true,
      isDefault: true,
      stages: {
        orderBy: { position: "asc" },
        select: {
          id: true,
          name: true,
          color: true,
          position: true
        }
      }
    }
  });

  if (!pipeline) {
    throw new ServiceError(404, "CRM_PIPELINE_NOT_FOUND", "CRM pipeline does not exist.");
  }

  return mapPipeline(pipeline);
}

export async function assignConversationPipeline(input: {
  actorUserId: string;
  orgId: string;
  conversationId: string;
  pipelineId: string;
  stageId: string;
}) {
  const orgId = normalize(input.orgId);
  const conversationId = normalize(input.conversationId);
  const pipelineId = normalize(input.pipelineId);
  const stageId = normalize(input.stageId);
  if (!orgId || !conversationId || !pipelineId || !stageId) {
    throw new ServiceError(400, "INVALID_PIPELINE_ASSIGNMENT", "conversationId, pipelineId, and stageId are required.");
  }

  await requireCrmAccess(input.actorUserId, orgId);

  const stage = await prisma.crmPipelineStage.findFirst({
    where: {
      id: stageId,
      orgId,
      pipelineId
    },
    select: {
      id: true,
      name: true
    }
  });

  if (!stage) {
    throw new ServiceError(404, "CRM_STAGE_NOT_FOUND", "CRM stage does not exist.");
  }

  const conversation = await prisma.conversation.findFirst({
    where: {
      id: conversationId,
      orgId
    },
    select: {
      id: true,
      assignedToMemberId: true,
      status: true
    }
  });
  if (!conversation) {
    throw new ServiceError(404, "CONVERSATION_NOT_FOUND", "Conversation does not exist.");
  }

  const updateResult = await prisma.conversation.updateMany({
    where: {
      id: conversation.id,
      orgId
    },
    data: {
      crmPipelineId: pipelineId,
      crmStageId: stageId
    }
  });

  if (updateResult.count !== 1) {
    throw new ServiceError(404, "CONVERSATION_NOT_FOUND", "Conversation does not exist.");
  }

  void publishConversationUpdatedEvent({
    orgId,
    conversationId: conversation.id,
    assignedToMemberId: conversation.assignedToMemberId,
    status: conversation.status,
    crmPipelineId: pipelineId,
    crmStageId: stageId,
    crmStageName: stage.name
  });
}

export function rankStageNameForInvoiceTarget(name: string, target: "INVOICE_SENT" | "INVOICE_PAID"): number {
  const value = name.toLowerCase();
  if (target === "INVOICE_SENT") {
    if (value.includes("invoice")) {
      return 100;
    }
    if (value.includes("penawaran") || value.includes("follow up")) {
      return 80;
    }
    if (value.includes("closing")) {
      return 60;
    }
    return 0;
  }

  if (value.includes("sudah bayar") || value.includes("paid")) {
    return 120;
  }
  if (value.includes("pembayaran")) {
    return 100;
  }
  if (value.includes("closing")) {
    return 80;
  }
  return 0;
}

export function pickTargetStageForInvoiceSync(
  stages: Array<{ id: string; name: string; position: number }>,
  target: "INVOICE_SENT" | "INVOICE_PAID"
): { id: string; name: string; position: number } | null {
  const ranked = stages
    .map((stage) => ({
      ...stage,
      score: rankStageNameForInvoiceTarget(stage.name, target)
    }))
    .filter((stage) => stage.score > 0)
    .sort((left, right) => right.score - left.score || left.position - right.position);

  return ranked[0] ?? null;
}

export async function syncConversationCrmStageFromInvoice(input: {
  orgId: string;
  conversationId: string;
  target: "INVOICE_SENT" | "INVOICE_PAID";
}): Promise<void> {
  const orgId = normalize(input.orgId);
  const conversationId = normalize(input.conversationId);
  if (!orgId || !conversationId) {
    return;
  }

  const conversation = await prisma.conversation.findFirst({
    where: {
      id: conversationId,
      orgId
    },
    select: {
      id: true,
      crmPipelineId: true,
      crmStageId: true,
      assignedToMemberId: true,
      status: true
    }
  });
  if (!conversation) {
    return;
  }

  await ensureDefaultCrmPipeline(orgId);

  const pipeline =
    (conversation.crmPipelineId
      ? await prisma.crmPipeline.findFirst({
          where: {
            id: conversation.crmPipelineId,
            orgId
          },
          select: {
            id: true
          }
        })
      : null) ??
    (await prisma.crmPipeline.findFirst({
      where: { orgId },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      select: { id: true }
    }));

  if (!pipeline) {
    return;
  }

  const stages = await prisma.crmPipelineStage.findMany({
    where: {
      orgId,
      pipelineId: pipeline.id
    },
    select: {
      id: true,
      name: true,
      position: true
    },
    orderBy: { position: "asc" }
  });

  const targetStage = pickTargetStageForInvoiceSync(stages, input.target);

  if (!targetStage || targetStage.id === conversation.crmStageId) {
    return;
  }

  const updateResult = await prisma.conversation.updateMany({
    where: {
      id: conversation.id,
      orgId
    },
    data: {
      crmPipelineId: pipeline.id,
      crmStageId: targetStage.id
    }
  });

  if (updateResult.count === 1) {
    void publishConversationUpdatedEvent({
      orgId,
      conversationId: conversation.id,
      assignedToMemberId: conversation.assignedToMemberId,
      status: conversation.status,
      crmPipelineId: pipeline.id,
      crmStageId: targetStage.id,
      crmStageName: targetStage.name
    });
  }
}
