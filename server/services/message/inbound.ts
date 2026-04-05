import { extractInvisibleAttributionMarker } from "@/lib/attribution/invisibleMarker";
import { extractTrackingRef } from "@/lib/attribution/trackingRef";
import { enqueueMetaEventJob } from "@/server/queues/metaEventQueue";
import type { Prisma } from "@prisma/client";

import type { InboundStoreResult, ResolvedAttribution, StoreInboundMessageInput } from "@/server/services/message/messageTypes";
import { normalize, normalizeFileSize, normalizeMessageText, normalizeOptional } from "@/server/services/message/messageUtils";
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

  const rawText = normalizeOptional(input.text);
  const trackingExtract = extractTrackingRef(rawText);
  const invisibleExtract = extractInvisibleAttributionMarker(trackingExtract.cleanText);
  const resolvedShortlinkCode =
    normalizeOptional(input.shortlinkCode) ?? trackingExtract.shortlinkCodeFromRef ?? invisibleExtract.shortlinkCode;

  return {
    orgId,
    customerPhoneE164,
    waChatJid: normalizeOptional(input.waChatJid),
    waMessageId,
    customerDisplayName: normalizeOptional(input.customerDisplayName),
    customerAvatarUrl: normalizeOptional(input.customerAvatarUrl),
    shortlinkCode: resolvedShortlinkCode,
    trackingId: normalizeOptional(input.trackingId) ?? trackingExtract.trackingId,
    replyToWaMessageId: normalizeOptional(input.replyToWaMessageId),
    replyPreviewText: normalizeMessageText(input.replyPreviewText),
    text: normalizeMessageText(invisibleExtract.cleanText),
    mediaId: normalizeOptional(input.mediaId),
    mediaUrl: normalizeOptional(input.mediaUrl),
    mimeType: normalizeOptional(input.mimeType),
    fileName: normalizeOptional(input.fileName),
    fileSize: normalizeFileSize(input.fileSize),
    durationSec: typeof input.durationSec === "number" && Number.isFinite(input.durationSec) ? Math.max(0, Math.floor(input.durationSec)) : undefined,
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
    resolveAttribution: async (tx: Prisma.TransactionClient) => {
      const resolved = await resolveInboundAttribution(tx, context.orgId, context.shortlinkCode, context.trackingId);
      return {
        source: resolved?.source ?? "organic",
        campaign: resolved?.campaign,
        adset: resolved?.adset,
        ad: resolved?.ad,
        platform: resolved?.platform,
        medium: resolved?.medium,
        shortlinkId: resolved?.shortlinkId,
        trackingId: context.trackingId
      };
    },
    getOrCreateCustomer: async (tx: Prisma.TransactionClient, attribution) =>
      getOrCreateCustomer(
        tx,
        context.orgId,
        context.customerPhoneE164,
        context.customerDisplayName,
        context.customerAvatarUrl,
        attribution
      ),
    getOrCreateConversation: async (tx: Prisma.TransactionClient, customerId, attribution, customer) =>
      getOrCreateOpenConversation(tx, context.orgId, customerId, resolveConversationAttribution(customer, attribution), context.waChatJid)
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

  if (createdMessage.conversationCreated && context.trackingId) {
    void enqueueMetaEventJob({
      orgId: context.orgId,
      kind: "CHAT_STARTED",
      conversationId: createdMessage.conversationId,
      trackingId: context.trackingId,
      customerPhoneE164: context.customerPhoneE164
    }).catch(() => undefined);
  }

  return {
    stored: true,
    duplicate: false,
    messageId: createdMessage.id,
    conversationId: createdMessage.conversationId,
    conversationStatus: createdMessage.conversationStatus,
    assignedToMemberId: createdMessage.assignedToMemberId
  };
}
