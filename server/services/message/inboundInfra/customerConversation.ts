import { readFile } from "fs/promises";
import path from "path";

import { ConversationStatus, type Prisma } from "@prisma/client";

import { normalizePossibleE164 } from "@/lib/whatsapp/e164";
import type { ResolvedAttribution } from "@/server/services/message/messageTypes";
import { ServiceError } from "@/server/services/serviceError";

const MAX_WA_PROFILE_PIC_URL_LENGTH = 191;
const BAILEYS_AUTH_DIR = path.join(process.cwd(), ".runtime", "baileys-auth");

function sanitizeWaProfilePicUrl(rawValue?: string): string | undefined {
  const value = (rawValue ?? "").trim();
  if (!value) {
    return undefined;
  }

  if (value.length <= MAX_WA_PROFILE_PIC_URL_LENGTH) {
    return value;
  }

  try {
    const parsed = new URL(value);
    parsed.search = "";
    parsed.hash = "";
    const compact = parsed.toString();
    if (compact.length <= MAX_WA_PROFILE_PIC_URL_LENGTH) {
      return compact;
    }
  } catch {
    // Ignore URL parsing failures and fall back to dropping the value.
  }

  return undefined;
}

function extractDigits(raw: string | undefined): string {
  return (raw ?? "").replace(/\D/g, "");
}

function getAuthFolder(orgId: string): string {
  return path.join(BAILEYS_AUTH_DIR, orgId);
}

async function resolveCanonicalCustomerPhoneE164(orgId: string, customerPhoneE164: string): Promise<string> {
  const normalizedInput = normalizePossibleE164(customerPhoneE164) ?? customerPhoneE164.trim();
  const inputDigits = extractDigits(normalizedInput);
  if (!inputDigits) {
    return normalizedInput;
  }

  const reverseMappingPath = path.join(getAuthFolder(orgId), `lid-mapping-${inputDigits}_reverse.json`);
  try {
    const raw = await readFile(reverseMappingPath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed === "string") {
      const mappedDigits = extractDigits(parsed);
      const mappedE164 = normalizePossibleE164(mappedDigits);
      if (mappedE164) {
        return mappedE164;
      }
    }
  } catch {
    // ignore missing mapping file
  }

  return normalizePossibleE164(inputDigits) ?? normalizedInput;
}

async function collapseCustomerConversations(
  tx: Prisma.TransactionClient,
  orgId: string,
  customerId: string
): Promise<void> {
  const conversations = await tx.conversation.findMany({
    where: {
      orgId,
      customerId
    },
    select: {
      id: true,
      status: true,
      unreadCount: true,
      lastMessageAt: true,
      updatedAt: true,
      createdAt: true
    },
    orderBy: [{ updatedAt: "desc" }, { lastMessageAt: "desc" }, { createdAt: "desc" }]
  });

  if (conversations.length <= 1) {
    return;
  }

  const primaryConversation = conversations[0];
  const duplicateIds = conversations.slice(1).map((conversation) => conversation.id);
  if (duplicateIds.length === 0) {
    return;
  }

  await tx.message.updateMany({
    where: {
      orgId,
      conversationId: {
        in: duplicateIds
      }
    },
    data: {
      conversationId: primaryConversation.id
    }
  });

  await tx.invoice.updateMany({
    where: {
      orgId,
      conversationId: {
        in: duplicateIds
      }
    },
    data: {
      conversationId: primaryConversation.id
    }
  });

  const latestMessage = await tx.message.findFirst({
    where: {
      orgId,
      conversationId: primaryConversation.id
    },
    orderBy: {
      createdAt: "desc"
    },
    select: {
      createdAt: true
    }
  });

  const mergedUnreadCount = conversations.reduce((total, conversation) => total + conversation.unreadCount, 0);
  const shouldOpen = conversations.some((conversation) => conversation.status === ConversationStatus.OPEN);

  const conversationUpdateResult = await tx.conversation.updateMany({
    where: {
      id: primaryConversation.id,
      orgId
    },
    data: {
      status: shouldOpen ? ConversationStatus.OPEN : primaryConversation.status,
      unreadCount: mergedUnreadCount,
      lastMessageAt: latestMessage?.createdAt ?? primaryConversation.lastMessageAt
    }
  });

  if (conversationUpdateResult.count !== 1) {
    throw new ServiceError(404, "CONVERSATION_NOT_FOUND", "Conversation does not exist.");
  }

  await tx.conversation.deleteMany({
    where: {
      orgId,
      id: {
        in: duplicateIds
      }
    }
  });
}

