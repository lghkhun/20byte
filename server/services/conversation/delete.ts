import { prisma } from "@/lib/db/prisma";
import { requireInboxMembership } from "@/server/services/conversation/access";
import { normalizeValue } from "@/server/services/conversation/utils";
import { ServiceError } from "@/server/services/serviceError";

export type DeleteConversationInput = {
  actorUserId: string;
  orgId: string;
  conversationId: string;
};

export async function deleteConversation(input: DeleteConversationInput): Promise<{ id: string }> {
  const orgId = normalizeValue(input.orgId);
  const conversationId = normalizeValue(input.conversationId);

  if (!orgId) {
    throw new ServiceError(400, "MISSING_ORG_ID", "orgId is required.");
  }

  if (!conversationId) {
    throw new ServiceError(400, "MISSING_CONVERSATION_ID", "conversationId is required.");
  }

  await requireInboxMembership(input.actorUserId, orgId);

  const existingConversation = await prisma.conversation.findFirst({
    where: {
      id: conversationId,
      orgId
    },
    select: {
      id: true
    }
  });

  if (!existingConversation) {
    throw new ServiceError(404, "CONVERSATION_NOT_FOUND", "Conversation does not exist.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.invoice.updateMany({
      where: {
        orgId,
        conversationId
      },
      data: {
        conversationId: null
      }
    });

    await tx.message.deleteMany({
      where: {
        orgId,
        conversationId
      }
    });

    await tx.conversation.delete({
      where: {
        id: conversationId
      }
    });
  });

  return { id: conversationId };
}
