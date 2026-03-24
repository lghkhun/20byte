import { prisma } from "@/lib/db/prisma";
import { canAccessInbox } from "@/lib/permissions/orgPermissions";
import { assertOrgBillingAccess } from "@/server/services/billingService";
import type { ListMessagesInput, MessageListResult } from "@/server/services/message/messageTypes";
import { normalize, normalizeLimit, normalizePage } from "@/server/services/message/messageUtils";
import { ServiceError } from "@/server/services/serviceError";

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

  await assertOrgBillingAccess(orgId, "write");
}

export async function listConversationMessages(input: ListMessagesInput): Promise<MessageListResult> {
  const orgId = normalize(input.orgId);
  const conversationId = normalize(input.conversationId);
  if (!orgId) {
    throw new ServiceError(400, "MISSING_ORG_ID", "orgId is required.");
  }

  if (!conversationId) {
    throw new ServiceError(400, "MISSING_CONVERSATION_ID", "conversationId is required.");
  }

  await requireInboxMembership(input.actorUserId, orgId);
  const page = normalizePage(input.page);
  const limit = normalizeLimit(input.limit);

  const conversation = await prisma.conversation.findFirst({
    where: {
      id: conversationId,
      orgId
    },
    select: {
      id: true
    }
  });

  if (!conversation) {
    throw new ServiceError(404, "CONVERSATION_NOT_FOUND", "Conversation does not exist.");
  }

  const [total, rows] = await prisma.$transaction([
    prisma.message.count({
      where: {
        orgId,
        conversationId: conversation.id
      }
    }),
    prisma.message.findMany({
      where: {
        orgId,
        conversationId: conversation.id
      },
      orderBy: {
        createdAt: "asc"
      },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        waMessageId: true,
        direction: true,
        type: true,
        text: true,
        mediaUrl: true,
        mimeType: true,
        fileName: true,
        templateName: true,
        templateCategory: true,
        templateLanguageCode: true,
        isAutomated: true,
        sendStatus: true,
        deliveryStatus: true,
        sendError: true,
        retryable: true,
        sendAttemptCount: true,
        deliveredAt: true,
        readAt: true,
        createdAt: true
      }
    })
  ]);

  return {
    messages: rows,
    page,
    limit,
    total
  };
}
