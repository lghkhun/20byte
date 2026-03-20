import type { NextRequest } from "next/server";

import { errorResponse, successResponse } from "@/lib/api/http";
import { prisma } from "@/lib/db/prisma";
import { requireApiSession } from "@/lib/auth/middleware";
import { getMetaEventQueueSize } from "@/server/queues/metaEventQueue";
import { resolvePrimaryOrganizationIdForUser } from "@/server/services/organizationService";
import { getMetaIntegration } from "@/server/services/metaIntegrationService";
import { ServiceError } from "@/server/services/serviceError";

type MetaStatusData = {
  queueDepth: number | null;
  sent24h: number;
  failed24h: number;
  lastSentAt: string | null;
  lastFailedAt: string | null;
  lastFailedReason: string | null;
};

function parseFailedReason(metaJson: string): string | null {
  try {
    const parsed = JSON.parse(metaJson) as { response?: string };
    return typeof parsed.response === "string" ? parsed.response : null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const auth = requireApiSession(request);
  if (auth.response) {
    return auth.response;
  }

  try {
    const orgId = await resolvePrimaryOrganizationIdForUser(
      auth.session.userId,
      request.nextUrl.searchParams.get("orgId")?.trim() ?? ""
    );
    await getMetaIntegration(auth.session.userId, orgId);

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [sent24h, failed24h, lastSent, lastFailed] = await Promise.all([
      prisma.auditLog.count({
        where: {
          orgId,
          action: "meta.event.sent",
          createdAt: {
            gte: since
          }
        }
      }),
      prisma.auditLog.count({
        where: {
          orgId,
          action: "meta.event.failed",
          createdAt: {
            gte: since
          }
        }
      }),
      prisma.auditLog.findFirst({
        where: {
          orgId,
          action: "meta.event.sent"
        },
        orderBy: {
          createdAt: "desc"
        },
        select: {
          createdAt: true
        }
      }),
      prisma.auditLog.findFirst({
        where: {
          orgId,
          action: "meta.event.failed"
        },
        orderBy: {
          createdAt: "desc"
        },
        select: {
          createdAt: true,
          metaJson: true
        }
      })
    ]);

    let queueDepth: number | null = null;
    try {
      queueDepth = await getMetaEventQueueSize();
    } catch {
      queueDepth = null;
    }

    const status: MetaStatusData = {
      queueDepth,
      sent24h,
      failed24h,
      lastSentAt: lastSent?.createdAt?.toISOString?.() ?? null,
      lastFailedAt: lastFailed?.createdAt?.toISOString?.() ?? null,
      lastFailedReason: lastFailed ? parseFailedReason(lastFailed.metaJson) : null
    };

    return successResponse({ status }, 200);
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.status, error.code, error.message);
    }
    return errorResponse(500, "META_STATUS_LOAD_FAILED", "Failed to load Meta event status.");
  }
}
