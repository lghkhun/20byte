import { Role } from "@prisma/client";
import { type NextRequest, NextResponse } from "next/server";

import { requireApiSession } from "@/lib/auth/middleware";
import {
  inviteOrganizationMemberByEmail,
  listOrganizationMembers
} from "@/server/services/organizationService";
import { ServiceError } from "@/server/services/serviceError";

type AddMemberRequest = {
  orgId?: unknown;
  email?: unknown;
  name?: unknown;
  role?: unknown;
};

const ASSIGNABLE_MEMBER_ROLES = new Set<Role>([Role.CS, Role.ADVERTISER]);

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

function parseAssignableRole(value: unknown): Role | null {
  if (typeof value !== "string") {
    return null;
  }

  const role = value.toUpperCase() as Role;
  return ASSIGNABLE_MEMBER_ROLES.has(role) ? role : null;
}

export async function GET(request: NextRequest) {
  const auth = requireApiSession(request);
  if (auth.response) {
    return auth.response;
  }

  const orgId = request.nextUrl.searchParams.get("orgId")?.trim() ?? "";
  if (!orgId) {
    return errorResponse(400, "MISSING_ORG_ID", "orgId is required.");
  }

  try {
    const members = await listOrganizationMembers(auth.session.userId, orgId);
    return NextResponse.json(
      {
        data: {
          members
        },
        meta: {}
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.status, error.code, error.message);
    }

    return errorResponse(500, "ORG_MEMBER_LIST_FAILED", "Failed to fetch business members.");
  }
}

export async function POST(request: NextRequest) {
  const auth = requireApiSession(request);
  if (auth.response) {
    return auth.response;
  }

  let body: AddMemberRequest;
  try {
    body = (await request.json()) as AddMemberRequest;
  } catch {
    return errorResponse(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const orgId = typeof body.orgId === "string" ? body.orgId.trim() : "";
  const email = typeof body.email === "string" ? body.email : "";
  const name = typeof body.name === "string" ? body.name : "";
  const role = parseAssignableRole(body.role);

  if (!orgId) {
    return errorResponse(400, "MISSING_ORG_ID", "orgId is required.");
  }

  if (!role) {
    return errorResponse(400, "INVALID_ROLE", "role must be one of: CS, ADVERTISER.");
  }

  try {
    const result = await inviteOrganizationMemberByEmail({
      actorUserId: auth.session.userId,
      orgId,
      email,
      name,
      role
    });

    return NextResponse.json(
      {
        data: {
          member: result.member,
          invitation: result.invitation
        },
        meta: {}
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.status, error.code, error.message);
    }

    return errorResponse(500, "ORG_MEMBER_INVITE_FAILED", "Failed to invite business member.");
  }
}
