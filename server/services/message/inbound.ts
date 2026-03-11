import type { Prisma } from "@prisma/client";

import type { InboundStoreResult, ResolvedAttribution, StoreInboundMessageInput } from "@/server/services/message/messageTypes";
import { normalize, normalizeFileSize, normalizeOptional } from "@/server/services/message/messageUtils";
import { getOrCreateCustomer, getOrCreateOpenConversation } from "@/server/services/message/inboundInfra/customerConversation";
import { publishInboundConversationUpdatedNonBlocking, publishMessageNewEventNonBlocking } from "@/server/services/message/inboundInfra/events";
import { resolveInboundAttribution } from "@/server/services/message/inboundInfra/attribution";
import { findExistingInboundByWaMessageId, storeInboundMessageInTransaction } from "@/server/services/message/inboundInfra/persistence";

function emptyInboundResult(duplicate = false, messageId: string | null = null): InboundStoreResult {
  return {
    stored: false,
    duplicate,
    messageId,
    conversationId: null,
    conversationStatus: null,
    assignedToMemberId: null
  };
}

function buildInboundContext(input: StoreInboundMessageInput) {
  const orgId = normalize(input.orgId);
  const customerPhoneE164 = normalize(input.customerPhoneE164);
  const waMessageId = normalize(input.waMessageId);

  return {
    orgId,
    customerPhoneE164,
    waMessageId,
    customerDisplayName: normalizeOptional(input.customerDisplayName),
    shortlinkCode: normalizeOptional(input.shortlinkCode),
    text: normalizeOptional(input.text),
    mediaId: normalizeOptional(input.mediaId),
    mimeType: normalizeOptional(input.mimeType),
    fileName: normalizeOptional(input.fileName),
    fileSize: normalizeFileSize(input.fileSize),
    type: input.type
  };
}

function resolveConversationAttribution(
  customer: {
    source: string | null;
    campaign: string | null;
    adset: string | null;
    ad: string | null;
    platform: string | null;
    medium: string | null;
  },
  attribution?: ResolvedAttribution
): ResolvedAttribution {
  return {
    source: customer.source ?? attribution?.source ?? "organic",
    campaign: customer.campaign ?? attribution?.campaign ?? undefined,
    adset: customer.adset ?? customer.platform ?? attribution?.adset ?? attribution?.platform ?? undefined,
    ad: customer.ad ?? customer.medium ?? attribution?.ad ?? attribution?.medium ?? undefined,
    platform: customer.platform ?? customer.adset ?? attribution?.adset ?? attribution?.platform ?? undefined,
    medium: customer.medium ?? customer.ad ?? attribution?.ad ?? attribution?.medium ?? undefined,
    shortlinkId: attribution?.shortlinkId
  };
}

export async function storeInboundMessage(input: StoreInboundMessageInput): Promise<InboundStoreResult> {
  const context = buildInboundContext(input);

  if (!context.orgId || !context.customerPhoneE164 || !context.waMessageId) {
    return emptyInboundResult();
  }

  const existing = await findExistingInboundByWaMessageId(context.waMessageId);
  if (existing) {
    return emptyInboundResult(true, existing.id);
  }

  const createdMessage = await storeInboundMessageInTransaction({
    context,
    resolveAttribution: async (tx: Prisma.TransactionClient) =>
      resolveInboundAttribution(tx, context.orgId, context.shortlinkCode),
    getOrCreateCustomer: async (tx: Prisma.TransactionClient, attribution) =>
      getOrCreateCustomer(tx, context.orgId, context.customerPhoneE164, context.customerDisplayName, attribution),
    getOrCreateConversation: async (tx: Prisma.TransactionClient, customerId, attribution, customer) =>
      getOrCreateOpenConversation(tx, context.orgId, customerId, resolveConversationAttribution(customer, attribution))
  });

  publishMessageNewEventNonBlocking({
    orgId: context.orgId,
    conversationId: createdMessage.conversationId,
    messageId: createdMessage.id,
    direction: "INBOUND"
  });
  publishInboundConversationUpdatedNonBlocking({
    orgId: context.orgId,
    conversationId: createdMessage.conversationId,
    assignedToMemberId: createdMessage.assignedToMemberId,
    status: createdMessage.conversationStatus
  });

  return {
    stored: true,
    duplicate: false,
    messageId: createdMessage.id,
    conversationId: createdMessage.conversationId,
    conversationStatus: createdMessage.conversationStatus,
    assignedToMemberId: createdMessage.assignedToMemberId
  };
}
