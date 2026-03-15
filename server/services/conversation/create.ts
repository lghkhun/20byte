import { ConversationStatus } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { normalizeWhatsAppDestination } from "@/lib/whatsapp/e164";
import { requireInboxMembership } from "@/server/services/conversation/access";
import { ensureDefaultCrmPipeline } from "@/server/services/crmPipelineService";
import { toConversationSummary } from "@/server/services/conversation/mappers";
import type { ConversationSummary, CreateConversationInput } from "@/server/services/conversation/types";
import { normalizeOptionalName, normalizeValue, validatePhoneE164 } from "@/server/services/conversation/utils";
import { ServiceError } from "@/server/services/serviceError";

export async function createConversation(input: CreateConversationInput): Promise<ConversationSummary> {
  const orgId = normalizeValue(input.orgId);
  const normalizedPhoneInput = normalizeWhatsAppDestination(input.phoneE164) ?? input.phoneE164;
  const phoneE164 = validatePhoneE164(normalizedPhoneInput);
  const customerDisplayName = normalizeOptionalName(input.customerDisplayName);

  if (!orgId) {
    throw new ServiceError(400, "MISSING_ORG_ID", "orgId is required.");
  }

  await requireInboxMembership(input.actorUserId, orgId);
  await ensureDefaultCrmPipeline(orgId);

  const defaultPipeline = await prisma.crmPipeline.findFirst({
    where: {
      orgId,
      isDefault: true
    },
    orderBy: {
      createdAt: "asc"
    },
    select: {
      id: true,
      name: true,
      stages: {
        orderBy: {
          position: "asc"
        },
        take: 1,
        select: {
          id: true,
          name: true
        }
      }
    }
  });

  const existingCustomer = await prisma.customer.findUnique({
    where: {
      orgId_phoneE164: {
        orgId,
        phoneE164
      }
    },
    select: {
      id: true,
      phoneE164: true,
      displayName: true,
      waProfilePicUrl: true,
      source: true,
      campaign: true,
      adset: true,
      ad: true,
      platform: true,
      medium: true
    }
  });

  const customer = existingCustomer
    ? await (async () => {
        const updateResult = await prisma.customer.updateMany({
          where: {
            id: existingCustomer.id,
            orgId
          },
          data: {
            ...(customerDisplayName ? { displayName: customerDisplayName } : {}),
            ...(!existingCustomer.source
              ? {
                  source: "organic",
                  firstContactAt: new Date()
                }
              : {})
          }
        });

        if (updateResult.count !== 1) {
          throw new ServiceError(404, "CUSTOMER_NOT_FOUND", "Customer does not exist.");
        }

        const refreshed = await prisma.customer.findUnique({
          where: {
            orgId_phoneE164: {
              orgId,
              phoneE164
            }
          },
          select: {
            id: true,
            phoneE164: true,
            displayName: true,
            waProfilePicUrl: true,
            source: true,
            campaign: true,
            adset: true,
            ad: true,
            platform: true,
            medium: true
          }
        });

        if (!refreshed) {
          throw new ServiceError(404, "CUSTOMER_NOT_FOUND", "Customer does not exist.");
        }

        return refreshed;
      })()
    : await prisma.customer.create({
        data: {
          orgId,
          phoneE164,
          displayName: customerDisplayName ?? null,
          source: "organic",
          firstContactAt: new Date()
        },
        select: {
          id: true,
          phoneE164: true,
          displayName: true,
          waProfilePicUrl: true,
          source: true,
          campaign: true,
          adset: true,
          ad: true,
          platform: true,
          medium: true
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
        status: ConversationStatus.OPEN,
        crmPipelineId: defaultPipeline?.id ?? null,
        crmStageId: defaultPipeline?.stages[0]?.id ?? null,
        sourceCampaign: customer.campaign,
        sourcePlatform: customer.adset ?? customer.platform,
        sourceMedium: customer.ad ?? customer.medium
      },
      include: {
        crmPipeline: {
          select: {
            name: true
          }
        },
        crmStage: {
          select: {
            name: true
          }
        }
      }
    }));

  return toConversationSummary({
    conversation,
    customer: {
      phoneE164: customer.phoneE164,
      displayName: customer.displayName,
      waProfilePicUrl: customer.waProfilePicUrl,
      source: customer.source
    }
  });
}
