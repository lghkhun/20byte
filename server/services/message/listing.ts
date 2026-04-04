import { prisma } from "@/lib/db/prisma";
import { canAccessInbox } from "@/lib/permissions/orgPermissions";
import { assertOrgBillingAccess } from "@/server/services/billingService";
import type {
  ListMessagesInput,
  MessageListResult,
  SearchConversationMessagesInput,
  SearchConversationMessagesResult
} from "@/server/services/message/messageTypes";
import { normalize, normalizeLimit, normalizeOptional } from "@/server/services/message/messageUtils";
import { ServiceError } from "@/server/services/serviceError";

type MessageRowWithId = {
  id: string;
};

export function buildLatestMessageWindow<T extends MessageRowWithId>(rowsDesc: T[], limit: number): {
  rows: T[];
  hasMore: boolean;
  nextBeforeMessageId: string | null;
} {
  const hasMore = rowsDesc.length > limit;
  const sliced = hasMore ? rowsDesc.slice(0, limit) : rowsDesc;
  const rows = [...sliced].reverse();
  const nextBeforeMessageId = hasMore ? rows[0]?.id ?? null : null;

  return {
    rows,
    hasMore,
    nextBeforeMessageId
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
      role: true
    }
  });

  if (!membership) {
    throw new ServiceError(403, "ORG_ACCESS_DENIED", "You do not have access to this organization.");
  }

  if (!canAccessInbox(membership.role)) {
    throw new ServiceError(403, "FORBIDDEN_INBOX_ACCESS", "Your role cannot access inbox conversations.");
  }

  await assertOrgBillingAccess(orgId, "write");
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
  const beforeMessageId = normalizeOptional(input.beforeMessageId);
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

  const total = await prisma.message.count({
    where: {
      orgId,
      conversationId: conversation.id
    }
  });

  const cursorMessage = beforeMessageId
    ? await prisma.message.findFirst({
        where: {
          id: beforeMessageId,
          orgId,
          conversationId: conversation.id
        },
        select: {
          id: true,
          createdAt: true
        }
      })
    : null;

  if (beforeMessageId && !cursorMessage) {
    throw new ServiceError(404, "MESSAGE_CURSOR_NOT_FOUND", "Message cursor does not exist.");
  }

  const rowsDesc = await prisma.message.findMany({
    where: {
      orgId,
      conversationId: conversation.id,
      ...(cursorMessage
        ? {
            OR: [
              {
                createdAt: {
                  lt: cursorMessage.createdAt
                }
              },
              {
                createdAt: cursorMessage.createdAt,
                id: {
                  lt: cursorMessage.id
                }
              }
            ]
          }
        : {})
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
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
      templateLanguageCode: true,
      isAutomated: true,
      sendStatus: true,
      deliveryStatus: true,
      sendError: true,
      retryable: true,
      sendAttemptCount: true,
      deliveredAt: true,
      readAt: true,
      createdAt: true
    }
  });

  const window = buildLatestMessageWindow(rowsDesc, limit);

  return {
    messages: window.rows,
    limit,
    hasMore: window.hasMore,
    nextBeforeMessageId: window.nextBeforeMessageId,
    total
  };
}

export async function searchConversationMessages(input: SearchConversationMessagesInput): Promise<SearchConversationMessagesResult> {
  const orgId = normalize(input.orgId);
  const conversationId = normalize(input.conversationId);
  const query = normalize(input.query);
  if (!orgId) {
    throw new ServiceError(400, "MISSING_ORG_ID", "orgId is required.");
  }

  if (!conversationId) {
    throw new ServiceError(400, "MISSING_CONVERSATION_ID", "conversationId is required.");
  }

  if (!query) {
    throw new ServiceError(400, "MISSING_SEARCH_QUERY", "query is required.");
  }

  await requireInboxMembership(input.actorUserId, orgId);
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

  const rows = await prisma.message.findMany({
    where: {
      orgId,
      conversationId: conversation.id,
      text: {
        contains: query
      }
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit,
    select: {
      id: true,
      text: true,
      createdAt: true
    }
  });

  return {
    messages: rows
      .filter((row) => typeof row.text === "string" && row.text.trim().length > 0)
      .map((row) => ({
        id: row.id,
        text: row.text as string,
        createdAt: row.createdAt
      })),
    limit
  };
}
