import { MessageDirection, type MessageType, type Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { getOrCreateCustomer, getOrCreateOpenConversation } from "@/server/services/message/inboundInfra/customerConversation";
import { publishConversationUpdated, publishMessageNewEventNonBlocking } from "@/server/services/message/outboundShared";
import { normalize, normalizeFileSize, normalizeMessageText, normalizeOptional } from "@/server/services/message/messageUtils";
import { ServiceError } from "@/server/services/serviceError";

type StoreExternalOutboundInput = {
  orgId: string;
  customerPhoneE164: string;
  waChatJid?: string;
  waMessageId: string;
  replyToWaMessageId?: string;
  replyPreviewText?: string;
  customerDisplayName?: string;
  customerAvatarUrl?: string;
  type: MessageType;
  text?: string;
  mediaId?: string;
  mediaUrl?: string;
  mimeType?: string;
  fileName?: string;
  fileSize?: number;
  durationSec?: number;
};

type ExternalOutboundStoreResult = {
  stored: boolean;
  duplicate: boolean;
  messageId: string | null;
  conversationId: string | null;
  conversationStatus: "OPEN" | "CLOSED" | null;
  assignedToMemberId: string | null;
};

function emptyResult(duplicate = false, messageId: string | null = null): ExternalOutboundStoreResult {
  return {
    stored: false,
    duplicate,
    messageId,
    conversationId: null,
    conversationStatus: null,
    assignedToMemberId: null
  };
}

function normalizeContext(input: StoreExternalOutboundInput) {
  return {
    orgId: normalize(input.orgId),
    customerPhoneE164: normalize(input.customerPhoneE164),
    waChatJid: normalizeOptional(input.waChatJid),
    waMessageId: normalize(input.waMessageId),
    replyToWaMessageId: normalizeOptional(input.replyToWaMessageId),
    replyPreviewText: normalizeMessageText(input.replyPreviewText),
    customerDisplayName: normalizeOptional(input.customerDisplayName),
    customerAvatarUrl: normalizeOptional(input.customerAvatarUrl),
    type: input.type,
    text: normalizeMessageText(input.text),
    mediaId: normalizeOptional(input.mediaId),
    mediaUrl: normalizeOptional(input.mediaUrl),
    mimeType: normalizeOptional(input.mimeType),
    fileName: normalizeOptional(input.fileName),
    fileSize: normalizeFileSize(input.fileSize),
    durationSec:
      typeof input.durationSec === "number" && Number.isFinite(input.durationSec)
        ? Math.max(0, Math.floor(input.durationSec))
        : undefined
  };
}

async function findExistingByWaMessageId(waMessageId: string): Promise<{ id: string } | null> {
  return prisma.message.findUnique({
    where: { waMessageId },
    select: { id: true }
  });
}

function buildPendingMatchWhere(context: ReturnType<typeof normalizeContext>, conversationId: string): Prisma.MessageWhereInput {
  const base: Prisma.MessageWhereInput = {
    orgId: context.orgId,
    conversationId,
    direction: MessageDirection.OUTBOUND,
    sendStatus: "PENDING",
    waMessageId: null,
    type: context.type,
    createdAt: {
      gte: new Date(Date.now() - 2 * 60 * 1000)
    }
  };

  if (context.type === "TEXT" || context.type === "TEMPLATE" || context.type === "SYSTEM") {
    return {
      ...base,
      text: context.text ?? null
    };
  }

  return base;
}

export async function storeExternalOutboundMessage(input: StoreExternalOutboundInput): Promise<ExternalOutboundStoreResult> {
  const context = normalizeContext(input);
  if (!context.orgId || !context.customerPhoneE164 || !context.waMessageId) {
    return emptyResult();
  }

  const existing = await findExistingByWaMessageId(context.waMessageId);
  if (existing) {
    return emptyResult(true, existing.id);
  }

  const created = await prisma.$transaction(async (tx) => {
    const customer = await getOrCreateCustomer(
      tx,
      context.orgId,
      context.customerPhoneE164,
      context.customerDisplayName ?? undefined,
      context.customerAvatarUrl ?? undefined
    );
    const conversation = await getOrCreateOpenConversation(tx, context.orgId, customer.id, undefined, context.waChatJid);
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

    const pendingCandidate = await tx.message.findFirst({
      where: buildPendingMatchWhere(context, conversation.id),
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        conversationId: true
      }
    });

    if (pendingCandidate) {
      const updated = await tx.message.updateMany({
        where: {
          id: pendingCandidate.id,
          orgId: context.orgId,
          direction: MessageDirection.OUTBOUND
        },
        data: {
          waMessageId: context.waMessageId,
          sendStatus: "SENT",
          deliveryStatus: "SENT",
          sendError: null,
          retryable: false,
          sendAttemptCount: {
            increment: 1
          },
          lastSendAttemptAt: new Date()
        }
      });

      if (updated.count !== 1) {
        throw new ServiceError(404, "MESSAGE_NOT_FOUND", "Outbound pending message does not exist.");
      }

      return {
        id: pendingCandidate.id,
        conversationId: pendingCandidate.conversationId,
        conversationStatus: conversation.status,
        assignedToMemberId: conversation.assignedToMemberId
      };
    }

    const inserted = await tx.message.create({
      data: {
        orgId: context.orgId,
        conversationId: conversation.id,
        waMessageId: context.waMessageId,
        direction: MessageDirection.OUTBOUND,
        type: context.type,
        replyToMessageId: replyToMessage?.id ?? null,
        replyToWaMessageId,
        replyPreviewText: replyPreviewText ? replyPreviewText.slice(0, 180) : null,
        text: context.text,
        mediaId: context.mediaId,
        mediaUrl: context.mediaUrl,
        mimeType: context.mimeType,
        fileName: context.fileName,
        fileSize: context.fileSize,
        durationSec: context.durationSec,
        sendStatus: "SENT",
        deliveryStatus: "SENT",
        sendError: null,
        retryable: false,
        sendAttemptCount: 1,
        lastSendAttemptAt: new Date()
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
        lastMessageAt: inserted.createdAt
      }
    });
    if (updateResult.count !== 1) {
      throw new ServiceError(404, "CONVERSATION_NOT_FOUND", "Conversation does not exist.");
    }

    return {
      id: inserted.id,
      conversationId: inserted.conversationId,
      conversationStatus: conversation.status,
      assignedToMemberId: conversation.assignedToMemberId
    };
  });

  publishMessageNewEventNonBlocking({
    orgId: context.orgId,
    conversationId: created.conversationId,
    messageId: created.id,
    direction: "OUTBOUND"
  });
  void publishConversationUpdated({
    orgId: context.orgId,
    conversationId: created.conversationId,
    assignedToMemberId: created.assignedToMemberId,
    status: created.conversationStatus
  });

  return {
    stored: true,
    duplicate: false,
    messageId: created.id,
    conversationId: created.conversationId,
    conversationStatus: created.conversationStatus,
    assignedToMemberId: created.assignedToMemberId
  };
}
