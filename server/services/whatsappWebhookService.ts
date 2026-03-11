import { MessageType } from "@prisma/client";

import { extractInvisibleAttributionMarker } from "@/lib/ctwa/invisibleMarker";
import { prisma } from "@/lib/db/prisma";
import { acquireIdempotencyLock } from "@/lib/redis/idempotency";
import { normalizePossibleE164 } from "@/lib/whatsapp/e164";
import { enqueueWhatsAppMediaDownloadJob } from "@/server/queues/mediaQueue";
import { storeInboundMessage } from "@/server/services/messageService";
import { ServiceError } from "@/server/services/serviceError";

type WebhookMessageText = {
  body?: string;
};

type WebhookMessageImage = {
  id?: string;
  mime_type?: string;
  caption?: string;
  sha256?: string;
};

type WebhookMessageVideo = {
  id?: string;
  mime_type?: string;
  caption?: string;
  sha256?: string;
};

type WebhookMessageAudio = {
  id?: string;
  mime_type?: string;
  voice?: boolean;
  sha256?: string;
};

type WebhookMessageDocument = {
  id?: string;
  mime_type?: string;
  filename?: string;
  caption?: string;
  sha256?: string;
};

type WebhookInboundMessage = {
  id: string;
  from?: string;
  type?: string;
  text?: WebhookMessageText;
  image?: WebhookMessageImage;
  video?: WebhookMessageVideo;
  audio?: WebhookMessageAudio;
  document?: WebhookMessageDocument;
};

type WebhookChangeValue = {
  metadata?: {
    phone_number_id?: string;
  };
  contacts?: Array<{
    wa_id?: string;
    profile?: {
      name?: string;
    };
  }>;
  messages?: WebhookInboundMessage[];
};

type WebhookChange = {
  value?: WebhookChangeValue;
};

type WebhookEntry = {
  changes?: WebhookChange[];
};

type WebhookPayload = {
  object?: string;
  entry?: WebhookEntry[];
};

export type WebhookProcessResult = {
  receivedMessageCount: number;
  acceptedMessageCount: number;
  duplicateMessageCount: number;
  ignoredMessageCount: number;
  acceptedMessageIds: string[];
  duplicateMessageIds: string[];
};

function parseWebhookPayload(rawPayload: unknown): WebhookPayload {
  if (!rawPayload || typeof rawPayload !== "object") {
    throw new ServiceError(400, "INVALID_WEBHOOK_PAYLOAD", "Webhook payload is invalid.");
  }

  return rawPayload as WebhookPayload;
}

export function assertWhatsAppWebhookPayload(rawPayload: unknown): void {
  const payload = parseWebhookPayload(rawPayload);
  if (payload.object !== "whatsapp_business_account") {
    throw new ServiceError(400, "INVALID_WEBHOOK_OBJECT", "Unexpected webhook object type.");
  }
}

type ParsedInboundMessage = {
  orgId: string;
  waMessageId: string;
  customerPhoneE164: string;
  customerDisplayName?: string;
  shortlinkCode?: string;
  type: MessageType;
  text?: string;
  mediaId?: string;
  mimeType?: string;
  fileName?: string;
  fileSize?: number;
};

type InboundMessageStoreResult = Awaited<ReturnType<typeof storeInboundMessage>>;

type ProcessInboundMessagesDeps = {
  acquireLock: (key: string, ttlSeconds: number) => Promise<boolean>;
  storeInbound: (message: ParsedInboundMessage) => Promise<InboundMessageStoreResult>;
  enqueueMediaDownload: (messageId: string) => Promise<void>;
};

function mapWebhookMessageType(message: WebhookInboundMessage): MessageType | null {
  switch (message.type) {
    case "text":
      return MessageType.TEXT;
    case "image":
      return MessageType.IMAGE;
    case "video":
      return MessageType.VIDEO;
    case "audio":
      return MessageType.AUDIO;
    case "document":
      return MessageType.DOCUMENT;
    default:
      return null;
  }
}

function toInboundMessage(
  orgId: string,
  message: WebhookInboundMessage,
  contactByWaId: Map<string, string | undefined>
): ParsedInboundMessage | null {
  const waMessageId = message.id?.trim();
  const customerPhoneE164 = normalizePossibleE164(message.from);
  const mappedType = mapWebhookMessageType(message);

  if (!waMessageId || !customerPhoneE164 || !mappedType) {
    return null;
  }

  const customerDisplayName = contactByWaId.get(customerPhoneE164);
  if (mappedType === MessageType.TEXT) {
    const marker = extractInvisibleAttributionMarker(message.text?.body);
    return {
      orgId,
      waMessageId,
      customerPhoneE164,
      customerDisplayName,
      shortlinkCode: marker.shortlinkCode,
      type: MessageType.TEXT,
      text: marker.cleanText
    };
  }

  if (mappedType === MessageType.IMAGE) {
    return {
      orgId,
      waMessageId,
      customerPhoneE164,
      customerDisplayName,
      type: MessageType.IMAGE,
      text: message.image?.caption,
      mediaId: message.image?.id,
      mimeType: message.image?.mime_type
    };
  }

  if (mappedType === MessageType.VIDEO) {
    return {
      orgId,
      waMessageId,
      customerPhoneE164,
      customerDisplayName,
      type: MessageType.VIDEO,
      text: message.video?.caption,
      mediaId: message.video?.id,
      mimeType: message.video?.mime_type
    };
  }

  if (mappedType === MessageType.AUDIO) {
    return {
      orgId,
      waMessageId,
      customerPhoneE164,
      customerDisplayName,
      type: MessageType.AUDIO,
      mediaId: message.audio?.id,
      mimeType: message.audio?.mime_type
    };
  }

  if (mappedType === MessageType.DOCUMENT) {
    return {
      orgId,
      waMessageId,
      customerPhoneE164,
      customerDisplayName,
      type: MessageType.DOCUMENT,
      text: message.document?.caption,
      mediaId: message.document?.id,
      mimeType: message.document?.mime_type,
      fileName: message.document?.filename
    };
  }

  return null;
}

