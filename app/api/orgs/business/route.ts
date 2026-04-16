import { type NextRequest, NextResponse } from "next/server";

import { getActiveOrgIdFromRequest } from "@/lib/auth/activeOrg";
import { requireApiSession } from "@/lib/auth/middleware";
import {
  getOrganizationBusinessProfile,
  updateOrganizationBusinessProfile
} from "@/server/services/organizationService";
import { ServiceError } from "@/server/services/serviceError";

type UpdateBusinessProfileRequest = {
  orgId?: unknown;
  name?: unknown;
  legalName?: unknown;
  responsibleName?: unknown;
  businessPhone?: unknown;
  businessEmail?: unknown;
  businessNpwp?: unknown;
  businessAddress?: unknown;
  logoUrl?: unknown;
  invoiceSignatureUrl?: unknown;
};

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json(
    {
      error: {
        code,
        message
      }
    },
    { status }
  );
}

function parseOptionalString(value: unknown): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  return typeof value === "string" ? value : undefined;
}

export async function GET(request: NextRequest) {
  const auth = requireApiSession(request);
  if (auth.response) {
    return auth.response;
  }

  try {
    const activeOrgId = getActiveOrgIdFromRequest(request);
    const profile = await getOrganizationBusinessProfile(
      auth.session.userId,
      request.nextUrl.searchParams.get("orgId")?.trim() ?? activeOrgId
    );
    return NextResponse.json({ data: { profile }, meta: {} }, { status: 200 });
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.status, error.code, error.message);
    }

    return errorResponse(500, "ORG_BUSINESS_PROFILE_FAILED", "Failed to load business profile.");
  }
}

export async function PATCH(request: NextRequest) {
  const auth = requireApiSession(request);
  if (auth.response) {
    return auth.response;
  }

  let body: UpdateBusinessProfileRequest;
  try {
    body = (await request.json()) as UpdateBusinessProfileRequest;
  } catch {
    return errorResponse(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  if (typeof body.name !== "string" || !body.name.trim()) {
    return errorResponse(400, "INVALID_BUSINESS_NAME", "Business name is required.");
  }

  try {
    const activeOrgId = getActiveOrgIdFromRequest(request);
    const profile = await updateOrganizationBusinessProfile({
      actorUserId: auth.session.userId,
      orgId:
        typeof body.orgId === "string" && body.orgId.trim()
          ? body.orgId
          : activeOrgId || undefined,
      name: body.name,
      legalName: parseOptionalString(body.legalName),
      responsibleName: parseOptionalString(body.responsibleName),
      businessPhone: parseOptionalString(body.businessPhone),
      businessEmail: parseOptionalString(body.businessEmail),
      businessNpwp: parseOptionalString(body.businessNpwp),
      businessAddress: parseOptionalString(body.businessAddress),
      logoUrl: parseOptionalString(body.logoUrl),
      invoiceSignatureUrl: parseOptionalString(body.invoiceSignatureUrl)
    });

    return NextResponse.json({ data: { profile }, meta: {} }, { status: 200 });
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.status, error.code, error.message);
    }

    return errorResponse(500, "ORG_BUSINESS_PROFILE_UPDATE_FAILED", "Failed to update business profile.");
  }
}
