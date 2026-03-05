import { ConversationStatus, MessageDirection, MessageType, Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { canAccessInbox } from "@/lib/permissions/orgPermissions";
import { publishMessageNewEvent } from "@/lib/realtime/ably";
import { decryptSensitiveToken } from "@/lib/security/tokenCipher";
import { ServiceError } from "@/server/services/serviceError";
import { sendWhatsAppTemplateMessage, sendWhatsAppTextMessage } from "@/server/services/whatsappApiService";

type StoreInboundMessageInput = {
  orgId: string;
  customerPhoneE164: string;
  customerDisplayName?: string;
  waMessageId: string;
  type: MessageType;
  text?: string;
  mediaId?: string;
  mimeType?: string;
  fileName?: string;
  fileSize?: number;
};

type InboundStoreResult = {
  stored: boolean;
  duplicate: boolean;
  messageId: string | null;
  conversationId: string | null;
};

type SendOutboundMessageInput = {
  actorUserId: string;
  orgId: string;
  conversationId: string;
  type: "TEXT" | "TEMPLATE" | "SYSTEM";
  text?: string;
  templateName?: string;
  templateCategory?: "MARKETING" | "UTILITY" | "AUTHENTICATION" | "SERVICE";
  templateLanguageCode?: string;
};

type OutboundStoreResult = {
  messageId: string;
  waMessageId: string | null;
  type: "TEXT" | "TEMPLATE" | "SYSTEM";
  createdAt: Date;
};

type ListMessagesInput = {
  actorUserId: string;
  orgId: string;
  conversationId: string;
  page?: number;
  limit?: number;
};

type MessageListItem = {
  id: string;
  waMessageId: string | null;
  direction: MessageDirection;
  type: MessageType;
  text: string | null;
  mediaUrl: string | null;
  mimeType: string | null;
  fileName: string | null;
  templateName: string | null;
  templateCategory: string | null;
  isAutomated: boolean;
  createdAt: Date;
};

type MessageListResult = {
  messages: MessageListItem[];
  page: number;
  limit: number;
  total: number;
};

function publishMessageNewEventNonBlocking(input: {
  orgId: string;
  conversationId: string;
  messageId: string;
  direction: "INBOUND" | "OUTBOUND";
}): void {
  void publishMessageNewEvent(input);
}

function normalize(value: string): string {
  return value.trim();
}

function normalizeOptional(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = normalize(value);
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeFileSize(value: number | undefined): number | undefined {
  if (value === undefined || Number.isNaN(value) || value < 0) {
    return undefined;
  }

  return Math.floor(value);
}

function normalizePage(value: number | undefined): number {
  if (!value || Number.isNaN(value) || value < 1) {
    return 1;
  }

  return Math.floor(value);
}

function normalizeLimit(value: number | undefined): number {
  if (!value || Number.isNaN(value) || value < 1) {
    return 30;
  }

  return Math.min(100, Math.floor(value));
}

async function getOrCreateCustomer(
  tx: Prisma.TransactionClient,
  orgId: string,
  customerPhoneE164: string,
  customerDisplayName?: string
) {
  return tx.customer.upsert({
    where: {
      orgId_phoneE164: {
        orgId,
        phoneE164: customerPhoneE164
      }
    },
    update: customerDisplayName
      ? {
          displayName: customerDisplayName
        }
      : {},
    create: {
      orgId,
      phoneE164: customerPhoneE164,
      displayName: customerDisplayName ?? null,
      firstContactAt: new Date()
    },
    select: {
      id: true
    }
  });
}

async function getOrCreateOpenConversation(tx: Prisma.TransactionClient, orgId: string, customerId: string) {
  const existingOpenConversation = await tx.conversation.findFirst({
    where: {
      orgId,
      customerId,
      status: ConversationStatus.OPEN
    },
    orderBy: {
      updatedAt: "desc"
    },
    select: {
      id: true
    }
  });

  if (existingOpenConversation) {
    return existingOpenConversation;
  }

  return tx.conversation.create({
    data: {
      orgId,
      customerId,
      status: ConversationStatus.OPEN
    },
    select: {
      id: true
    }
  });
}

export async function storeInboundMessage(input: StoreInboundMessageInput): Promise<InboundStoreResult> {
  const orgId = normalize(input.orgId);
  const customerPhoneE164 = normalize(input.customerPhoneE164);
  const waMessageId = normalize(input.waMessageId);
  const customerDisplayName = normalizeOptional(input.customerDisplayName);
  const text = normalizeOptional(input.text);
  const mediaId = normalizeOptional(input.mediaId);
  const mimeType = normalizeOptional(input.mimeType);
  const fileName = normalizeOptional(input.fileName);
  const fileSize = normalizeFileSize(input.fileSize);

  if (!orgId || !customerPhoneE164 || !waMessageId) {
    return {
      stored: false,
      duplicate: false,
      messageId: null,
      conversationId: null
    };
  }

  const existing = await prisma.message.findUnique({
    where: {
      waMessageId
    },
    select: {
      id: true
    }
  });

  if (existing) {
    return {
      stored: false,
      duplicate: true,
      messageId: existing.id,
      conversationId: null
    };
  }

  const createdMessage = await prisma.$transaction(async (tx) => {
    const customer = await getOrCreateCustomer(tx, orgId, customerPhoneE164, customerDisplayName);
    const conversation = await getOrCreateOpenConversation(tx, orgId, customer.id);

    const created = await tx.message.create({
      data: {
        orgId,
        conversationId: conversation.id,
        waMessageId,
        direction: MessageDirection.INBOUND,
        type: input.type,
        text,
        mediaId,
        mimeType,
        fileName,
        fileSize
      },
      select: {
        id: true,
        conversationId: true,
        createdAt: true
      }
    });

    await tx.conversation.update({
      where: {
        id: conversation.id
      },
      data: {
        lastMessageAt: created.createdAt,
        unreadCount: {
          increment: 1
        }
      }
    });

    return created;
  });

  publishMessageNewEventNonBlocking({
    orgId,
    conversationId: createdMessage.conversationId,
    messageId: createdMessage.id,
    direction: "INBOUND"
  });

  return {
    stored: true,
    duplicate: false,
    messageId: createdMessage.id,
    conversationId: createdMessage.conversationId
  };
}

async function requireInboxMembership(userId: string, orgId: string) {
  const membership = await prisma.orgMember.findUnique({
    where: {
      orgId_userId: {
        orgId,
        userId
      }
    },
    select: {
      id: true,
      role: true
    }
  });

  if (!membership) {
    throw new ServiceError(403, "ORG_ACCESS_DENIED", "You do not have access to this organization.");
  }

  if (!canAccessInbox(membership.role)) {
    throw new ServiceError(403, "FORBIDDEN_INBOX_ACCESS", "Your role cannot access inbox conversations.");
  }

  return membership;
}

function normalizeSystemMessageText(value: string): string {
  const normalized = normalize(value);
  if (!normalized) {
    throw new ServiceError(400, "INVALID_MESSAGE_TEXT", "Message text is required.");
  }

  return normalized.includes("[Automated]") ? normalized : `${normalized} [Automated]`;
}

async function getConversationWithCustomer(orgId: string, conversationId: string) {
  const conversation = await prisma.conversation.findFirst({
    where: {
      id: conversationId,
      orgId
    },
    include: {
      customer: {
        select: {
          phoneE164: true
        }
      }
    }
  });

  if (!conversation) {
    throw new ServiceError(404, "CONVERSATION_NOT_FOUND", "Conversation does not exist.");
  }

  return conversation;
}

async function getOrgWaCredentials(orgId: string): Promise<{ accessToken: string; phoneNumberId: string }> {
  const waAccount = await prisma.waAccount.findFirst({
    where: {
      orgId
    },
    orderBy: {
      connectedAt: "desc"
    },
    select: {
      accessTokenEnc: true,
      phoneNumberId: true
    }
  });

  if (!waAccount) {
    throw new ServiceError(400, "WHATSAPP_NOT_CONNECTED", "WhatsApp account is not connected for this organization.");
  }

  const accessToken = decryptSensitiveToken(waAccount.accessTokenEnc);
  return {
    accessToken,
    phoneNumberId: waAccount.phoneNumberId
  };
}

async function storeOutboundRecord(params: {
  orgId: string;
  conversationId: string;
  type: "TEXT" | "TEMPLATE" | "SYSTEM";
  text?: string;
  waMessageId?: string | null;
  templateName?: string;
  templateCategory?: "MARKETING" | "UTILITY" | "AUTHENTICATION" | "SERVICE";
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
        templateName: params.templateName,
        templateCategory: params.templateCategory
      },
      select: {
        id: true,
        waMessageId: true,
        type: true,
        createdAt: true
      }
    });

    await tx.conversation.update({
      where: {
        id: params.conversationId
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
    type: createdMessage.type as "TEXT" | "TEMPLATE" | "SYSTEM",
    createdAt: createdMessage.createdAt
  };
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

    return result;
  }

  if (input.type === "TEXT") {
    const text = normalize(input.text ?? "");
    if (!text) {
      throw new ServiceError(400, "INVALID_MESSAGE_TEXT", "Message text is required.");
    }

    const credentials = await getOrgWaCredentials(orgId);
    const waMessageId = await sendWhatsAppTextMessage({
      accessToken: credentials.accessToken,
      phoneNumberId: credentials.phoneNumberId,
      to: conversation.customer.phoneE164,
      text
    });

    const result = await storeOutboundRecord({
      orgId,
      conversationId: conversation.id,
      type: "TEXT",
      text,
      waMessageId
    });

    publishMessageNewEventNonBlocking({
      orgId,
      conversationId: conversation.id,
      messageId: result.messageId,
      direction: "OUTBOUND"
    });

    return result;
  }

  const templateName = normalize(input.templateName ?? "");
  if (!templateName) {
    throw new ServiceError(400, "INVALID_TEMPLATE_NAME", "templateName is required for template messages.");
  }

  const credentials = await getOrgWaCredentials(orgId);
  const waMessageId = await sendWhatsAppTemplateMessage({
    accessToken: credentials.accessToken,
    phoneNumberId: credentials.phoneNumberId,
    to: conversation.customer.phoneE164,
    templateName,
    languageCode: normalize(input.templateLanguageCode ?? "en")
  });

  const result = await storeOutboundRecord({
    orgId,
    conversationId: conversation.id,
    type: "TEMPLATE",
    text: normalizeOptional(input.text),
    waMessageId,
    templateName,
    templateCategory: input.templateCategory
  });

  publishMessageNewEventNonBlocking({
    orgId,
    conversationId: conversation.id,
    messageId: result.messageId,
    direction: "OUTBOUND"
  });

  return result;
}

export async function listConversationMessages(input: ListMessagesInput): Promise<MessageListResult> {
  const orgId = normalize(input.orgId);
  const conversationId = normalize(input.conversationId);
  if (!orgId) {
    throw new ServiceError(400, "MISSING_ORG_ID", "orgId is required.");
  }

  if (!conversationId) {
    throw new ServiceError(400, "MISSING_CONVERSATION_ID", "conversationId is required.");
  }

  await requireInboxMembership(input.actorUserId, orgId);
  const page = normalizePage(input.page);
  const limit = normalizeLimit(input.limit);

  const conversation = await prisma.conversation.findFirst({
    where: {
      id: conversationId,
      orgId
    },
    select: {
      id: true
    }
  });

  if (!conversation) {
    throw new ServiceError(404, "CONVERSATION_NOT_FOUND", "Conversation does not exist.");
  }

  const [total, rows] = await prisma.$transaction([
    prisma.message.count({
      where: {
        conversationId: conversation.id
      }
    }),
    prisma.message.findMany({
      where: {
        conversationId: conversation.id
      },
      orderBy: {
        createdAt: "asc"
      },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        waMessageId: true,
        direction: true,
        type: true,
        text: true,
        mediaUrl: true,
        mimeType: true,
        fileName: true,
        templateName: true,
        templateCategory: true,
        isAutomated: true,
        createdAt: true
      }
    })
  ]);

  return {
    messages: rows,
    page,
    limit,
    total
  };
}
