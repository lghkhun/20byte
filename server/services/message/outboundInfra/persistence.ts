import { MessageDirection } from "@prisma/client";

import { publishMessageStatusEvent } from "@/lib/ably/publisher";
import { prisma } from "@/lib/db/prisma";
import type { OutboundStoreResult } from "@/server/services/message/messageTypes";
import { resolveNextDeliveryState } from "@/server/services/message/statusTransitions";
import { ServiceError } from "@/server/services/serviceError";

export async function storeOutboundRecord(params: {
  orgId: string;
  conversationId: string;
  type: "TEXT" | "IMAGE" | "VIDEO" | "AUDIO" | "DOCUMENT" | "TEMPLATE" | "SYSTEM";
  text?: string;
  mediaId?: string | null;
  mediaUrl?: string | null;
  mimeType?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
  waMessageId?: string | null;
  templateName?: string;
  templateCategory?: "MARKETING" | "UTILITY" | "AUTHENTICATION" | "SERVICE";
  templateLanguageCode?: string;
  templateComponentsJson?: string | null;
  sendStatus?: "PENDING" | "SENT" | "FAILED";
  deliveryStatus?: "SENT" | "DELIVERED" | "READ" | null;
  sendError?: string | null;
  retryable?: boolean;
  incrementAttemptCount?: boolean;
}): Promise<OutboundStoreResult> {
  const createdMessage = await prisma.$transaction(async (tx) => {
    const created = await tx.message.create({
      data: {
        orgId: params.orgId,
        conversationId: params.conversationId,
        waMessageId: params.waMessageId ?? null,
        direction: MessageDirection.OUTBOUND,
        type: params.type,
        text: params.text,
        mediaId: params.mediaId ?? null,
        mediaUrl: params.mediaUrl ?? null,
        mimeType: params.mimeType ?? null,
        fileName: params.fileName ?? null,
        fileSize: params.fileSize ?? null,
        templateName: params.templateName,
        templateCategory: params.templateCategory,
        templateLanguageCode: params.templateLanguageCode,
        templateComponentsJson: params.templateComponentsJson,
        sendStatus: params.sendStatus ?? "SENT",
        deliveryStatus: params.deliveryStatus ?? (params.sendStatus === "SENT" || !params.sendStatus ? "SENT" : null),
        sendError: params.sendError ?? null,
        retryable: params.retryable ?? false,
        sendAttemptCount: params.incrementAttemptCount ? 1 : 0,
        lastSendAttemptAt: params.incrementAttemptCount ? new Date() : null
      },
      select: {
        id: true,
        waMessageId: true,
        type: true,
        sendStatus: true,
        deliveryStatus: true,
        sendError: true,
        retryable: true,
        sendAttemptCount: true,
        createdAt: true
      }
    });

    await tx.conversation.updateMany({
      where: {
        id: params.conversationId,
        orgId: params.orgId
      },
      data: {
        lastMessageAt: created.createdAt
      }
    });

    return created;
  });

  return {
    messageId: createdMessage.id,
    waMessageId: createdMessage.waMessageId,
    type: createdMessage.type as "TEXT" | "IMAGE" | "VIDEO" | "AUDIO" | "DOCUMENT" | "TEMPLATE" | "SYSTEM",
    sendStatus: createdMessage.sendStatus ?? "SENT",
    deliveryStatus: (createdMessage.deliveryStatus as "SENT" | "DELIVERED" | "READ" | null) ?? null,
    sendError: createdMessage.sendError ?? null,
    retryable: createdMessage.retryable,
    sendAttemptCount: createdMessage.sendAttemptCount,
    createdAt: createdMessage.createdAt
  };
}

export async function updateOutboundSendResult(params: {
  orgId: string;
  messageId: string;
  waMessageId?: string | null;
  sendStatus: "PENDING" | "SENT" | "FAILED";
  sendError: string | null;
  retryable: boolean;
}): Promise<{
  messageId: string;
  conversationId: string;
  sendStatus: "PENDING" | "SENT" | "FAILED" | null;
  deliveryStatus: "SENT" | "DELIVERED" | "READ" | null;
  sendError: string | null;
  retryable: boolean;
  sendAttemptCount: number;
  deliveredAt: Date | null;
  readAt: Date | null;
}> {
  const updated = await prisma.message.updateMany({
    where: {
      id: params.messageId,
      orgId: params.orgId,
      direction: MessageDirection.OUTBOUND
    },
    data: {
      waMessageId: params.waMessageId ?? null,
      sendStatus: params.sendStatus,
      deliveryStatus: params.sendStatus === "SENT" ? "SENT" : null,
      sendError: params.sendError,
      retryable: params.retryable,
      sendAttemptCount: {
        increment: 1
      },
      lastSendAttemptAt: new Date()
    }
  });

  if (updated.count !== 1) {
    throw new ServiceError(404, "MESSAGE_NOT_FOUND", "Outbound message does not exist.");
  }

  const refreshed = await prisma.message.findFirst({
    where: {
      id: params.messageId,
      orgId: params.orgId,
      direction: MessageDirection.OUTBOUND
    },
    select: {
      id: true,
      conversationId: true,
      sendStatus: true,
      deliveryStatus: true,
      sendError: true,
      retryable: true,
      sendAttemptCount: true,
      deliveredAt: true,
      readAt: true
    }
  });

  if (!refreshed) {
    throw new ServiceError(404, "MESSAGE_NOT_FOUND", "Outbound message does not exist.");
  }

  await publishMessageStatusEvent({
    orgId: params.orgId,
    conversationId: refreshed.conversationId,
    messageId: refreshed.id,
    sendStatus: refreshed.sendStatus,
    deliveryStatus: refreshed.deliveryStatus as "SENT" | "DELIVERED" | "READ" | null,
    sendError: refreshed.sendError,
    retryable: refreshed.retryable,
    sendAttemptCount: refreshed.sendAttemptCount,
    deliveredAt: refreshed.deliveredAt,
    readAt: refreshed.readAt
  });

  return {
    messageId: refreshed.id,
    conversationId: refreshed.conversationId,
    sendStatus: refreshed.sendStatus,
    deliveryStatus: refreshed.deliveryStatus as "SENT" | "DELIVERED" | "READ" | null,
    sendError: refreshed.sendError,
    retryable: refreshed.retryable,
    sendAttemptCount: refreshed.sendAttemptCount,
    deliveredAt: refreshed.deliveredAt,
    readAt: refreshed.readAt
  };
}

