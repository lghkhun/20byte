import { MessageDirection, type Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import type { ResolvedAttribution, StoreInboundMessageInput } from "@/server/services/message/messageTypes";
import { ServiceError } from "@/server/services/serviceError";

type InboundContext = {
  orgId: string;
  customerPhoneE164: string;
  waChatJid?: string;
  waMessageId: string;
  customerDisplayName?: string;
  customerAvatarUrl?: string;
  trackingId?: string;
  replyToWaMessageId?: string;
  replyPreviewText?: string;
  text?: string;
  mediaId?: string;
  mediaUrl?: string;
  mimeType?: string;
  fileName?: string;
  fileSize?: number;
  durationSec?: number;
  type: StoreInboundMessageInput["type"];
};

type CreatedInboundMessage = {
  id: string;
  conversationId: string;
  conversationStatus: "OPEN" | "CLOSED";
  assignedToMemberId: string | null;
  conversationCreated: boolean;
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
    created: boolean;
  }>;
}): Promise<CreatedInboundMessage> {
  const { context } = params;

  return prisma.$transaction(async (tx) => {
    const attribution = await params.resolveAttribution(tx);
    const customer = await params.getOrCreateCustomer(tx, attribution);
    const conversation = await params.getOrCreateConversation(tx, customer.id, attribution, customer);
    const replyToWaMessageId = context.replyToWaMessageId?.trim() || null;
    const replyToMessage = replyToWaMessageId
      ? await tx.message.findFirst({
          where: {
            orgId: context.orgId,
            conversationId: conversation.id,
            waMessageId: replyToWaMessageId
          },
          select: {
            id: true,
            text: true,
            type: true
          }
        })
      : null;

    const replyPreviewText =
      context.replyPreviewText?.trim() ||
      replyToMessage?.text?.trim() ||
      (replyToMessage
        ? replyToMessage.type === "IMAGE"
          ? "Foto"
          : replyToMessage.type === "VIDEO"
            ? "Video"
            : replyToMessage.type === "AUDIO"
              ? "Audio"
              : replyToMessage.type === "DOCUMENT"
                ? "Dokumen"
                : replyToMessage.type === "TEMPLATE"
                  ? "Template"
                  : "Pesan"
        : null);

    const created = await tx.message.create({
      data: {
        orgId: context.orgId,
        conversationId: conversation.id,
        waMessageId: context.waMessageId,
        replyToMessageId: replyToMessage?.id ?? null,
        replyToWaMessageId,
        replyPreviewText: replyPreviewText ? replyPreviewText.slice(0, 180) : null,
        direction: MessageDirection.INBOUND,
        type: context.type,
        text: context.text,
        mediaId: context.mediaId,
        mediaUrl: context.mediaUrl,
        mimeType: context.mimeType,
        fileName: context.fileName,
        fileSize: context.fileSize,
        durationSec: context.durationSec
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
      assignedToMemberId: updatedConversation.assignedToMemberId,
      conversationCreated: conversation.created
    };
  });
}
