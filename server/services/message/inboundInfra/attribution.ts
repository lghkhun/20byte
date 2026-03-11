import type { Prisma } from "@prisma/client";

import type { ResolvedAttribution } from "@/server/services/message/messageTypes";
import { normalizeOptional } from "@/server/services/message/messageUtils";

export async function resolveInboundAttribution(
  tx: Prisma.TransactionClient,
  orgId: string,
  shortlinkCode?: string
): Promise<ResolvedAttribution | undefined> {
  const normalizedCode = normalizeOptional(shortlinkCode)?.toLowerCase();
  if (!normalizedCode) {
    return {
      source: "organic"
    };
  }

  const shortlink = await tx.shortlink.findFirst({
    where: {
      orgId,
      code: normalizedCode,
      isEnabled: true
    },
    select: {
      id: true,
      source: true,
      campaign: true,
      adset: true,
      adName: true,
      platform: true,
      medium: true
    }
  });

  if (!shortlink) {
    return {
      source: "organic"
    };
  }

  return {
    source: shortlink.source || "meta_ads",
    campaign: shortlink.campaign ?? undefined,
    adset: shortlink.adset ?? shortlink.platform ?? undefined,
    ad: shortlink.adName ?? shortlink.medium ?? undefined,
    platform: shortlink.adset ?? shortlink.platform ?? undefined,
    medium: shortlink.adName ?? shortlink.medium ?? undefined,
    shortlinkId: shortlink.id
  };
}
