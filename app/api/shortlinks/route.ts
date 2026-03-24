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

function withServerTiming<T>(response: T, startedAt: number): T {
  const durationMs = Number((performance.now() - startedAt).toFixed(1));
  if (response instanceof Response) {
    response.headers.set("Server-Timing", `app;dur=${durationMs}`);
  }
  return response;
}

export async function GET(request: NextRequest) {
  const startedAt = performance.now();
  const auth = requireApiSession(request);
  if (auth.response) {
    return withServerTiming(auth.response, startedAt);
  }

  try {
    const orgId = await resolvePrimaryOrganizationIdForUser(
      auth.session.userId,
      request.nextUrl.searchParams.get("orgId")?.trim() ?? ""
    );
    const shortlinks = await listShortlinks(auth.session.userId, orgId);
    return withServerTiming(successResponse(
      {
        shortlinks
      },
      200
    ), startedAt);
  } catch (error) {
    if (error instanceof ServiceError) {
      return withServerTiming(errorResponse(error.status, error.code, error.message), startedAt);
    }

    return withServerTiming(errorResponse(500, "SHORTLINK_LIST_FAILED", "Failed to load shortlinks."), startedAt);
  }
}

export async function POST(request: NextRequest) {
  const startedAt = performance.now();
  const auth = requireApiSession(request);
  if (auth.response) {
    return withServerTiming(auth.response, startedAt);
  }

  let body: CreateShortlinkRequest;
  try {
    body = (await request.json()) as CreateShortlinkRequest;
  } catch {
    return withServerTiming(errorResponse(400, "INVALID_JSON", "Request body must be valid JSON."), startedAt);
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

    return withServerTiming(successResponse(
      {
        shortlink
      },
      201
    ), startedAt);
  } catch (error) {
    if (error instanceof ServiceError) {
      return withServerTiming(errorResponse(error.status, error.code, error.message), startedAt);
    }

    return withServerTiming(errorResponse(500, "SHORTLINK_CREATE_FAILED", "Failed to create shortlink."), startedAt);
  }
}

export async function PATCH(request: NextRequest) {
  const startedAt = performance.now();
  const auth = requireApiSession(request);
  if (auth.response) {
    return withServerTiming(auth.response, startedAt);
  }

  let body: DisableShortlinkRequest;
  try {
    body = (await request.json()) as DisableShortlinkRequest;
  } catch {
    return withServerTiming(errorResponse(400, "INVALID_JSON", "Request body must be valid JSON."), startedAt);
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

      return withServerTiming(successResponse(
        {
          shortlink
        },
        200
      ), startedAt);
    }

    const shortlink = await setShortlinkEnabled(auth.session.userId, orgId, shortlinkId, isEnabled ?? false);

    return withServerTiming(successResponse(
      {
        shortlink
      },
      200
    ), startedAt);
  } catch (error) {
    if (error instanceof ServiceError) {
      return withServerTiming(errorResponse(error.status, error.code, error.message), startedAt);
    }

    return withServerTiming(errorResponse(500, "SHORTLINK_DISABLE_FAILED", "Failed to disable shortlink."), startedAt);
  }
}

export async function DELETE(request: NextRequest) {
  const startedAt = performance.now();
  const auth = requireApiSession(request);
  if (auth.response) {
    return withServerTiming(auth.response, startedAt);
  }

  let body: DisableShortlinkRequest;
  try {
    body = (await request.json()) as DisableShortlinkRequest;
  } catch {
    return withServerTiming(errorResponse(400, "INVALID_JSON", "Request body must be valid JSON."), startedAt);
  }

  try {
    const orgId = await resolvePrimaryOrganizationIdForUser(
      auth.session.userId,
      typeof body.orgId === "string" ? body.orgId : ""
    );
    const shortlinkId = typeof body.shortlinkId === "string" ? body.shortlinkId : "";
    await deleteShortlink(auth.session.userId, orgId, shortlinkId);

    return withServerTiming(successResponse(
      {
        deleted: true
      },
      200
    ), startedAt);
  } catch (error) {
    if (error instanceof ServiceError) {
      return withServerTiming(errorResponse(error.status, error.code, error.message), startedAt);
    }

    return withServerTiming(errorResponse(500, "SHORTLINK_DELETE_FAILED", "Failed to delete shortlink."), startedAt);
  }
}
