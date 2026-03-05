import { ConversationStatus, Role } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { canAccessInbox } from "@/lib/permissions/orgPermissions";
import { ServiceError } from "@/server/services/serviceError";

const PHONE_E164_REGEX = /^\+[1-9]\d{7,14}$/;

type CreateConversationInput = {
  actorUserId: string;
  orgId: string;
  phoneE164: string;
  customerDisplayName?: string;
};

type AssignConversationInput = {
  actorUserId: string;
  orgId: string;
  conversationId: string;
  assigneeUserId?: string;
};

type ConversationSummary = {
  id: string;
  orgId: string;
  customerId: string;
  phoneE164: string;
  customerDisplayName: string | null;
  status: ConversationStatus;
  assignedToMemberId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type AssignmentSummary = {
  conversationId: string;
  orgId: string;
  assignedToMemberId: string;
  assigneeUserId: string;
  assigneeRole: Role;
  updatedAt: Date;
};

type UpdateConversationStatusInput = {
  actorUserId: string;
  orgId: string;
  conversationId: string;
  status: ConversationStatus;
};

type ConversationListFilter = "UNASSIGNED" | "MY" | "ALL";

type ListConversationsInput = {
  actorUserId: string;
  orgId: string;
  filter?: ConversationListFilter;
  status?: ConversationStatus;
  page?: number;
  limit?: number;
};

type ConversationListItem = {
  id: string;
  orgId: string;
  customerId: string;
  customerPhoneE164: string;
  customerDisplayName: string | null;
  status: ConversationStatus;
  assignedToMemberId: string | null;
  lastMessageAt: Date | null;
  unreadCount: number;
  updatedAt: Date;
};

type ConversationListResult = {
  conversations: ConversationListItem[];
  page: number;
  limit: number;
  total: number;
};

function normalizeValue(value: string): string {
  return value.trim();
}

function validatePhoneE164(phoneE164: string): string {
  const normalizedPhone = normalizeValue(phoneE164);
  if (!PHONE_E164_REGEX.test(normalizedPhone)) {
    throw new ServiceError(400, "INVALID_PHONE_E164", "phoneE164 must be in E.164 format (example: +628123456789).");
  }

  return normalizedPhone;
}

function normalizeOptionalName(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = normalizeValue(value);
  return normalized.length > 0 ? normalized : undefined;
}

function normalizePage(value: number | undefined): number {
  if (!value || Number.isNaN(value) || value < 1) {
    return 1;
  }

  return Math.floor(value);
}

function normalizeLimit(value: number | undefined): number {
  if (!value || Number.isNaN(value) || value < 1) {
    return 20;
  }

  return Math.min(100, Math.floor(value));
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
      role: true,
      userId: true
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

export async function createConversation(input: CreateConversationInput): Promise<ConversationSummary> {
  const orgId = normalizeValue(input.orgId);
  const phoneE164 = validatePhoneE164(input.phoneE164);
  const customerDisplayName = normalizeOptionalName(input.customerDisplayName);

  if (!orgId) {
    throw new ServiceError(400, "MISSING_ORG_ID", "orgId is required.");
  }

  await requireInboxMembership(input.actorUserId, orgId);

  const customer = await prisma.customer.upsert({
    where: {
      orgId_phoneE164: {
        orgId,
        phoneE164
      }
    },
    update: customerDisplayName
      ? {
          displayName: customerDisplayName
        }
      : {},
    create: {
      orgId,
      phoneE164,
      displayName: customerDisplayName ?? null
    },
    select: {
      id: true,
      phoneE164: true,
      displayName: true
    }
  });

  const existingOpenConversation = await prisma.conversation.findFirst({
    where: {
      orgId,
      customerId: customer.id,
      status: ConversationStatus.OPEN
    },
    orderBy: {
      updatedAt: "desc"
    }
  });

  const conversation =
    existingOpenConversation ??
    (await prisma.conversation.create({
      data: {
        orgId,
        customerId: customer.id,
        status: ConversationStatus.OPEN
      }
    }));

  return {
    id: conversation.id,
    orgId: conversation.orgId,
    customerId: conversation.customerId,
    phoneE164: customer.phoneE164,
    customerDisplayName: customer.displayName,
    status: conversation.status,
    assignedToMemberId: conversation.assignedToMemberId,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt
  };
}

export async function assignConversation(input: AssignConversationInput): Promise<AssignmentSummary> {
  const orgId = normalizeValue(input.orgId);
  const conversationId = normalizeValue(input.conversationId);
  if (!orgId) {
    throw new ServiceError(400, "MISSING_ORG_ID", "orgId is required.");
  }

  if (!conversationId) {
    throw new ServiceError(400, "MISSING_CONVERSATION_ID", "conversationId is required.");
  }

  await requireInboxMembership(input.actorUserId, orgId);

  const conversation = await prisma.conversation.findFirst({
    where: {
      id: conversationId,
      orgId
    },
    select: {
      id: true,
      orgId: true
    }
  });

  if (!conversation) {
    throw new ServiceError(404, "CONVERSATION_NOT_FOUND", "Conversation does not exist.");
  }

  const targetUserId = normalizeValue(input.assigneeUserId ?? input.actorUserId);
  const assigneeMembership = await prisma.orgMember.findUnique({
    where: {
      orgId_userId: {
        orgId,
        userId: targetUserId
      }
    },
    select: {
      id: true,
      userId: true,
      role: true
    }
  });

  if (!assigneeMembership) {
    throw new ServiceError(400, "ASSIGNEE_NOT_MEMBER", "Assignee is not a member of this organization.");
  }

  if (!canAccessInbox(assigneeMembership.role)) {
    throw new ServiceError(403, "ASSIGNEE_ROLE_FORBIDDEN", "Assignee role cannot handle inbox conversations.");
  }

  const updatedConversation = await prisma.conversation.update({
    where: {
      id: conversation.id
    },
    data: {
      assignedToMemberId: assigneeMembership.id
    },
    select: {
      id: true,
      orgId: true,
      assignedToMemberId: true,
      updatedAt: true
    }
  });

  return {
    conversationId: updatedConversation.id,
    orgId: updatedConversation.orgId,
    assignedToMemberId: updatedConversation.assignedToMemberId ?? assigneeMembership.id,
    assigneeUserId: assigneeMembership.userId,
    assigneeRole: assigneeMembership.role,
    updatedAt: updatedConversation.updatedAt
  };
}

export async function updateConversationStatus(
  input: UpdateConversationStatusInput
): Promise<ConversationSummary> {
  const orgId = normalizeValue(input.orgId);
  const conversationId = normalizeValue(input.conversationId);
  if (!orgId) {
    throw new ServiceError(400, "MISSING_ORG_ID", "orgId is required.");
  }

  if (!conversationId) {
    throw new ServiceError(400, "MISSING_CONVERSATION_ID", "conversationId is required.");
  }

  await requireInboxMembership(input.actorUserId, orgId);

  const conversation = await prisma.conversation.findFirst({
    where: {
      id: conversationId,
      orgId
    },
    include: {
      customer: {
        select: {
          id: true,
          phoneE164: true,
          displayName: true
        }
      }
    }
  });

  if (!conversation) {
    throw new ServiceError(404, "CONVERSATION_NOT_FOUND", "Conversation does not exist.");
  }

  const updatedConversation = await prisma.conversation.update({
    where: {
      id: conversation.id
    },
    data: {
      status: input.status
    }
  });

  return {
    id: updatedConversation.id,
    orgId: updatedConversation.orgId,
    customerId: updatedConversation.customerId,
    phoneE164: conversation.customer.phoneE164,
    customerDisplayName: conversation.customer.displayName,
    status: updatedConversation.status,
    assignedToMemberId: updatedConversation.assignedToMemberId,
    createdAt: updatedConversation.createdAt,
    updatedAt: updatedConversation.updatedAt
  };
}

export async function listConversations(input: ListConversationsInput): Promise<ConversationListResult> {
  const orgId = normalizeValue(input.orgId);
  if (!orgId) {
    throw new ServiceError(400, "MISSING_ORG_ID", "orgId is required.");
  }

  const page = normalizePage(input.page);
  const limit = normalizeLimit(input.limit);
  const filter = input.filter ?? "UNASSIGNED";
  const status = input.status ?? ConversationStatus.OPEN;
  const actorMembership = await requireInboxMembership(input.actorUserId, orgId);

  const where: {
    orgId: string;
    status: ConversationStatus;
    assignedToMemberId?: string | null;
  } = {
    orgId,
    status
  };

  if (filter === "UNASSIGNED") {
    where.assignedToMemberId = null;
  } else if (filter === "MY") {
    where.assignedToMemberId = actorMembership.id;
  }

  const [total, rows] = await prisma.$transaction([
    prisma.conversation.count({ where }),
    prisma.conversation.findMany({
      where,
      include: {
        customer: {
          select: {
            id: true,
            phoneE164: true,
            displayName: true
          }
        }
      },
      orderBy: [
        { lastMessageAt: "desc" },
        { updatedAt: "desc" }
      ],
      skip: (page - 1) * limit,
      take: limit
    })
  ]);

  return {
    conversations: rows.map((row) => ({
      id: row.id,
      orgId: row.orgId,
      customerId: row.customerId,
      customerPhoneE164: row.customer.phoneE164,
      customerDisplayName: row.customer.displayName,
      status: row.status,
      assignedToMemberId: row.assignedToMemberId,
      lastMessageAt: row.lastMessageAt,
      unreadCount: row.unreadCount,
      updatedAt: row.updatedAt
    })),
    page,
    limit,
    total
  };
}

export async function getConversationById(
  actorUserId: string,
  orgId: string,
  conversationId: string
): Promise<ConversationListItem> {
  const normalizedOrgId = normalizeValue(orgId);
  const normalizedConversationId = normalizeValue(conversationId);
  if (!normalizedOrgId) {
    throw new ServiceError(400, "MISSING_ORG_ID", "orgId is required.");
  }

  if (!normalizedConversationId) {
    throw new ServiceError(400, "MISSING_CONVERSATION_ID", "conversationId is required.");
  }

  await requireInboxMembership(actorUserId, normalizedOrgId);

  const conversation = await prisma.conversation.findFirst({
    where: {
      id: normalizedConversationId,
      orgId: normalizedOrgId
    },
    include: {
      customer: {
        select: {
          id: true,
          phoneE164: true,
          displayName: true
        }
      }
    }
  });

  if (!conversation) {
    throw new ServiceError(404, "CONVERSATION_NOT_FOUND", "Conversation does not exist.");
  }

  return {
    id: conversation.id,
    orgId: conversation.orgId,
    customerId: conversation.customerId,
    customerPhoneE164: conversation.customer.phoneE164,
    customerDisplayName: conversation.customer.displayName,
    status: conversation.status,
    assignedToMemberId: conversation.assignedToMemberId,
    lastMessageAt: conversation.lastMessageAt,
    unreadCount: conversation.unreadCount,
    updatedAt: conversation.updatedAt
  };
}
