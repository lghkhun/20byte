import type { NextRequest } from "next/server";

import { requireApiSession } from "@/lib/auth/middleware";
import { errorResponse, successResponse } from "@/lib/api/http";
import { createShortlink, disableShortlink, listShortlinks } from "@/server/services/shortlinkService";
import { ServiceError } from "@/server/services/serviceError";

type CreateShortlinkRequest = {
  orgId?: unknown;
  destinationUrl?: unknown;
  source?: unknown;
  campaign?: unknown;
  adset?: unknown;
  ad?: unknown;
  adName?: unknown;
  platform?: unknown;
  medium?: unknown;
};

type DisableShortlinkRequest = {
  orgId?: unknown;
  shortlinkId?: unknown;
};

export async function GET(request: NextRequest) {
  const auth = requireApiSession(request);
  if (auth.response) {
    return auth.response;
  }

  const orgId = request.nextUrl.searchParams.get("orgId")?.trim() ?? "";

  try {
    const shortlinks = await listShortlinks(auth.session.userId, orgId);
    return successResponse(
      {
        shortlinks
      },
      200
    );
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.status, error.code, error.message);
    }

    return errorResponse(500, "SHORTLINK_LIST_FAILED", "Failed to load shortlinks.");
  }
}

export async function POST(request: NextRequest) {
  const auth = requireApiSession(request);
  if (auth.response) {
    return auth.response;
  }

  let body: CreateShortlinkRequest;
  try {
    body = (await request.json()) as CreateShortlinkRequest;
  } catch {
    return errorResponse(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  try {
    const shortlink = await createShortlink({
      actorUserId: auth.session.userId,
      orgId: typeof body.orgId === "string" ? body.orgId : "",
      destinationUrl: typeof body.destinationUrl === "string" ? body.destinationUrl : "",
      source: typeof body.source === "string" ? body.source : undefined,
      campaign: typeof body.campaign === "string" ? body.campaign : undefined,
      adset: typeof body.adset === "string" ? body.adset : undefined,
      ad: typeof body.ad === "string" ? body.ad : undefined,
      adName: typeof body.adName === "string" ? body.adName : undefined,
      platform: typeof body.platform === "string" ? body.platform : undefined,
      medium: typeof body.medium === "string" ? body.medium : undefined
    });

    return successResponse(
      {
        shortlink
      },
      201
    );
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.status, error.code, error.message);
    }

    return errorResponse(500, "SHORTLINK_CREATE_FAILED", "Failed to create shortlink.");
  }
}

export async function PATCH(request: NextRequest) {
  const auth = requireApiSession(request);
  if (auth.response) {
    return auth.response;
  }

  let body: DisableShortlinkRequest;
  try {
    body = (await request.json()) as DisableShortlinkRequest;
  } catch {
    return errorResponse(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  try {
    const shortlink = await disableShortlink(
      auth.session.userId,
      typeof body.orgId === "string" ? body.orgId : "",
      typeof body.shortlinkId === "string" ? body.shortlinkId : ""
    );

    return successResponse(
      {
        shortlink
      },
      200
    );
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.status, error.code, error.message);
    }

    return errorResponse(500, "SHORTLINK_DISABLE_FAILED", "Failed to disable shortlink.");
  }
}
