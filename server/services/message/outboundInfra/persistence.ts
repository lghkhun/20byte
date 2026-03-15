import { MessageDirection } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import type { OutboundStoreResult } from "@/server/services/message/messageTypes";
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
}): Promise<void> {
  const updated = await prisma.message.updateMany({
    where: {
      id: params.messageId,
      orgId: params.orgId,
      direction: MessageDirection.OUTBOUND
    },
    data: {
      waMessageId: params.waMessageId ?? null,
      sendStatus: params.sendStatus,
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
}
