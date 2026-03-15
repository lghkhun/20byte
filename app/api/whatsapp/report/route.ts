import type { NextRequest } from "next/server";

import { errorResponse, successResponse } from "@/lib/api/http";
import { requireApiSession } from "@/lib/auth/middleware";
import { getPrimaryOrganizationForUser } from "@/server/services/organizationService";
import { getBaileysAccountReport } from "@/server/services/baileysService";
import { ServiceError } from "@/server/services/serviceError";

async function resolveSessionOrgId(userId: string, candidate: string): Promise<string> {
  const normalized = candidate.trim();
  if (normalized) {
    return normalized;
  }

  const primaryOrganization = await getPrimaryOrganizationForUser(userId);
  if (!primaryOrganization) {
    throw new ServiceError(404, "ORG_NOT_FOUND", "No business is available for this account.");
  }

  return primaryOrganization.id;
}

export async function GET(request: NextRequest) {
  const auth = requireApiSession(request);
  if (auth.response) {
    return auth.response;
  }

  try {
    const orgId = await resolveSessionOrgId(auth.session.userId, request.nextUrl.searchParams.get("orgId")?.trim() ?? "");
    const report = await getBaileysAccountReport(auth.session.userId, orgId);
    return successResponse({ report }, 200);
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.status, error.code, error.message);
    }

    return errorResponse(500, "WHATSAPP_REPORT_FAILED", "Failed to load WhatsApp report.");
  }
}
