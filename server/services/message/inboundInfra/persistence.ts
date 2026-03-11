import { MessageDirection, type Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import type { ResolvedAttribution, StoreInboundMessageInput } from "@/server/services/message/messageTypes";
import { ServiceError } from "@/server/services/serviceError";

type InboundContext = {
  orgId: string;
  customerPhoneE164: string;
  waMessageId: string;
  customerDisplayName?: string;
  text?: string;
  mediaId?: string;
  mimeType?: string;
  fileName?: string;
  fileSize?: number;
  type: StoreInboundMessageInput["type"];
};

type CreatedInboundMessage = {
  id: string;
  conversationId: string;
  conversationStatus: "OPEN" | "CLOSED";
  assignedToMemberId: string | null;
};

export async function findExistingInboundByWaMessageId(waMessageId: string): Promise<{ id: string } | null> {
  return prisma.message.findUnique({
    where: {
      waMessageId
    },
    select: {
      id: true
    }
  });
}

export async function storeInboundMessageInTransaction(params: {
  context: InboundContext;
  resolveAttribution: (tx: Prisma.TransactionClient) => Promise<ResolvedAttribution | undefined>;
  getOrCreateCustomer: (tx: Prisma.TransactionClient, attribution: ResolvedAttribution | undefined) => Promise<{
    id: string;
    source: string | null;
    campaign: string | null;
    adset: string | null;
    ad: string | null;
    platform: string | null;
    medium: string | null;
  }>;
  getOrCreateConversation: (
    tx: Prisma.TransactionClient,
    customerId: string,
    attribution: ResolvedAttribution | undefined,
    customer: {
      source: string | null;
      campaign: string | null;
      adset: string | null;
      ad: string | null;
      platform: string | null;
      medium: string | null;
    }
  ) => Promise<{
    id: string;
    status: "OPEN" | "CLOSED";
    assignedToMemberId: string | null;
  }>;
}): Promise<CreatedInboundMessage> {
  const { context } = params;

  return prisma.$transaction(async (tx) => {
    const attribution = await params.resolveAttribution(tx);
    const customer = await params.getOrCreateCustomer(tx, attribution);
    const conversation = await params.getOrCreateConversation(tx, customer.id, attribution, customer);

    const created = await tx.message.create({
      data: {
        orgId: context.orgId,
        conversationId: conversation.id,
        waMessageId: context.waMessageId,
        direction: MessageDirection.INBOUND,
        type: context.type,
        text: context.text,
        mediaId: context.mediaId,
        mimeType: context.mimeType,
        fileName: context.fileName,
        fileSize: context.fileSize
      },
      select: {
        id: true,
        conversationId: true,
        createdAt: true
      }
    });

    const updateResult = await tx.conversation.updateMany({
      where: {
        id: conversation.id,
        orgId: context.orgId
      },
      data: {
        lastMessageAt: created.createdAt,
        unreadCount: {
          increment: 1
        }
      }
    });

    if (updateResult.count !== 1) {
      throw new ServiceError(404, "CONVERSATION_NOT_FOUND", "Conversation does not exist.");
    }

    const updatedConversation = await tx.conversation.findFirst({
      where: {
        id: conversation.id,
        orgId: context.orgId
      },
      select: {
        status: true,
        assignedToMemberId: true
      }
    });

    if (!updatedConversation) {
      throw new ServiceError(404, "CONVERSATION_NOT_FOUND", "Conversation does not exist.");
    }

    return {
      id: created.id,
      conversationId: created.conversationId,
      conversationStatus: updatedConversation.status,
      assignedToMemberId: updatedConversation.assignedToMemberId
    };
  });
}
