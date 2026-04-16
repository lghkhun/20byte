import type { NextRequest } from "next/server";

import { errorResponse, successResponse } from "@/lib/api/http";
import { requireApiSession } from "@/lib/auth/middleware";
import { resolvePrimaryOrganizationIdForUser } from "@/server/services/organizationService";
import {
  generateOrRotateOrgWhatsAppPublicApiKey,
  getOrgWhatsAppPublicApiKey,
  revokeOrgWhatsAppPublicApiKey
} from "@/server/services/whatsappPublicApiService";
import { ServiceError } from "@/server/services/serviceError";

type KeyMutationBody = {
  orgId?: unknown;
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
    const result = await getOrgWhatsAppPublicApiKey({
      actorUserId: auth.session.userId,
      orgId
    });

    return successResponse(result, 200);
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.status, error.code, error.message);
    }
    return errorResponse(500, "WHATSAPP_PUBLIC_API_KEY_GET_FAILED", "Failed to load WhatsApp Public API key.");
  }
}

export async function POST(request: NextRequest) {
  const auth = requireApiSession(request);
  if (auth.response) {
    return auth.response;
  }

  let body: KeyMutationBody = {};
  try {
    body = (await request.json()) as KeyMutationBody;
  } catch {
    // optional body
  }

  try {
    const candidateOrgId = typeof body.orgId === "string" ? body.orgId.trim() : "";
    const orgId = await resolvePrimaryOrganizationIdForUser(auth.session.userId, candidateOrgId);
    const result = await generateOrRotateOrgWhatsAppPublicApiKey({
      actorUserId: auth.session.userId,
      orgId
    });

    return successResponse(result, 200);
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.status, error.code, error.message);
    }
    return errorResponse(500, "WHATSAPP_PUBLIC_API_KEY_ROTATE_FAILED", "Failed to generate API key.");
  }
}

export async function DELETE(request: NextRequest) {
  const auth = requireApiSession(request);
  if (auth.response) {
    return auth.response;
  }

  let body: KeyMutationBody = {};
  try {
    body = (await request.json()) as KeyMutationBody;
  } catch {
    // optional body
  }

  try {
    const candidateOrgId = typeof body.orgId === "string" ? body.orgId.trim() : parseCandidateOrgId(request);
    const orgId = await resolvePrimaryOrganizationIdForUser(auth.session.userId, candidateOrgId);
    const result = await revokeOrgWhatsAppPublicApiKey({
      actorUserId: auth.session.userId,
      orgId
    });

    return successResponse(result, 200);
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.status, error.code, error.message);
    }
    return errorResponse(500, "WHATSAPP_PUBLIC_API_KEY_REVOKE_FAILED", "Failed to revoke API key.");
  }
}
