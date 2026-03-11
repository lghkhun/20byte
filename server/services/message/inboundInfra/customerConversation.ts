import { ConversationStatus, type Prisma } from "@prisma/client";

import type { ResolvedAttribution } from "@/server/services/message/messageTypes";
import { ServiceError } from "@/server/services/serviceError";

export async function getOrCreateCustomer(
  tx: Prisma.TransactionClient,
  orgId: string,
  customerPhoneE164: string,
  customerDisplayName?: string,
  attribution?: ResolvedAttribution
) {
  const existing = await tx.customer.findUnique({
    where: {
      orgId_phoneE164: {
        orgId,
        phoneE164: customerPhoneE164
      }
    },
    select: {
      id: true,
      source: true,
      campaign: true,
      adset: true,
      ad: true,
      platform: true,
      medium: true
    }
  });

  if (existing) {
    const updateData: Prisma.CustomerUpdateInput = {};
    if (customerDisplayName) {
      updateData.displayName = customerDisplayName;
    }

    if (!existing.source) {
      const resolvedAdset = attribution?.adset ?? attribution?.platform ?? null;
      const resolvedAd = attribution?.ad ?? attribution?.medium ?? null;
      updateData.source = attribution?.source ?? "organic";
      updateData.campaign = attribution?.campaign ?? null;
      updateData.adset = resolvedAdset;
      updateData.ad = resolvedAd;
      updateData.platform = resolvedAdset;
      updateData.medium = resolvedAd;
      updateData.firstContactAt = new Date();
    }

    if (Object.keys(updateData).length > 0) {
      const updateResult = await tx.customer.updateMany({
        where: {
          id: existing.id,
          orgId
        },
        data: updateData
      });

      if (updateResult.count !== 1) {
        throw new ServiceError(404, "CUSTOMER_NOT_FOUND", "Customer does not exist.");
      }
    }

    return {
      id: existing.id,
      source: existing.source ?? attribution?.source ?? "organic",
      campaign: existing.campaign ?? attribution?.campaign ?? null,
      adset: existing.adset ?? existing.platform ?? attribution?.adset ?? attribution?.platform ?? null,
      ad: existing.ad ?? existing.medium ?? attribution?.ad ?? attribution?.medium ?? null,
      platform: existing.platform ?? existing.adset ?? attribution?.adset ?? attribution?.platform ?? null,
      medium: existing.medium ?? existing.ad ?? attribution?.ad ?? attribution?.medium ?? null
    };
  }

  const createdAdset = attribution?.adset ?? attribution?.platform ?? null;
  const createdAd = attribution?.ad ?? attribution?.medium ?? null;
  return tx.customer.create({
    data: {
      orgId,
      phoneE164: customerPhoneE164,
      displayName: customerDisplayName ?? null,
      source: attribution?.source ?? "organic",
      campaign: attribution?.campaign ?? null,
      adset: createdAdset,
      ad: createdAd,
      platform: createdAdset,
      medium: createdAd,
      firstContactAt: new Date()
    },
    select: {
      id: true,
      source: true,
      campaign: true,
      adset: true,
      ad: true,
      platform: true,
      medium: true
    }
  });
}

export async function getOrCreateOpenConversation(
  tx: Prisma.TransactionClient,
  orgId: string,
  customerId: string,
  attribution?: ResolvedAttribution
) {
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
      id: true,
      status: true,
      assignedToMemberId: true,
      sourceCampaign: true,
      sourcePlatform: true,
      sourceMedium: true,
      shortlinkId: true
    }
  });

  if (existingOpenConversation) {
    const updateData: Prisma.ConversationUpdateInput = {};
    if (!existingOpenConversation.sourceCampaign && attribution?.campaign) {
      updateData.sourceCampaign = attribution.campaign;
    }

    if (!existingOpenConversation.sourcePlatform && attribution?.platform) {
      updateData.sourcePlatform = attribution.platform;
    }

    if (!existingOpenConversation.sourceMedium && attribution?.medium) {
      updateData.sourceMedium = attribution.medium;
    }

    if (!existingOpenConversation.shortlinkId && attribution?.shortlinkId) {
      updateData.shortlinkId = attribution.shortlinkId;
    }

    if (Object.keys(updateData).length > 0) {
      const updateResult = await tx.conversation.updateMany({
        where: {
          id: existingOpenConversation.id,
          orgId
        },
        data: updateData
      });

      if (updateResult.count !== 1) {
        throw new ServiceError(404, "CONVERSATION_NOT_FOUND", "Conversation does not exist.");
      }
    }

    return existingOpenConversation;
  }

  return tx.conversation.create({
    data: {
      orgId,
      customerId,
      status: ConversationStatus.OPEN,
      sourceCampaign: attribution?.campaign ?? null,
      sourcePlatform: attribution?.platform ?? null,
      sourceMedium: attribution?.medium ?? null,
      shortlinkId: attribution?.shortlinkId ?? null
    },
    select: {
      id: true,
      status: true,
      assignedToMemberId: true
    }
  });
}
