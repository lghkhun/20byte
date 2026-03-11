import { prisma } from "@/lib/db/prisma";
import { publishConversationUpdatedEvent } from "@/lib/ably/publisher";
import { requireInboxMembership } from "@/server/services/conversation/access";
import { toConversationSummary } from "@/server/services/conversation/mappers";
import type { ConversationSummary, UpdateConversationStatusInput } from "@/server/services/conversation/types";
import { normalizeValue } from "@/server/services/conversation/utils";
import { ServiceError } from "@/server/services/serviceError";

export async function updateConversationStatus(input: UpdateConversationStatusInput): Promise<ConversationSummary> {
  const orgId = normalizeValue(input.orgId);
  const conversationId = normalizeValue(input.conversationId);
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
    include: {
      customer: {
        select: {
          id: true,
          phoneE164: true,
          displayName: true,
          source: true
        }
      }
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
      status: input.status
    }
  });

  if (updateResult.count !== 1) {
    throw new ServiceError(404, "CONVERSATION_NOT_FOUND", "Conversation does not exist.");
  }

  const updatedConversation = await prisma.conversation.findFirst({
    where: {
      id: conversation.id,
      orgId
    }
  });

  if (!updatedConversation) {
    throw new ServiceError(404, "CONVERSATION_NOT_FOUND", "Conversation does not exist.");
  }

  void publishConversationUpdatedEvent({
    orgId: updatedConversation.orgId,
    conversationId: updatedConversation.id,
    assignedToMemberId: updatedConversation.assignedToMemberId,
    status: updatedConversation.status
  });

  return toConversationSummary({
    conversation: updatedConversation,
    customer: {
      phoneE164: conversation.customer.phoneE164,
      displayName: conversation.customer.displayName,
      source: conversation.customer.source
    }
  });
}
