import type { NextRequest } from "next/server";

import { errorResponse, successResponse } from "@/lib/api/http";
import { requireApiSession } from "@/lib/auth/middleware";
import { getPrimaryOrganizationForUser } from "@/server/services/organizationService";
import { getOrgSubscriptionView } from "@/server/services/billingService";
import { triggerOrgBillingReminderBroadcast } from "@/server/services/billingReminderService";
import { ServiceError } from "@/server/services/serviceError";

type OrgSubscriptionView = Awaited<ReturnType<typeof getOrgSubscriptionView>>;

const CACHE_TTL_MS = 15_000;
const subscriptionCache = new Map<string, { expiresAt: number; data: OrgSubscriptionView }>();
const subscriptionInflight = new Map<string, Promise<OrgSubscriptionView>>();

async function getCachedOrgSubscriptionView(
  userId: string,
  orgId: string
): Promise<{ data: OrgSubscriptionView; fromCache: boolean }> {
  const cacheKey = `${userId}:${orgId}`;
  const now = Date.now();
  const cached = subscriptionCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return { data: cached.data, fromCache: true };
  }

  const inflight = subscriptionInflight.get(cacheKey);
  if (inflight) {
    return { data: await inflight, fromCache: true };
  }

  const request = (async () => {
    const data = await getOrgSubscriptionView(userId, orgId);
    subscriptionCache.set(cacheKey, {
      expiresAt: Date.now() + CACHE_TTL_MS,
      data
    });
    return data;
  })();

  subscriptionInflight.set(cacheKey, request);
  try {
    return { data: await request, fromCache: false };
  } finally {
    subscriptionInflight.delete(cacheKey);
  }
}

export async function GET(request: NextRequest) {
  const auth = requireApiSession(request);
  if (auth.response) {
    return auth.response;
  }

  const orgIdInput = request.nextUrl.searchParams.get("orgId")?.trim() ?? "";

  try {
    const primary = await getPrimaryOrganizationForUser(auth.session.userId);
    const orgId = orgIdInput || primary?.id || "";
    if (!orgId) {
      return errorResponse(404, "ORG_NOT_FOUND", "No business is available for this account.");
    }

    const { data: result, fromCache } = await getCachedOrgSubscriptionView(auth.session.userId, orgId);
    if (!fromCache) {
      void triggerOrgBillingReminderBroadcast({
        orgId,
        shouldBroadcastWhatsapp: Boolean(result.reminder?.shouldBroadcastWhatsapp),
        message: result.reminder?.message ?? ""
      });
    }
    return successResponse(result, 200);
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.status, error.code, error.message);
    }

    return errorResponse(500, "BILLING_SUBSCRIPTION_FAILED", "Failed to load subscription.");
  }
}