async function extractInboundMessages(payload: WebhookPayload): Promise<ParsedInboundMessage[]> {
  const messages: ParsedInboundMessage[] = [];
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const phoneNumberId = change.value?.metadata?.phone_number_id?.trim();
      if (!phoneNumberId) {
        continue;
      }

      const waAccount = await prisma.waAccount.findUnique({
        where: {
          phoneNumberId
        },
        select: {
          orgId: true
        }
      });

      if (!waAccount) {
        continue;
      }

      const contactByWaId = new Map<string, string | undefined>();
      for (const contact of change.value?.contacts ?? []) {
        const waId = normalizePossibleE164(contact.wa_id);
        if (!waId) {
          continue;
        }

        contactByWaId.set(waId, contact.profile?.name?.trim());
      }

      for (const message of change.value?.messages ?? []) {
        const parsed = toInboundMessage(waAccount.orgId, message, contactByWaId);
        if (parsed) {
          messages.push(parsed);
        }
      }
    }
  }

  return messages;
}

async function enqueueMediaDownloadIfFirst(messageId: string): Promise<void> {
  const lockKey = `idempotency:whatsapp:media-enqueue:${messageId}`;
  const acquired = await acquireIdempotencyLock(lockKey, 60 * 60 * 24);
  if (!acquired) {
    return;
  }

  await enqueueWhatsAppMediaDownloadJob({
    messageId
  });
}

export async function processInboundMessagesWithDeps(
  inboundMessages: ParsedInboundMessage[],
  deps: ProcessInboundMessagesDeps
): Promise<WebhookProcessResult> {
  if (inboundMessages.length === 0) {
    return {
      receivedMessageCount: 0,
      acceptedMessageCount: 0,
      duplicateMessageCount: 0,
      ignoredMessageCount: 0,
      acceptedMessageIds: [],
      duplicateMessageIds: []
    };
  }

  const acceptedMessageIds: string[] = [];
  const duplicateMessageIds: string[] = [];
  let ignoredMessageCount = 0;

  for (const inboundMessage of inboundMessages) {
    const lockKey = `idempotency:whatsapp:inbound:${inboundMessage.waMessageId}`;
    const acquired = await deps.acquireLock(lockKey, 60 * 60 * 24);
    if (!acquired) {
      duplicateMessageIds.push(inboundMessage.waMessageId);
      continue;
    }

    const result = await deps.storeInbound(inboundMessage);

    if (result.duplicate) {
      duplicateMessageIds.push(inboundMessage.waMessageId);
      if (inboundMessage.mediaId && result.messageId) {
        await deps.enqueueMediaDownload(result.messageId);
      }
      continue;
    }

    if (result.stored) {
      acceptedMessageIds.push(inboundMessage.waMessageId);
      if (inboundMessage.mediaId && result.messageId) {
        await deps.enqueueMediaDownload(result.messageId);
      }
      continue;
    }

    ignoredMessageCount += 1;
  }

  return {
    receivedMessageCount: inboundMessages.length,
    acceptedMessageCount: acceptedMessageIds.length,
    duplicateMessageCount: duplicateMessageIds.length,
    ignoredMessageCount,
    acceptedMessageIds,
    duplicateMessageIds
  };
}

export async function processWhatsAppWebhookPayload(rawPayload: unknown): Promise<WebhookProcessResult> {
  const payload = parseWebhookPayload(rawPayload);
  assertWhatsAppWebhookPayload(payload);

  const inboundMessages = await extractInboundMessages(payload);
  return processInboundMessagesWithDeps(inboundMessages, {
    acquireLock: acquireIdempotencyLock,
    storeInbound: async (inboundMessage) =>
      storeInboundMessage({
        orgId: inboundMessage.orgId,
        customerPhoneE164: inboundMessage.customerPhoneE164,
        customerDisplayName: inboundMessage.customerDisplayName,
        shortlinkCode: inboundMessage.shortlinkCode,
        waMessageId: inboundMessage.waMessageId,
        type: inboundMessage.type,
        text: inboundMessage.text,
        mediaId: inboundMessage.mediaId,
        mimeType: inboundMessage.mimeType,
        fileName: inboundMessage.fileName,
        fileSize: inboundMessage.fileSize
      }),
    enqueueMediaDownload: enqueueMediaDownloadIfFirst
  });
}
