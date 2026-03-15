import { type NextRequest, NextResponse } from "next/server";

import { requireApiSession } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { canAccessInbox } from "@/lib/permissions/orgPermissions";
import { resolvePrimaryOrganizationIdForUser } from "@/server/services/organizationService";
import { createTag } from "@/server/services/crmService";
import { ServiceError } from "@/server/services/serviceError";

type CreateTagRequest = {
  orgId?: unknown;
  name?: unknown;
  color?: unknown;
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

    const membership = await prisma.orgMember.findUnique({
      where: {
        orgId_userId: {
          orgId,
          userId: auth.session.userId
        }
      },
      select: {
        role: true
      }
    });

    if (!membership || !canAccessInbox(membership.role)) {
      return errorResponse(403, "FORBIDDEN_TAG_ACCESS", "You do not have access to tags.");
    }

    const tags = await prisma.tag.findMany({
      where: { orgId },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        color: true,
        _count: {
          select: {
            customerLinks: true
          }
        }
      }
    });

    return NextResponse.json({
      data: {
        tags: tags.map((tag) => ({
          id: tag.id,
          name: tag.name,
          color: tag.color,
          customerCount: tag._count.customerLinks
        }))
      },
      meta: {}
    });
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.status, error.code, error.message);
    }

    return errorResponse(500, "TAG_LIST_FAILED", "Failed to load tags.");
  }
}

export async function POST(request: NextRequest) {
  const auth = requireApiSession(request);
  if (auth.response) {
    return auth.response;
  }

  let body: CreateTagRequest;
  try {
    body = (await request.json()) as CreateTagRequest;
  } catch {
    return errorResponse(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  try {
    const orgId = await resolvePrimaryOrganizationIdForUser(
      auth.session.userId,
      typeof body.orgId === "string" ? body.orgId : ""
    );
    const tag = await createTag(
      auth.session.userId,
      orgId,
      typeof body.name === "string" ? body.name : "",
      typeof body.color === "string" ? body.color : undefined
    );

    return NextResponse.json(
      {
        data: {
          tag
        },
        meta: {}
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.status, error.code, error.message);
    }

    return errorResponse(500, "TAG_CREATE_FAILED", "Failed to create tag.");
  }
}
