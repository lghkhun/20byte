import type { NextRequest } from "next/server";

import { requireApiSession } from "@/lib/auth/middleware";
import { errorResponse, successResponse } from "@/lib/api/http";
import { resolvePrimaryOrganizationIdForUser } from "@/server/services/organizationService";
import { createShortlink, deleteShortlink, listShortlinks, setShortlinkEnabled, updateShortlink } from "@/server/services/shortlinkService";
import { ServiceError } from "@/server/services/serviceError";

type CreateShortlinkRequest = {
  orgId?: unknown;
  destinationUrl?: unknown;
  templateMessage?: unknown;
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
  isEnabled?: unknown;
  templateMessage?: unknown;
  source?: unknown;
  campaign?: unknown;
  adset?: unknown;
  ad?: unknown;
  adName?: unknown;
  platform?: unknown;
  medium?: unknown;
};

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
    const orgId = await resolvePrimaryOrganizationIdForUser(
      auth.session.userId,
      typeof body.orgId === "string" ? body.orgId : ""
    );
    const shortlink = await createShortlink({
      actorUserId: auth.session.userId,
      orgId,
      destinationUrl: typeof body.destinationUrl === "string" ? body.destinationUrl : "",
      templateMessage: typeof body.templateMessage === "string" ? body.templateMessage : undefined,
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
    const orgId = await resolvePrimaryOrganizationIdForUser(
      auth.session.userId,
      typeof body.orgId === "string" ? body.orgId : ""
    );
    const shortlinkId = typeof body.shortlinkId === "string" ? body.shortlinkId : "";
    const isEnabled = typeof body.isEnabled === "boolean" ? body.isEnabled : undefined;

    const shouldUpdateFields =
      typeof body.templateMessage === "string" ||
      typeof body.source === "string" ||
      typeof body.campaign === "string" ||
      typeof body.adset === "string" ||
      typeof body.ad === "string" ||
      typeof body.adName === "string" ||
      typeof body.platform === "string" ||
      typeof body.medium === "string";

    if (shouldUpdateFields) {
      const shortlink = await updateShortlink({
        actorUserId: auth.session.userId,
        orgId,
        shortlinkId,
        templateMessage: typeof body.templateMessage === "string" ? body.templateMessage : undefined,
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
        200
      );
    }

    const shortlink = await setShortlinkEnabled(auth.session.userId, orgId, shortlinkId, isEnabled ?? false);

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

export async function DELETE(request: NextRequest) {
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
    const orgId = await resolvePrimaryOrganizationIdForUser(
      auth.session.userId,
      typeof body.orgId === "string" ? body.orgId : ""
    );
    const shortlinkId = typeof body.shortlinkId === "string" ? body.shortlinkId : "";
    await deleteShortlink(auth.session.userId, orgId, shortlinkId);

    return successResponse(
      {
        deleted: true
      },
      200
    );
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.status, error.code, error.message);
    }

    return errorResponse(500, "SHORTLINK_DELETE_FAILED", "Failed to delete shortlink.");
  }
}