async function mergeLegacyCustomerIntoCanonical(
  tx: Prisma.TransactionClient,
  orgId: string,
  legacyCustomerId: string,
  canonicalCustomerId: string
): Promise<void> {
  if (!legacyCustomerId || !canonicalCustomerId || legacyCustomerId === canonicalCustomerId) {
    return;
  }

  const legacyExists = await tx.customer.findFirst({
    where: {
      id: legacyCustomerId,
      orgId
    },
    select: {
      id: true
    }
  });
  if (!legacyExists) {
    return;
  }

  const canonicalExists = await tx.customer.findFirst({
    where: {
      id: canonicalCustomerId,
      orgId
    },
    select: {
      id: true
    }
  });
  if (!canonicalExists) {
    return;
  }

  const legacyTagLinks = await tx.customerTag.findMany({
    where: {
      orgId,
      customerId: legacyCustomerId
    },
    select: {
      tagId: true
    }
  });

  for (const link of legacyTagLinks) {
    const existingLink = await tx.customerTag.findUnique({
      where: {
        customerId_tagId: {
          customerId: canonicalCustomerId,
          tagId: link.tagId
        }
      },
      select: {
        id: true
      }
    });
    if (!existingLink) {
      await tx.customerTag.create({
        data: {
          orgId,
          customerId: canonicalCustomerId,
          tagId: link.tagId
        }
      });
    }
  }

  await tx.customerTag.deleteMany({
    where: {
      orgId,
      customerId: legacyCustomerId
    }
  });

  await tx.customerNote.updateMany({
    where: {
      orgId,
      customerId: legacyCustomerId
    },
    data: {
      customerId: canonicalCustomerId
    }
  });

  await tx.invoice.updateMany({
    where: {
      orgId,
      customerId: legacyCustomerId
    },
    data: {
      customerId: canonicalCustomerId
    }
  });

  await tx.conversation.updateMany({
    where: {
      orgId,
      customerId: legacyCustomerId
    },
    data: {
      customerId: canonicalCustomerId
    }
  });

  await collapseCustomerConversations(tx, orgId, canonicalCustomerId);

  await tx.customer.deleteMany({
    where: {
      id: legacyCustomerId,
      orgId
    }
  });
}

