import { MessageDirection, MessageType } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { readBaileysMediaFile } from "@/server/services/baileysService";
import type { OutboundStoreResult, RetryOutboundMessageInput } from "@/server/services/message/messageTypes";
import { normalize, normalizeSendError, normalizeTemplateLanguageCode, parseTemplateComponentsJson } from "@/server/services/message/messageUtils";
import { isRetryableOutboundType } from "@/server/services/message/retryPolicy";
import { ServiceError } from "@/server/services/serviceError";
import {
  getOrgWaConnection,
  requireInboxMembership,
  sendOutboundMediaWithRetry,
  sendOutboundTemplateWithRetry,
  sendOutboundTextWithRetry,
  updateOutboundSendResult
} from "@/server/services/message/outboundShared";
export { isRetryableOutboundType } from "@/server/services/message/retryPolicy";

export async function retryOutboundMessage(input: RetryOutboundMessageInput): Promise<OutboundStoreResult> {
  const orgId = normalize(input.orgId);
  const messageId = normalize(input.messageId);
  if (!orgId) {
    throw new ServiceError(400, "MISSING_ORG_ID", "orgId is required.");
  }

  if (!messageId) {
    throw new ServiceError(400, "MISSING_MESSAGE_ID", "messageId is required.");
  }

  await requireInboxMembership(input.actorUserId, orgId);

  const message = await prisma.message.findFirst({
    where: {
      id: messageId,
      orgId,
      direction: MessageDirection.OUTBOUND,
      sendStatus: "FAILED"
    },
    select: {
      id: true,
      createdAt: true,
      sendAttemptCount: true,
      conversationId: true,
      type: true,
      text: true,
      mediaId: true,
      fileName: true,
      mimeType: true,
      templateName: true,
      templateCategory: true,
      templateLanguageCode: true,
      templateComponentsJson: true,
      conversation: {
        select: {
          customer: {
            select: {
              phoneE164: true
            }
          }
        }
      }
    }
  });

  if (!message) {
    throw new ServiceError(404, "FAILED_MESSAGE_NOT_FOUND", "Failed outbound message not found.");
  }

  const isRetryableType = isRetryableOutboundType(message.type);
  if (!isRetryableType) {
    throw new ServiceError(400, "MESSAGE_NOT_RETRYABLE", "Only TEXT, TEMPLATE, or media outbound messages can be retried.");
  }

  const connection = await getOrgWaConnection(orgId);
  try {
    let waMessageId: string | null = null;

    if (message.type === MessageType.TEXT) {
      const text = normalize(message.text ?? "");
      if (!text) {
        throw new ServiceError(400, "INVALID_MESSAGE_TEXT", "Message text is empty.");
      }

      waMessageId = await sendOutboundTextWithRetry({
        orgId: connection.orgId,
        to: message.conversation.customer.phoneE164,
        text
      });
    } else if (message.type === MessageType.TEMPLATE) {
      const templateName = normalize(message.templateName ?? "");
      if (!templateName) {
        throw new ServiceError(400, "INVALID_TEMPLATE_NAME", "Template name is empty.");
      }

      waMessageId = await sendOutboundTemplateWithRetry({
        orgId: connection.orgId,
        to: message.conversation.customer.phoneE164,
        templateName,
        languageCode: normalizeTemplateLanguageCode(message.templateLanguageCode ?? "en"),
        components: parseTemplateComponentsJson(message.templateComponentsJson)
      });
    } else {
      if (!message.mediaId || !message.fileName) {
        throw new ServiceError(400, "INVALID_MEDIA_ATTACHMENT", "Attachment media payload is incomplete.");
      }

      const mediaBuffer = await readBaileysMediaFile(orgId, message.mediaId);
      waMessageId = await sendOutboundMediaWithRetry({
        orgId: connection.orgId,
        to: message.conversation.customer.phoneE164,
        type: message.type as "IMAGE" | "VIDEO" | "AUDIO" | "DOCUMENT",
        fileName: message.fileName,
        mimeType: message.mimeType ?? undefined,
        caption: message.text ?? undefined,
        buffer: mediaBuffer
      });
    }

    await updateOutboundSendResult({
      orgId,
      messageId: message.id,
      waMessageId,
      sendStatus: "SENT",
      sendError: null,
      retryable: false
    });

    return {
      messageId: message.id,
      waMessageId,
      type: message.type as "TEXT" | "IMAGE" | "VIDEO" | "AUDIO" | "DOCUMENT" | "TEMPLATE" | "SYSTEM",
      sendStatus: "SENT",
      deliveryStatus: "SENT",
      sendError: null,
      retryable: false,
      sendAttemptCount: message.sendAttemptCount + 1,
      createdAt: message.createdAt
    };
  } catch (error) {
    await updateOutboundSendResult({
      orgId,
      messageId: message.id,
      sendStatus: "FAILED",
      sendError: normalizeSendError(error),
      retryable: true
    });

    throw new ServiceError(502, "RETRY_OUTBOUND_FAILED", "Failed to retry outbound message.");
  }
}
