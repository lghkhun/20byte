import type { NextRequest } from "next/server";

import { errorResponse, successResponse } from "@/lib/api/http";
import { requireApiSession } from "@/lib/auth/middleware";
import { resolvePrimaryOrganizationIdForUser } from "@/server/services/organizationService";
import {
  deleteOrgWhatsAppPublicWebhook,
  getOrgWhatsAppPublicWebhook,
  upsertOrgWhatsAppPublicWebhook
} from "@/server/services/whatsappPublicApiService";
import { ServiceError } from "@/server/services/serviceError";

type WebhookBody = {
  orgId?: unknown;
  url?: unknown;
  enabled?: unknown;
  regenerateSecret?: unknown;
  eventFilters?: unknown;
};

function parseCandidateOrgId(request: NextRequest): string {
  return request.nextUrl.searchParams.get("orgId")?.trim() ?? "";
}

export async function GET(request: NextRequest) {
  const auth = requireApiSession(request);
  if (auth.response) {
    return auth.response;
  }

  try {
    const orgId = await resolvePrimaryOrganizationIdForUser(auth.session.userId, parseCandidateOrgId(request));
    const result = await getOrgWhatsAppPublicWebhook({
      actorUserId: auth.session.userId,
      orgId
    });
    return successResponse(result, 200);
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.status, error.code, error.message);
    }
    return errorResponse(500, "WHATSAPP_PUBLIC_WEBHOOK_GET_FAILED", "Failed to load webhook config.");
  }
}

export async function PUT(request: NextRequest) {
  const auth = requireApiSession(request);
  if (auth.response) {
    return auth.response;
  }

  let body: WebhookBody;
  try {
    body = (await request.json()) as WebhookBody;
  } catch {
    return errorResponse(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  try {
    const candidateOrgId = typeof body.orgId === "string" ? body.orgId.trim() : "";
    const orgId = await resolvePrimaryOrganizationIdForUser(auth.session.userId, candidateOrgId);
    const result = await upsertOrgWhatsAppPublicWebhook({
      actorUserId: auth.session.userId,
      orgId,
      url: body.url,
      enabled: body.enabled,
      regenerateSecret: body.regenerateSecret,
      eventFilters: body.eventFilters
    });
    return successResponse(result, 200);
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.status, error.code, error.message);
    }
    return errorResponse(500, "WHATSAPP_PUBLIC_WEBHOOK_PUT_FAILED", "Failed to save webhook config.");
  }
}

export async function DELETE(request: NextRequest) {
  const auth = requireApiSession(request);
  if (auth.response) {
    return auth.response;
  }

  let body: WebhookBody = {};
  try {
    body = (await request.json()) as WebhookBody;
  } catch {
    // optional body
  }

  try {
    const candidateOrgId = typeof body.orgId === "string" ? body.orgId.trim() : parseCandidateOrgId(request);
    const orgId = await resolvePrimaryOrganizationIdForUser(auth.session.userId, candidateOrgId);
    const result = await deleteOrgWhatsAppPublicWebhook({
      actorUserId: auth.session.userId,
      orgId
    });
    return successResponse(result, 200);
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.status, error.code, error.message);
    }
    return errorResponse(500, "WHATSAPP_PUBLIC_WEBHOOK_DELETE_FAILED", "Failed to delete webhook config.");
  }
}
