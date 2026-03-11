import { prisma } from "@/lib/db/prisma";
import { publishAssignmentChangedEvent } from "@/lib/ably/publisher";
import { canAccessInbox } from "@/lib/permissions/orgPermissions";
import { writeAuditLogSafe } from "@/server/services/auditLogService";
import { requireInboxMembership } from "@/server/services/conversation/access";
import type { AssignConversationInput, AssignmentSummary } from "@/server/services/conversation/types";
import { normalizeValue } from "@/server/services/conversation/utils";
import { ServiceError } from "@/server/services/serviceError";

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

  const updateResult = await prisma.conversation.updateMany({
    where: {
      id: conversation.id,
      orgId
    },
    data: {
      assignedToMemberId: assigneeMembership.id
    }
  });

  if (updateResult.count !== 1) {
    throw new ServiceError(404, "CONVERSATION_NOT_FOUND", "Conversation does not exist.");
  }

  const updatedConversation = await prisma.conversation.findFirst({
    where: {
      id: conversation.id,
      orgId
    },
    select: {
      id: true,
      orgId: true,
      status: true,
      assignedToMemberId: true,
      updatedAt: true
    }
  });

  if (!updatedConversation) {
    throw new ServiceError(404, "CONVERSATION_NOT_FOUND", "Conversation does not exist.");
  }

  await writeAuditLogSafe({
    orgId,
    actorUserId: input.actorUserId,
    action: "conversation.assigned",
    entityType: "conversation",
    entityId: updatedConversation.id,
    meta: {
      assigneeUserId: assigneeMembership.userId,
      assigneeRole: assigneeMembership.role
    }
  });

  void publishAssignmentChangedEvent({
    orgId: updatedConversation.orgId,
    conversationId: updatedConversation.id,
    assignedToMemberId: updatedConversation.assignedToMemberId,
    status: updatedConversation.status
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
