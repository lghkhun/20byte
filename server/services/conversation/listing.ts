import { ConversationStatus } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { requireInboxMembership } from "@/server/services/conversation/access";
import { toConversationListItem } from "@/server/services/conversation/mappers";
import type { ConversationListItem, ConversationListResult, ListConversationsInput } from "@/server/services/conversation/types";
import { normalizeLimit, normalizePage, normalizeValue, resolveLastMessagePreview } from "@/server/services/conversation/utils";
import { ServiceError } from "@/server/services/serviceError";

export async function listConversations(input: ListConversationsInput): Promise<ConversationListResult> {
  const orgId = normalizeValue(input.orgId);
  if (!orgId) {
    throw new ServiceError(400, "MISSING_ORG_ID", "orgId is required.");
  }

  const page = normalizePage(input.page);
  const limit = normalizeLimit(input.limit);
  const filter = input.filter ?? "UNASSIGNED";
  const status = input.status ?? ConversationStatus.OPEN;
  const actorMembership = await requireInboxMembership(input.actorUserId, orgId);

  const where: {
    orgId: string;
    status: ConversationStatus;
    assignedToMemberId?: string | null;
  } = {
    orgId,
    status
  };

  if (filter === "UNASSIGNED") {
    where.assignedToMemberId = null;
  } else if (filter === "MY") {
    where.assignedToMemberId = actorMembership.id;
  }

  const [groupedCustomers, rows] = await prisma.$transaction([
    prisma.conversation.groupBy({
      by: ["customerId"],
      where,
      orderBy: {
        customerId: "asc"
      }
    }),
    prisma.conversation.findMany({
      where,
      distinct: ["customerId"],
      include: {
        crmPipeline: {
          select: {
            name: true
          }
        },
        crmStage: {
          select: {
            name: true
          }
        },
        customer: {
          select: {
            id: true,
            phoneE164: true,
            displayName: true,
            waProfilePicUrl: true,
            source: true,
            leadStatus: true
          }
        },
        messages: {
          orderBy: {
            createdAt: "desc"
          },
          take: 1,
          select: {
            text: true,
            type: true,
            direction: true,
            fileName: true
          }
        }
      },
      orderBy: [{ lastMessageAt: "desc" }, { updatedAt: "desc" }],
      skip: (page - 1) * limit,
      take: limit
    })
  ]);

  const total = groupedCustomers.length;

  return {
    conversations: rows.map((row) => toConversationListItem(row)),
    page,
    limit,
    total
  };
}

export async function getConversationById(
  actorUserId: string,
  orgId: string,
  conversationId: string
): Promise<ConversationListItem> {
  const normalizedOrgId = normalizeValue(orgId);
  const normalizedConversationId = normalizeValue(conversationId);
  if (!normalizedOrgId) {
    throw new ServiceError(400, "MISSING_ORG_ID", "orgId is required.");
  }

  if (!normalizedConversationId) {
    throw new ServiceError(400, "MISSING_CONVERSATION_ID", "conversationId is required.");
  }

  await requireInboxMembership(actorUserId, normalizedOrgId);

  const conversation = await prisma.conversation.findFirst({
    where: {
      id: normalizedConversationId,
      orgId: normalizedOrgId
    },
    include: {
      crmPipeline: {
        select: {
          name: true
        }
      },
      crmStage: {
        select: {
          name: true
        }
      },
      customer: {
        select: {
          id: true,
          phoneE164: true,
          displayName: true,
          waProfilePicUrl: true,
          source: true,
          leadStatus: true
        }
      },
      messages: {
        orderBy: {
          createdAt: "desc"
        },
        take: 1,
        select: {
          text: true,
          type: true,
          direction: true,
          fileName: true
        }
      }
    }
  });

  if (!conversation) {
    throw new ServiceError(404, "CONVERSATION_NOT_FOUND", "Conversation does not exist.");
  }

  const latestMessage = conversation.messages[0] ?? null;
  return {
    id: conversation.id,
    orgId: conversation.orgId,
    customerId: conversation.customerId,
    customerPhoneE164: conversation.customer.phoneE164,
    customerDisplayName: conversation.customer.displayName,
    customerAvatarUrl: conversation.customer.waProfilePicUrl,
    customerLeadStatus: conversation.customer.leadStatus,
    crmPipelineId: conversation.crmPipelineId,
    crmPipelineName: conversation.crmPipeline?.name ?? null,
    crmStageId: conversation.crmStageId,
    crmStageName: conversation.crmStage?.name ?? null,
    lastMessagePreview: latestMessage
      ? resolveLastMessagePreview({
          text: latestMessage.text,
          type: latestMessage.type,
          fileName: latestMessage.fileName
        })
      : null,
    lastMessageType: latestMessage?.type ?? null,
    lastMessageDirection: latestMessage?.direction ?? null,
    source: conversation.customer.source,
    sourceCampaign: conversation.sourceCampaign,
    sourceAdset: conversation.sourcePlatform,
    sourceAd: conversation.sourceMedium,
    sourcePlatform: conversation.sourcePlatform,
    sourceMedium: conversation.sourceMedium,
    status: conversation.status,
    assignedToMemberId: conversation.assignedToMemberId,
    lastMessageAt: conversation.lastMessageAt,
    unreadCount: conversation.unreadCount,
    updatedAt: conversation.updatedAt
  };
}
