import { ServiceError } from "@/server/services/serviceError";

export function normalizeShortlinkValue(value: string | undefined): string {
  return (value ?? "").trim();
}

export function assertWhatsAppDestination(url: string): void {
  if (!url.startsWith("https://wa.me/") && !url.startsWith("https://api.whatsapp.com/send")) {
    throw new ServiceError(400, "INVALID_DESTINATION_URL", "destinationUrl must target wa.me or api.whatsapp.com/send.");
  }
}

export function resolveShortlinkAttribution(input: {
  source?: string;
  campaign?: string;
  adset?: string;
  ad?: string;
  adName?: string;
  platform?: string;
  medium?: string;
}): {
  source: string;
  campaign: string | null;
  adset: string | null;
  adName: string | null;
  platform: string | null;
  medium: string | null;
} {
  const source = normalizeShortlinkValue(input.source) || "meta_ads";
  const campaign = normalizeShortlinkValue(input.campaign) || null;
  const adset = normalizeShortlinkValue(input.adset) || normalizeShortlinkValue(input.platform) || null;
  const adName =
    normalizeShortlinkValue(input.ad) || normalizeShortlinkValue(input.adName) || normalizeShortlinkValue(input.medium) || null;
  const platform = normalizeShortlinkValue(input.platform) || null;
  const medium = normalizeShortlinkValue(input.medium) || null;

  return {
    source,
    campaign,
    adset,
    adName,
    platform,
    medium
  };
}
