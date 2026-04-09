import { readFile } from "fs/promises";
import path from "path";

import { ConversationStatus } from "@prisma/client";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { normalizePossibleE164 } from "@/lib/whatsapp/e164";
import { requireInboxMembership } from "@/server/services/conversation/access";
import { toConversationListItem } from "@/server/services/conversation/mappers";
import type { ConversationListItem, ConversationListResult, ListConversationsInput } from "@/server/services/conversation/types";
import { normalizeLimit, normalizePage, normalizeValue } from "@/server/services/conversation/utils";
import { ServiceError } from "@/server/services/serviceError";

const BAILEYS_AUTH_DIR = path.join(process.cwd(), ".runtime", "baileys-auth");

function extractDigits(raw: string | undefined): string {
  return (raw ?? "").replace(/\D/g, "");
}

async function resolveCanonicalConversationPhoneE164(
  orgId: string,
  phoneE164: string,
  requestCache: Map<string, string>
): Promise<string> {
  const normalizedInput = normalizePossibleE164(phoneE164) ?? phoneE164.trim();
  const digits = extractDigits(normalizedInput);
  if (!digits) {
    return normalizedInput;
  }

  const cached = requestCache.get(digits);
  if (cached) {
    return cached;
  }

  const reverseMappingPath = path.join(BAILEYS_AUTH_DIR, orgId, `lid-mapping-${digits}_reverse.json`);
  try {
    const raw = await readFile(reverseMappingPath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed === "string") {
      const mappedDigits = extractDigits(parsed);
      const mapped = normalizePossibleE164(mappedDigits);
      if (mapped) {
        requestCache.set(digits, mapped);
        return mapped;
      }
    }
  } catch {
    // ignore missing mapping file
  }

  const fallback = normalizePossibleE164(digits) ?? normalizedInput;
  requestCache.set(digits, fallback);
  return fallback;
}

export async function listConversations(input: ListConversationsInput): Promise<ConversationListResult> {
  const orgId = normalizeValue(input.orgId);
  if (!orgId) {
    throw new ServiceError(400, "MISSING_ORG_ID", "orgId is required.");
  }

  const page = normalizePage(input.page);
  const limit = normalizeLimit(input.limit);
  const filter = input.filter ?? "ALL";
  const status = input.status ?? ConversationStatus.OPEN;
  const query = normalizeValue(input.query ?? "");
  const actorMembership = await requireInboxMembership(input.actorUserId, orgId);

  const where: Prisma.ConversationWhereInput = {
    orgId,
    status
  };

  if (filter === "UNASSIGNED") {
    where.assignedToMemberId = null;
  } else if (filter === "MY") {
    where.assignedToMemberId = actorMembership.id;
  }

  if (query) {
    where.OR = [
      {
        customer: {
          displayName: {
            contains: query
          }
        }
      },
      {
        customer: {
          phoneE164: {
            contains: query
          }
        }
      },
      {
        messages: {
          some: {
            text: {
              contains: query
            }
          }
        }
      }
    ];
  }

  const distinctProbeSize = page * limit + 1;

  const [distinctCustomerProbe, rows] = await prisma.$transaction([
    prisma.conversation.findMany({
      where,
      distinct: ["customerId"],
      select: {
        customerId: true
      },
      take: distinctProbeSize
    }),
    prisma.conversation.findMany({
      where,
      distinct: ["customerId"],
      select: {
        id: true,
        orgId: true,
        customerId: true,
        crmPipelineId: true,
        crmStageId: true,
        sourceCampaign: true,
        sourcePlatform: true,
        sourceMedium: true,
        status: true,
        assignedToMemberId: true,
        lastMessageAt: true,
        unreadCount: true,
        updatedAt: true,
        shortlinkId: true,
        waChatJid: true,
        crmPipeline: {
          select: {
            name: true
          }
        },
        crmStage: {
          select: {
            name: true
          }
        },
        customer: {
          select: {
            id: true,
            phoneE164: true,
            displayName: true,
            waProfilePicUrl: true,
            source: true,
            leadStatus: true
          }
        },
        messages: {
          orderBy: {
            createdAt: "desc"
          },
          take: 1,
          select: {
            text: true,
            type: true,
            direction: true,
            fileName: true
          }
        },
        assignedToMember: {
          select: {
            user: {
              select: {
                name: true
              }
            }
          }
        }
      },
      orderBy: [{ lastMessageAt: "desc" }, { updatedAt: "desc" }],
      skip: (page - 1) * limit,
      take: limit
    })
  ]);

  const hasMore = distinctCustomerProbe.length > page * limit;
  const total = hasMore ? page * limit + 1 : distinctCustomerProbe.length;
  const requestCanonicalPhoneCache = new Map<string, string>();
  const conversationItems = await Promise.all(
    rows.map(async (row) => {
      const baseItem = toConversationListItem(row);
      const canonicalPhone = await resolveCanonicalConversationPhoneE164(orgId, baseItem.customerPhoneE164, requestCanonicalPhoneCache);
      if (canonicalPhone === baseItem.customerPhoneE164) {
        return { item: baseItem, canonicalPhone };
      }

      return {
        canonicalPhone,
        item: {
          ...baseItem,
          customerPhoneE164: canonicalPhone
        }
      };
    })
  );

  const dedupedConversations: ConversationListItem[] = [];
  const seenCanonicalPhones = new Set<string>();
  for (const row of conversationItems) {
    if (seenCanonicalPhones.has(row.canonicalPhone)) {
      continue;
    }
    seenCanonicalPhones.add(row.canonicalPhone);
    dedupedConversations.push(row.item);
  }

  return {
    conversations: dedupedConversations,
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
    select: {
      id: true,
      orgId: true,
      customerId: true,
      crmPipelineId: true,
      crmStageId: true,
      sourceCampaign: true,
      sourcePlatform: true,
      sourceMedium: true,
      status: true,
      assignedToMemberId: true,
      lastMessageAt: true,
      unreadCount: true,
      updatedAt: true,
      shortlinkId: true,
      waChatJid: true,
      crmPipeline: {
        select: {
          name: true
        }
      },
      crmStage: {
        select: {
          name: true
        }
      },
      customer: {
        select: {
          id: true,
          phoneE164: true,
          displayName: true,
          waProfilePicUrl: true,
          source: true,
          leadStatus: true
        }
      },
      messages: {
        orderBy: {
          createdAt: "desc"
        },
        take: 1,
        select: {
          text: true,
          type: true,
          direction: true,
          fileName: true
        }
      },
      assignedToMember: {
        select: {
          user: {
            select: {
              name: true
            }
          }
        }
      }
    }
  });

  if (!conversation) {
    throw new ServiceError(404, "CONVERSATION_NOT_FOUND", "Conversation does not exist.");
  }

  const baseItem = toConversationListItem(conversation);
  const canonicalPhone = await resolveCanonicalConversationPhoneE164(
    normalizedOrgId,
    baseItem.customerPhoneE164,
    new Map<string, string>()
  );

  if (canonicalPhone === baseItem.customerPhoneE164) {
    return baseItem;
  }

  return {
    ...baseItem,
    customerPhoneE164: canonicalPhone
  };
}