export async function getOrCreateCustomer(
  tx: Prisma.TransactionClient,
  orgId: string,
  customerPhoneE164: string,
  customerDisplayName?: string,
  customerAvatarUrl?: string,
  attribution?: ResolvedAttribution
) {
  const safeCustomerAvatarUrl = sanitizeWaProfilePicUrl(customerAvatarUrl);
  const canonicalCustomerPhoneE164 = await resolveCanonicalCustomerPhoneE164(orgId, customerPhoneE164);
  const existing = await tx.customer.findUnique({
    where: {
      orgId_phoneE164: {
        orgId,
        phoneE164: canonicalCustomerPhoneE164
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

  if (existing && canonicalCustomerPhoneE164 !== customerPhoneE164) {
    const legacy = await tx.customer.findUnique({
      where: {
        orgId_phoneE164: {
          orgId,
          phoneE164: customerPhoneE164
        }
      },
      select: {
        id: true
      }
    });
    if (legacy && legacy.id !== existing.id) {
      await mergeLegacyCustomerIntoCanonical(tx, orgId, legacy.id, existing.id);
    }
  }

  if (existing) {
    const updateData: Prisma.CustomerUpdateInput = {};
    if (customerDisplayName) {
      updateData.displayName = customerDisplayName;
    }

    if (safeCustomerAvatarUrl) {
      updateData.waProfilePicUrl = safeCustomerAvatarUrl;
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
      medium: existing.medium ?? existing.ad ?? attribution?.ad ?? attribution?.medium ?? null,
      created: false
    };
  }

  if (canonicalCustomerPhoneE164 !== customerPhoneE164) {
    const legacy = await tx.customer.findUnique({
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

    if (legacy) {
      const updateData: Prisma.CustomerUpdateInput = {
        phoneE164: canonicalCustomerPhoneE164
      };
      if (customerDisplayName) {
        updateData.displayName = customerDisplayName;
      }
      if (safeCustomerAvatarUrl) {
        updateData.waProfilePicUrl = safeCustomerAvatarUrl;
      }
      if (!legacy.source) {
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

      const updateResult = await tx.customer.updateMany({
        where: {
          id: legacy.id,
          orgId
        },
        data: updateData
      });

      if (updateResult.count !== 1) {
        throw new ServiceError(404, "CUSTOMER_NOT_FOUND", "Customer does not exist.");
      }

      const updatedLegacy = await tx.customer.findFirst({
        where: {
          id: legacy.id,
          orgId
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

      if (!updatedLegacy) {
        throw new ServiceError(404, "CUSTOMER_NOT_FOUND", "Customer does not exist.");
      }

      await collapseCustomerConversations(tx, orgId, updatedLegacy.id);

      return {
        id: updatedLegacy.id,
        source: updatedLegacy.source ?? attribution?.source ?? "organic",
        campaign: updatedLegacy.campaign ?? attribution?.campaign ?? null,
        adset: updatedLegacy.adset ?? updatedLegacy.platform ?? attribution?.adset ?? attribution?.platform ?? null,
        ad: updatedLegacy.ad ?? updatedLegacy.medium ?? attribution?.ad ?? attribution?.medium ?? null,
        platform: updatedLegacy.platform ?? updatedLegacy.adset ?? attribution?.adset ?? attribution?.platform ?? null,
        medium: updatedLegacy.medium ?? updatedLegacy.ad ?? attribution?.ad ?? attribution?.medium ?? null,
        created: false
      };
    }
  }

  const createdAdset = attribution?.adset ?? attribution?.platform ?? null;
  const createdAd = attribution?.ad ?? attribution?.medium ?? null;
  return tx.customer.create({
    data: {
      orgId,
      phoneE164: canonicalCustomerPhoneE164,
      displayName: customerDisplayName ?? null,
      waProfilePicUrl: safeCustomerAvatarUrl ?? null,
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
  }).then((row) => ({
    ...row,
    created: true
  }));
}

export async function getOrCreateOpenConversation(
  tx: Prisma.TransactionClient,
  orgId: string,
  customerId: string,
  attribution?: ResolvedAttribution,
  waChatJid?: string
) {
  const normalizedWaChatJid = (waChatJid ?? "").trim() || null;
  const latestConversation = await tx.conversation.findFirst({
    where: {
      orgId,
      ...(normalizedWaChatJid
        ? {
            waChatJid: normalizedWaChatJid
          }
        : {
            customerId
          })
    },
    orderBy: [{ updatedAt: "desc" }, { lastMessageAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      status: true,
      assignedToMemberId: true,
      waChatJid: true,
      sourceCampaign: true,
      sourcePlatform: true,
      sourceMedium: true,
      shortlinkId: true,
      trackingId: true,
      fbclid: true,
      fbc: true,
      fbp: true,
      ctwaClid: true,
      wabaId: true
    }
  });

  if (latestConversation) {
    const updateData: Prisma.ConversationUpdateInput = {};
    if (!latestConversation.sourceCampaign && attribution?.campaign) {
      updateData.sourceCampaign = attribution.campaign;
    }

    if (!latestConversation.sourcePlatform && attribution?.platform) {
      updateData.sourcePlatform = attribution.platform;
    }

    if (!latestConversation.sourceMedium && attribution?.medium) {
      updateData.sourceMedium = attribution.medium;
    }

    if (!latestConversation.shortlinkId && attribution?.shortlinkId) {
      updateData.shortlinkId = attribution.shortlinkId;
    }
    if (!latestConversation.trackingId && attribution?.trackingId) {
      updateData.trackingId = attribution.trackingId;
    }
    if (!latestConversation.fbclid && attribution?.fbclid) {
      updateData.fbclid = attribution.fbclid;
    }
    if (!latestConversation.fbc && attribution?.fbc) {
      updateData.fbc = attribution.fbc;
    }
    if (!latestConversation.fbp && attribution?.fbp) {
      updateData.fbp = attribution.fbp;
    }
    if (!latestConversation.ctwaClid && attribution?.ctwaClid) {
      updateData.ctwaClid = attribution.ctwaClid;
    }
    if (!latestConversation.wabaId && attribution?.wabaId) {
      updateData.wabaId = attribution.wabaId;
    }
    if (!latestConversation.waChatJid && normalizedWaChatJid) {
      updateData.waChatJid = normalizedWaChatJid;
    }
    if (latestConversation.status !== ConversationStatus.OPEN) {
      updateData.status = ConversationStatus.OPEN;
    }

    if (Object.keys(updateData).length > 0) {
      const updateResult = await tx.conversation.updateMany({
        where: {
          id: latestConversation.id,
          orgId
        },
        data: updateData
      });

      if (updateResult.count !== 1) {
        throw new ServiceError(404, "CONVERSATION_NOT_FOUND", "Conversation does not exist.");
      }
    }

    return {
      ...latestConversation,
      status: ConversationStatus.OPEN,
      created: false
    };
  }

  const createdConversation = await tx.conversation.create({
    data: {
      orgId,
      customerId,
      status: ConversationStatus.OPEN,
      sourceCampaign: attribution?.campaign ?? null,
      sourcePlatform: attribution?.platform ?? null,
      sourceMedium: attribution?.medium ?? null,
      shortlinkId: attribution?.shortlinkId ?? null,
      trackingId: attribution?.trackingId ?? null,
      fbclid: attribution?.fbclid ?? null,
      fbc: attribution?.fbc ?? null,
      fbp: attribution?.fbp ?? null,
      ctwaClid: attribution?.ctwaClid ?? null,
      wabaId: attribution?.wabaId ?? null,
      waChatJid: normalizedWaChatJid
    },
    select: {
      id: true,
      status: true,
      assignedToMemberId: true
    }
  });

  return {
    ...createdConversation,
    created: true
  };
}
