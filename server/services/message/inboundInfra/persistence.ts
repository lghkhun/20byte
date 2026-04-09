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
  senderWaJid?: string;
  senderPhoneE164?: string;
  senderDisplayName?: string;
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
  const isGroupChat = Boolean(context.waChatJid?.endsWith("@g.us"));

  const senderDisplayName = (context.senderDisplayName?.trim() || null)?.slice(0, 191) ?? null;
  const senderPhoneE164 = (context.senderPhoneE164?.trim() || null)?.slice(0, 191) ?? null;
  const senderWaJid = (context.senderWaJid?.trim() || null)?.slice(0, 191) ?? null;
  const senderLabel = senderDisplayName || senderPhoneE164 || null;

  function toParticipantLabel(value: string | null): string | null {
    const normalized = value?.trim() ?? "";
    if (!normalized) {
      return null;
    }
    return normalized.length > 191 ? normalized.slice(0, 191) : normalized;
  }

  function mergeGroupParticipantsJson(currentRaw: string | null, candidate: string | null): string | null {
    const normalizedCandidate = toParticipantLabel(candidate);
    if (!normalizedCandidate) {
      return currentRaw;
    }

    let existing: string[] = [];
    if (currentRaw) {
      try {
        const parsed = JSON.parse(currentRaw) as unknown;
        if (Array.isArray(parsed)) {
          existing = parsed
            .map((item) => (typeof item === "string" ? toParticipantLabel(item) : null))
            .filter((item): item is string => Boolean(item));
        }
      } catch {
        existing = [];
      }
    }

    if (!existing.includes(normalizedCandidate)) {
      existing.push(normalizedCandidate);
    }

    return JSON.stringify(existing.slice(0, 120));
  }

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
            type: true,
            senderDisplayName: true,
            senderPhoneE164: true
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
    const replyPreviewSenderName = replyToMessage
      ? replyToMessage.senderDisplayName?.trim() || replyToMessage.senderPhoneE164?.trim() || null
      : null;

    const created = await tx.message.create({
      data: {
        orgId: context.orgId,
        conversationId: conversation.id,
        waMessageId: context.waMessageId,
        replyToMessageId: replyToMessage?.id ?? null,
        replyToWaMessageId,
        replyPreviewText: replyPreviewText ? replyPreviewText.slice(0, 180) : null,
        replyPreviewSenderName: replyPreviewSenderName ? replyPreviewSenderName.slice(0, 191) : null,
        senderWaJid,
        senderPhoneE164,
        senderDisplayName,
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

    const existingConversation = await tx.conversation.findFirst({
      where: {
        id: conversation.id,
        orgId: context.orgId
      },
      select: {
        groupParticipantsJson: true
      }
    });
    const mergedGroupParticipantsJson = isGroupChat
      ? mergeGroupParticipantsJson(existingConversation?.groupParticipantsJson ?? null, senderLabel)
      : undefined;

    const updateResult = await tx.conversation.updateMany({
      where: {
        id: conversation.id,
        orgId: context.orgId
      },
      data: {
        lastMessageAt: created.createdAt,
        lastMessageSenderName: isGroupChat ? senderLabel : context.customerDisplayName ?? senderLabel,
        ...(isGroupChat
          ? { groupParticipantsJson: mergedGroupParticipantsJson ?? existingConversation?.groupParticipantsJson ?? null }
          : {}),
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
