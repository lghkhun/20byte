import type { NextRequest } from "next/server";

import { errorResponse, successResponse } from "@/lib/api/http";
import { requireApiSession } from "@/lib/auth/middleware";
import { getPrimaryOrganizationForUser } from "@/server/services/organizationService";
import {
  disconnectBaileysSession,
  getBaileysConnectionContext,
  startBaileysQrSession,
  startBaileysPairing,
  writeBaileysAuditLog
} from "@/server/services/baileysService";
import { ServiceError } from "@/server/services/serviceError";

type StartPairingRequest = {
  orgId?: unknown;
  mode?: unknown;
  phoneNumber?: unknown;
};

export const runtime = "nodejs";

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
    const context = await getBaileysConnectionContext(auth.session.userId, orgId, {
      refresh: request.nextUrl.searchParams.get("refresh") === "1"
    });
    return successResponse({ connection: context }, 200);
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.status, error.code, error.message);
    }

    return errorResponse(500, "BAILEYS_CONTEXT_FAILED", "Failed to load Baileys connection context.");
  }
}

export async function POST(request: NextRequest) {
  const auth = requireApiSession(request);
  if (auth.response) {
    return auth.response;
  }

  let body: StartPairingRequest;
  try {
    body = (await request.json()) as StartPairingRequest;
  } catch {
    return errorResponse(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  try {
    const mode = typeof body.mode === "string" ? body.mode : "pairing_code";
    if (mode === "qr") {
      const orgId = await resolveSessionOrgId(auth.session.userId, typeof body.orgId === "string" ? body.orgId : "");
      const result = await startBaileysQrSession({
        actorUserId: auth.session.userId,
        orgId
      });

      await writeBaileysAuditLog(auth.session.userId, result.orgId, "baileys.qr_requested", result.orgId, {
        expiresInSeconds: result.expiresInSeconds
      });

      return successResponse({ qr: result }, 200);
    }

    const orgId = await resolveSessionOrgId(auth.session.userId, typeof body.orgId === "string" ? body.orgId : "");
    const result = await startBaileysPairing({
      actorUserId: auth.session.userId,
      orgId,
      phoneNumber: typeof body.phoneNumber === "string" ? body.phoneNumber : ""
    });

    await writeBaileysAuditLog(auth.session.userId, result.orgId, "baileys.pairing_requested", result.orgId, {
      expiresInSeconds: result.expiresInSeconds
    });

    return successResponse({ pairing: result }, 200);
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.status, error.code, error.message);
    }

    return errorResponse(500, "BAILEYS_PAIRING_FAILED", "Failed to generate Baileys pairing code.");
  }
}

export async function DELETE(request: NextRequest) {
  const auth = requireApiSession(request);
  if (auth.response) {
    return auth.response;
  }

  try {
    const orgId = await resolveSessionOrgId(auth.session.userId, request.nextUrl.searchParams.get("orgId")?.trim() ?? "");
    await disconnectBaileysSession({
      actorUserId: auth.session.userId,
      orgId
    });

    await writeBaileysAuditLog(auth.session.userId, orgId, "baileys.disconnected", orgId);
    return successResponse({ disconnected: true }, 200);
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.status, error.code, error.message);
    }

    return errorResponse(500, "BAILEYS_DISCONNECT_FAILED", "Failed to disconnect Baileys session.");
  }
}
