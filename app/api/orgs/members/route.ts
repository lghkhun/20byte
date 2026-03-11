import { Role } from "@prisma/client";
import { type NextRequest, NextResponse } from "next/server";

import { requireApiSession } from "@/lib/auth/middleware";
import {
  addOrganizationMemberByEmail,
  listOrganizationMembers
} from "@/server/services/organizationService";
import { ServiceError } from "@/server/services/serviceError";

type AddMemberRequest = {
  orgId?: unknown;
  email?: unknown;
  role?: unknown;
};

const ASSIGNABLE_MEMBER_ROLES = new Set<Role>([Role.ADMIN, Role.CS, Role.ADVERTISER]);

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

    return errorResponse(500, "ORG_MEMBER_LIST_FAILED", "Failed to fetch organization members.");
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
  const role = parseAssignableRole(body.role);

  if (!orgId) {
    return errorResponse(400, "MISSING_ORG_ID", "orgId is required.");
  }

  if (!role) {
    return errorResponse(400, "INVALID_ROLE", "role must be one of: ADMIN, CS, ADVERTISER.");
  }

  try {
    const member = await addOrganizationMemberByEmail({
      actorUserId: auth.session.userId,
      orgId,
      email,
      role
    });

    return NextResponse.json(
      {
        data: {
          member
        },
        meta: {}
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.status, error.code, error.message);
    }

    return errorResponse(500, "ORG_MEMBER_UPSERT_FAILED", "Failed to add organization member.");
  }
}
