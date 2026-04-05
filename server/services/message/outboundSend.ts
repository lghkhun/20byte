import type { OutboundStoreResult, SendOutboundMessageInput } from "@/server/services/message/messageTypes";
import { prisma } from "@/lib/db/prisma";
import { readBaileysMediaFile } from "@/server/services/baileysService";
import {
  normalizeMessageText,
  normalize,
  normalizeSendError,
  normalizeSystemMessageText,
  normalizeTemplateComponents,
  normalizeTemplateLanguageCode
} from "@/server/services/message/messageUtils";
import { ServiceError } from "@/server/services/serviceError";
import {
  getConversationWithCustomer,
  getOrgWaConnection,
  publishConversationUpdated,
  publishMessageNewEventNonBlocking,
  requireInboxMembership,
  sendOutboundMediaWithRetry,
  sendOutboundTemplateWithRetry,
  sendOutboundTextWithRetry,
  storeOutboundRecord,
  updateOutboundSendResult
} from "@/server/services/message/outboundShared";

function toReplyPreviewText(input: { type: "TEXT" | "IMAGE" | "VIDEO" | "AUDIO" | "DOCUMENT" | "TEMPLATE" | "SYSTEM"; text?: string | null }): string {
  const normalizedText = normalizeMessageText(input.text ?? undefined);
  if (normalizedText) {
    return normalizedText.slice(0, 180);
  }

  switch (input.type) {
    case "IMAGE":
      return "Foto";
    case "VIDEO":
      return "Video";
    case "AUDIO":
      return "Audio";
    case "DOCUMENT":
      return "Dokumen";
    case "TEMPLATE":
      return "Template";
    case "SYSTEM":
      return "System message";
    default:
      return "Pesan";
  }
}

