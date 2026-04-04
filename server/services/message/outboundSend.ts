import type { OutboundStoreResult, SendOutboundMessageInput } from "@/server/services/message/messageTypes";
import { readBaileysMediaFile } from "@/server/services/baileysService";
import {
  normalize,
  normalizeOptional,
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

export async function sendOutboundMessage(input: SendOutboundMessageInput): Promise<OutboundStoreResult> {
  const orgId = normalize(input.orgId);
  const conversationId = normalize(input.conversationId);
  if (!orgId) {
    throw new ServiceError(400, "MISSING_ORG_ID", "orgId is required.");
  }

  if (!conversationId) {
    throw new ServiceError(400, "MISSING_CONVERSATION_ID", "conversationId is required.");
  }

  await requireInboxMembership(input.actorUserId, orgId);
  const conversation = await getConversationWithCustomer(orgId, conversationId);

  if (input.type === "SYSTEM") {
    const text = normalizeSystemMessageText(input.text ?? "");
    const result = await storeOutboundRecord({
      orgId,
      conversationId: conversation.id,
      type: "SYSTEM",
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
    const text = normalize(input.text ?? "");
    if (!text) {
      throw new ServiceError(400, "INVALID_MESSAGE_TEXT", "Message text is required.");
    }

    const pending = await storeOutboundRecord({
      orgId,
      conversationId: conversation.id,
      type: "TEXT",
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

    const connection = await getOrgWaConnection(orgId);
    let waMessageId: string | null = null;
    try {
      waMessageId = await sendOutboundTextWithRetry({
        orgId: connection.orgId,
        to: conversation.customer.phoneE164,
        text
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
      sendStatus: "SENT",
      deliveryStatus: "SENT",
      sendError: null,
      retryable: false,
      sendAttemptCount: pending.sendAttemptCount + 1
    };
  }

  if (input.type === "IMAGE" || input.type === "VIDEO" || input.type === "AUDIO" || input.type === "DOCUMENT") {
    if (!input.mediaId || !input.mediaUrl || !input.fileName) {
      throw new ServiceError(400, "INVALID_MEDIA_ATTACHMENT", "Attachment file is required.");
    }

    const pending = await storeOutboundRecord({
      orgId,
      conversationId: conversation.id,
      type: input.type,
      text: normalizeOptional(input.text),
      mediaId: input.mediaId,
      mediaUrl: input.mediaUrl,
      mimeType: normalizeOptional(input.mimeType),
      fileName: input.fileName,
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

    const connection = await getOrgWaConnection(orgId);
    let waMessageId: string | null = null;

    try {
      const mediaBuffer = await readBaileysMediaFile(orgId, input.mediaId);
      waMessageId = await sendOutboundMediaWithRetry({
        orgId: connection.orgId,
        to: conversation.customer.phoneE164,
        type: input.type,
        fileName: input.fileName,
        mimeType: input.mimeType,
        caption: input.text,
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
      sendStatus: "SENT",
      deliveryStatus: "SENT",
      sendError: null,
      retryable: false,
      sendAttemptCount: pending.sendAttemptCount + 1
    };
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
    text: normalizeOptional(input.text),
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

  const connection = await getOrgWaConnection(orgId);
  let waMessageId: string | null = null;
  try {
    waMessageId = await sendOutboundTemplateWithRetry({
      orgId: connection.orgId,
      to: conversation.customer.phoneE164,
      templateName,
      languageCode: templateLanguageCode,
      components: templateComponents
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
    sendStatus: "SENT",
    deliveryStatus: "SENT",
    sendError: null,
    retryable: false,
    sendAttemptCount: pending.sendAttemptCount + 1
  };
}
