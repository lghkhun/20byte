import type { Prisma } from "@prisma/client";

import type { ResolvedAttribution } from "@/server/services/message/messageTypes";
import { normalizeOptional } from "@/server/services/message/messageUtils";

export async function resolveInboundAttribution(
  tx: Prisma.TransactionClient,
  orgId: string,
  shortlinkCode?: string,
  trackingId?: string
): Promise<ResolvedAttribution | undefined> {
  const normalizedCode = normalizeOptional(shortlinkCode)?.toLowerCase();
  const normalizedTrackingId = normalizeOptional(trackingId)?.toLowerCase();
  let shortlink:
    | {
        id: string;
        source: string;
        campaign: string | null;
        adset: string | null;
        adName: string | null;
        platform: string | null;
        medium: string | null;
      }
    | null = null;
  let clickMeta:
    | {
        fbclid: string | null;
        fbc: string | null;
        fbp: string | null;
      }
    | null = null;

  if (normalizedTrackingId) {
    const click = await tx.shortlinkClick.findFirst({
      where: {
        orgId,
        trackingId: normalizedTrackingId
      },
      select: {
        fbclid: true,
        fbc: true,
        fbp: true,
        shortlink: {
          select: {
            id: true,
            source: true,
            campaign: true,
            adset: true,
            adName: true,
            platform: true,
            medium: true
          }
        }
      }
    });
    shortlink = click?.shortlink ?? null;
    clickMeta = click
      ? {
          fbclid: click.fbclid ?? null,
          fbc: click.fbc ?? null,
          fbp: click.fbp ?? null
        }
      : null;
  }

  if (!shortlink && normalizedCode) {
    shortlink = await tx.shortlink.findFirst({
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
  }

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
    shortlinkId: shortlink.id,
    fbclid: clickMeta?.fbclid ?? undefined,
    fbc: clickMeta?.fbc ?? undefined,
    fbp: clickMeta?.fbp ?? undefined
  };
}