export async function updateOutboundDeliveryStatusByWaMessageId(params: {
  orgId: string;
  waMessageId: string;
  deliveryStatus: "SENT" | "DELIVERED" | "READ";
  at?: Date;
}): Promise<{
  messageId: string;
  conversationId: string;
  sendStatus: "PENDING" | "SENT" | "FAILED" | null;
  deliveryStatus: "SENT" | "DELIVERED" | "READ" | null;
  sendError: string | null;
  retryable: boolean;
  sendAttemptCount: number;
  deliveredAt: Date | null;
  readAt: Date | null;
  conversationStatus: "OPEN" | "CLOSED";
  assignedToMemberId: string | null;
} | null> {
  const existing = await prisma.message.findFirst({
    where: {
      orgId: params.orgId,
      direction: MessageDirection.OUTBOUND,
      waMessageId: params.waMessageId
    },
    select: {
      id: true,
      conversationId: true,
      sendStatus: true,
      sendError: true,
      retryable: true,
      sendAttemptCount: true,
      deliveryStatus: true,
      deliveredAt: true,
      readAt: true,
      conversation: {
        select: {
          status: true,
          assignedToMemberId: true
        }
      }
    }
  });

  if (!existing) {
    return null;
  }

  const at = params.at ?? new Date();
  const nextState = resolveNextDeliveryState({
    currentStatus: existing.deliveryStatus as "SENT" | "DELIVERED" | "READ" | null,
    currentDeliveredAt: existing.deliveredAt,
    currentReadAt: existing.readAt,
    incomingStatus: params.deliveryStatus,
    at
  });

  let nextDeliveryStatus = existing.deliveryStatus as "SENT" | "DELIVERED" | "READ" | null;
  let nextDeliveredAt = existing.deliveredAt;
  let nextReadAt = existing.readAt;

  if (nextState.shouldPersist) {
    const updateResult = await prisma.message.updateMany({
      where: {
        id: existing.id,
        orgId: params.orgId,
        direction: MessageDirection.OUTBOUND
      },
      data: {
        deliveryStatus: nextState.deliveryStatus ?? undefined,
        deliveredAt: nextState.deliveredAt ?? undefined,
        readAt: nextState.readAt ?? undefined
      }
    });

    if (updateResult.count !== 1) {
      throw new ServiceError(404, "MESSAGE_NOT_FOUND", "Outbound message does not exist.");
    }

    const updatedMessage = await prisma.message.findFirst({
      where: {
        id: existing.id,
        orgId: params.orgId,
        direction: MessageDirection.OUTBOUND
      },
      select: {
        deliveryStatus: true,
        deliveredAt: true,
        readAt: true
      }
    });

    if (!updatedMessage) {
      throw new ServiceError(404, "MESSAGE_NOT_FOUND", "Outbound message does not exist.");
    }

    nextDeliveryStatus = updatedMessage.deliveryStatus as "SENT" | "DELIVERED" | "READ" | null;
    nextDeliveredAt = updatedMessage.deliveredAt;
    nextReadAt = updatedMessage.readAt;

    await publishMessageStatusEvent({
      orgId: params.orgId,
      conversationId: existing.conversationId,
      messageId: existing.id,
      sendStatus: existing.sendStatus,
      deliveryStatus: nextDeliveryStatus,
      sendError: existing.sendError,
      retryable: existing.retryable,
      sendAttemptCount: existing.sendAttemptCount,
      deliveredAt: nextDeliveredAt,
      readAt: nextReadAt
    });
  }

  return {
    messageId: existing.id,
    conversationId: existing.conversationId,
    sendStatus: existing.sendStatus,
    deliveryStatus: nextDeliveryStatus,
    sendError: existing.sendError,
    retryable: existing.retryable,
    sendAttemptCount: existing.sendAttemptCount,
    deliveredAt: nextDeliveredAt,
    readAt: nextReadAt,
    conversationStatus: existing.conversation.status,
    assignedToMemberId: existing.conversation.assignedToMemberId
  };
}
