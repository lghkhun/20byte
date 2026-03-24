import { prisma } from "@/lib/db/prisma";
import { canAccessInbox } from "@/lib/permissions/orgPermissions";
import { isWhatsAppMockModeEnabled } from "@/lib/whatsapp/mockMode";
import { assertOrgBillingAccess } from "@/server/services/billingService";
import { ensureBaileysConnectedForOrg } from "@/server/services/baileysService";
import { ServiceError } from "@/server/services/serviceError";

export async function requireInboxMembership(userId: string, orgId: string) {
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

  await assertOrgBillingAccess(orgId, "write");

  return membership;
}

export async function getConversationWithCustomer(orgId: string, conversationId: string) {
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

export async function getOrgWaConnection(orgId: string): Promise<{ orgId: string }> {
  const waAccount = await prisma.waAccount.findFirst({
    where: {
      orgId,
      metaBusinessId: "baileys",
      wabaId: "baileys"
    },
    orderBy: {
      connectedAt: "desc"
    },
    select: {
      id: true
    }
  });

  if (!waAccount) {
    if (isWhatsAppMockModeEnabled()) {
      return {
        orgId
      };
    }

    throw new ServiceError(400, "WHATSAPP_NOT_CONNECTED", "WhatsApp account is not connected for this organization.");
  }

  await ensureBaileysConnectedForOrg(orgId);
  return { orgId };
}
