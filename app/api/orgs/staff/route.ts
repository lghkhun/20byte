import { Role } from "@prisma/client";
import type { NextRequest } from "next/server";

import { errorResponse, successResponse } from "@/lib/api/http";
import { requireApiSession } from "@/lib/auth/middleware";
import { createOrganizationStaff } from "@/server/services/staffService";
import { ServiceError } from "@/server/services/serviceError";

type CreateStaffRequest = {
  orgId?: unknown;
  name?: unknown;
  email?: unknown;
  phone?: unknown;
  role?: unknown;
};

function parseRole(value: unknown): Role | null {
  if (typeof value !== "string") {
    return null;
  }

  const role = value.toUpperCase();
  if (role === "CS") {
    return Role.CS;
  }
  if (role === "ADVERTISER") {
    return Role.ADVERTISER;
  }

  return null;
}

export async function POST(request: NextRequest) {
  const auth = requireApiSession(request);
  if (auth.response) {
    return auth.response;
  }

  let body: CreateStaffRequest;
  try {
    body = (await request.json()) as CreateStaffRequest;
  } catch {
    return errorResponse(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const orgId = typeof body.orgId === "string" ? body.orgId : "";
  const name = typeof body.name === "string" ? body.name : "";
  const email = typeof body.email === "string" ? body.email : "";
  const phone = typeof body.phone === "string" ? body.phone : "";
  const role = parseRole(body.role);

  if (!role) {
    return errorResponse(400, "INVALID_ROLE", "role must be CS or ADVERTISER.");
  }

  try {
    const result = await createOrganizationStaff({
      actorUserId: auth.session.userId,
      orgId,
      name,
      email,
      phone,
      role
    });

    return successResponse(result, 200);
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.status, error.code, error.message);
    }

    return errorResponse(500, "CREATE_STAFF_FAILED", "Failed to create staff account.");
  }
}