export async function sendOutboundMessage(input: SendOutboundMessageInput): Promise<OutboundStoreResult> {
  const orgId = normalize(input.orgId);
  const conversationId = normalize(input.conversationId);
  if (!orgId) {
    throw new ServiceError(400, "MISSING_ORG_ID", "orgId is required.");
  }

  if (!conversationId) {
    throw new ServiceError(400, "MISSING_CONVERSATION_ID", "conversationId is required.");
  }

  const dispatchMode = input.dispatchMode ?? "SYNC";

  await requireInboxMembership(input.actorUserId, orgId);
  const conversation = await getConversationWithCustomer(orgId, conversationId);
  const destinationJid = normalize(conversation.waChatJid ?? "") || undefined;
  const replyToMessageId = normalize(input.replyToMessageId ?? "");
  const replyTarget = replyToMessageId
    ? await prisma.message.findFirst({
        where: {
          id: replyToMessageId,
          orgId,
          conversationId: conversation.id
        },
        select: {
          id: true,
          waMessageId: true,
          type: true,
          text: true
        }
      })
    : null;

  if (replyToMessageId && !replyTarget) {
    throw new ServiceError(404, "REPLY_TARGET_NOT_FOUND", "Reply target message does not exist.");
  }

  const replyToWaMessageId = normalize(replyTarget?.waMessageId ?? "") || null;
  const replyPreviewText = replyTarget
    ? toReplyPreviewText({
        type: replyTarget.type as "TEXT" | "IMAGE" | "VIDEO" | "AUDIO" | "DOCUMENT" | "TEMPLATE" | "SYSTEM",
        text: replyTarget.text
      })
    : null;

  if (input.type === "SYSTEM") {
    const text = normalizeSystemMessageText(input.text ?? "");
    const result = await storeOutboundRecord({
      orgId,
      conversationId: conversation.id,
      type: "SYSTEM",
      replyToMessageId: replyTarget?.id ?? null,
      replyToWaMessageId,
      replyPreviewText,
      text
    });

    publishMessageNewEventNonBlocking({
      orgId,
      conversationId: conversation.id,
      messageId: result.messageId,
      direction: "OUTBOUND"
    });
    void publishConversationUpdated({
      orgId,
      conversationId: conversation.id,
      assignedToMemberId: conversation.assignedToMemberId,
      status: conversation.status
    });

    return result;
  }

  if (input.type === "TEXT") {
    const text = normalizeMessageText(input.text);
    if (!text) {
      throw new ServiceError(400, "INVALID_MESSAGE_TEXT", "Message text is required.");
    }

    const pending = await storeOutboundRecord({
      orgId,
      conversationId: conversation.id,
      type: "TEXT",
      replyToMessageId: replyTarget?.id ?? null,
      replyToWaMessageId,
      replyPreviewText,
      text,
      sendStatus: "PENDING",
      retryable: false
    });

    publishMessageNewEventNonBlocking({
      orgId,
      conversationId: conversation.id,
      messageId: pending.messageId,
      direction: "OUTBOUND"
    });
    void publishConversationUpdated({
      orgId,
      conversationId: conversation.id,
      assignedToMemberId: conversation.assignedToMemberId,
      status: conversation.status
    });

    const dispatchTextSend = async () => {
      const connection = await getOrgWaConnection(orgId);
      let waMessageId: string | null = null;
      try {
        waMessageId = await sendOutboundTextWithRetry({
          orgId: connection.orgId,
          to: conversation.customer.phoneE164,
          toJid: destinationJid,
          text,
          quotedWaMessageId: replyToWaMessageId ?? undefined
        });

        await updateOutboundSendResult({
          orgId,
          messageId: pending.messageId,
          waMessageId,
          sendStatus: "SENT",
          sendError: null,
          retryable: false
        });
      } catch (error) {
        await updateOutboundSendResult({
          orgId,
          messageId: pending.messageId,
          sendStatus: "FAILED",
          sendError: normalizeSendError(error),
          retryable: true
        });

        throw new ServiceError(502, "WHATSAPP_SEND_FAILED", "Failed to send outbound WhatsApp message.");
      }

      return {
        ...pending,
        waMessageId,
        sendStatus: "SENT" as const,
        deliveryStatus: "SENT" as const,
        sendError: null,
        retryable: false,
        sendAttemptCount: pending.sendAttemptCount + 1
      };
    };

    if (dispatchMode === "ASYNC") {
      void dispatchTextSend().catch((error) => {
        const message = error instanceof Error ? error.message : "Unknown outbound send error";
        console.error(`[outbound] async text send failed org=${orgId} conversationId=${conversation.id}: ${message}`);
      });
      return pending;
    }

    return dispatchTextSend();
  }

  if (input.type === "IMAGE" || input.type === "VIDEO" || input.type === "AUDIO" || input.type === "DOCUMENT") {
    const mediaType = input.type;
    const mediaId = input.mediaId;
    const mediaFileName = input.fileName;

    if (!mediaId || !input.mediaUrl || !mediaFileName) {
      throw new ServiceError(400, "INVALID_MEDIA_ATTACHMENT", "Attachment file is required.");
    }

    const pending = await storeOutboundRecord({
      orgId,
      conversationId: conversation.id,
      type: mediaType,
      replyToMessageId: replyTarget?.id ?? null,
      replyToWaMessageId,
      replyPreviewText,
      text: normalizeMessageText(input.text),
      mediaId,
      mediaUrl: input.mediaUrl,
      mimeType: normalize(input.mimeType ?? "") || undefined,
      fileName: mediaFileName,
      fileSize: input.fileSize,
      sendStatus: "PENDING",
      retryable: false
    });

    publishMessageNewEventNonBlocking({
      orgId,
      conversationId: conversation.id,
      messageId: pending.messageId,
      direction: "OUTBOUND"
    });
    void publishConversationUpdated({
      orgId,
      conversationId: conversation.id,
      assignedToMemberId: conversation.assignedToMemberId,
      status: conversation.status
    });

    const dispatchMediaSend = async () => {
      const connection = await getOrgWaConnection(orgId);
      let waMessageId: string | null = null;

      try {
        const mediaBuffer = await readBaileysMediaFile(orgId, mediaId);
        waMessageId = await sendOutboundMediaWithRetry({
          orgId: connection.orgId,
          to: conversation.customer.phoneE164,
          toJid: destinationJid,
          type: mediaType,
          fileName: mediaFileName,
          mimeType: input.mimeType,
          caption: input.text,
          quotedWaMessageId: replyToWaMessageId ?? undefined,
          buffer: mediaBuffer
        });

        await updateOutboundSendResult({
          orgId,
          messageId: pending.messageId,
          waMessageId,
          sendStatus: "SENT",
          sendError: null,
          retryable: false
        });
      } catch (error) {
        await updateOutboundSendResult({
          orgId,
          messageId: pending.messageId,
          sendStatus: "FAILED",
          sendError: normalizeSendError(error),
          retryable: true
        });

        throw new ServiceError(502, "WHATSAPP_MEDIA_SEND_FAILED", "Failed to send outbound attachment.");
      }

      return {
        ...pending,
        waMessageId,
        sendStatus: "SENT" as const,
        deliveryStatus: "SENT" as const,
        sendError: null,
        retryable: false,
        sendAttemptCount: pending.sendAttemptCount + 1
      };
    };

    if (dispatchMode === "ASYNC") {
      void dispatchMediaSend().catch((error) => {
        const message = error instanceof Error ? error.message : "Unknown outbound media send error";
        console.error(`[outbound] async media send failed org=${orgId} conversationId=${conversation.id}: ${message}`);
      });
      return pending;
    }

    return dispatchMediaSend();
  }

  const templateName = normalize(input.templateName ?? "");
  if (!templateName) {
    throw new ServiceError(400, "INVALID_TEMPLATE_NAME", "templateName is required for template messages.");
  }

  if (!Array.isArray(input.templateComponents)) {
    throw new ServiceError(400, "INVALID_TEMPLATE_COMPONENTS", "templateComponents array is required for template messages.");
  }

  const templateComponents = normalizeTemplateComponents(input.templateComponents);
  const templateLanguageCode = normalizeTemplateLanguageCode(input.templateLanguageCode);

  const pending = await storeOutboundRecord({
    orgId,
    conversationId: conversation.id,
    type: "TEMPLATE",
    replyToMessageId: replyTarget?.id ?? null,
    replyToWaMessageId,
    replyPreviewText,
    text: normalizeMessageText(input.text),
    templateName,
    templateCategory: input.templateCategory,
    templateLanguageCode,
    templateComponentsJson: JSON.stringify(templateComponents),
    sendStatus: "PENDING",
    retryable: false
  });

  publishMessageNewEventNonBlocking({
    orgId,
    conversationId: conversation.id,
    messageId: pending.messageId,
    direction: "OUTBOUND"
  });
  void publishConversationUpdated({
    orgId,
    conversationId: conversation.id,
    assignedToMemberId: conversation.assignedToMemberId,
    status: conversation.status
  });

  const dispatchTemplateSend = async () => {
    const connection = await getOrgWaConnection(orgId);
    let waMessageId: string | null = null;
    try {
      waMessageId = await sendOutboundTemplateWithRetry({
        orgId: connection.orgId,
        to: conversation.customer.phoneE164,
        toJid: destinationJid,
        templateName,
        languageCode: templateLanguageCode,
        components: templateComponents,
        quotedWaMessageId: replyToWaMessageId ?? undefined
      });

      await updateOutboundSendResult({
        orgId,
        messageId: pending.messageId,
        waMessageId,
        sendStatus: "SENT",
        sendError: null,
        retryable: false
      });
    } catch (error) {
      await updateOutboundSendResult({
        orgId,
        messageId: pending.messageId,
        sendStatus: "FAILED",
        sendError: normalizeSendError(error),
        retryable: true
      });

      throw new ServiceError(502, "WHATSAPP_TEMPLATE_SEND_FAILED", "Failed to send outbound template message.");
    }

    return {
      ...pending,
      waMessageId,
      sendStatus: "SENT" as const,
      deliveryStatus: "SENT" as const,
      sendError: null,
      retryable: false,
      sendAttemptCount: pending.sendAttemptCount + 1
    };
  };

  if (dispatchMode === "ASYNC") {
    void dispatchTemplateSend().catch((error) => {
      const message = error instanceof Error ? error.message : "Unknown outbound template send error";
      console.error(`[outbound] async template send failed org=${orgId} conversationId=${conversation.id}: ${message}`);
    });
    return pending;
  }

  return dispatchTemplateSend();
}
