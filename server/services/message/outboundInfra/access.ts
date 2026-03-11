import { prisma } from "@/lib/db/prisma";
import { canAccessInbox } from "@/lib/permissions/orgPermissions";
import { decryptSensitiveToken } from "@/lib/security/tokenCipher";
import { isWhatsAppMockModeEnabled } from "@/lib/whatsapp/mockMode";
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

export async function getOrgWaCredentials(orgId: string): Promise<{ accessToken: string; phoneNumberId: string }> {
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
    if (isWhatsAppMockModeEnabled()) {
      return {
        accessToken: "mock-access-token",
        phoneNumberId: "mock-phone-number-id"
      };
    }

    throw new ServiceError(400, "WHATSAPP_NOT_CONNECTED", "WhatsApp account is not connected for this organization.");
  }

  const accessToken = decryptSensitiveToken(waAccount.accessTokenEnc);
  return {
    accessToken,
    phoneNumberId: waAccount.phoneNumberId
  };
}
