import { type NextRequest, NextResponse } from "next/server";

import { publishCustomerUpdatedEvent } from "@/lib/ably/publisher";
import { requireApiSession } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { canAccessCustomerDirectory } from "@/lib/permissions/orgPermissions";
import { resolvePrimaryOrganizationIdForUser } from "@/server/services/organizationService";
import { ServiceError } from "@/server/services/serviceError";

type BulkAssignTagsRequest = {
  orgId?: unknown;
  customerIds?: unknown;
  tagIds?: unknown;
  mode?: unknown;
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

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter((item) => item.length > 0)
    )
  );
}

export async function POST(request: NextRequest) {
  const auth = requireApiSession(request);
  if (auth.response) {
    return auth.response;
  }

  let body: BulkAssignTagsRequest;
  try {
    body = (await request.json()) as BulkAssignTagsRequest;
  } catch {
    return errorResponse(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  try {
    const orgId = await resolvePrimaryOrganizationIdForUser(
      auth.session.userId,
      typeof body.orgId === "string" ? body.orgId : ""
    );
    const customerIds = normalizeStringArray(body.customerIds);
    const tagIds = normalizeStringArray(body.tagIds);
    const mode = typeof body.mode === "string" ? body.mode.trim().toLowerCase() : "append";
    const replace = mode === "replace";

    if (customerIds.length === 0) {
      return errorResponse(400, "MISSING_CUSTOMER_IDS", "customerIds is required.");
    }

    if (tagIds.length === 0 && !replace) {
      return errorResponse(400, "MISSING_TAG_IDS", "tagIds is required for append mode.");
    }

    const membership = await prisma.orgMember.findUnique({
      where: {
        orgId_userId: {
          orgId,
          userId: auth.session.userId
        }
      },
      select: {
        id: true,
        role: true
      }
    });
    if (!membership || !canAccessCustomerDirectory(membership.role)) {
      throw new ServiceError(403, "ORG_ACCESS_DENIED", "You do not have access to this business.");
    }

    const [customers, tags] = await prisma.$transaction([
      prisma.customer.findMany({
        where: {
          orgId,
          id: {
            in: customerIds
          }
        },
        select: {
          id: true
        }
      }),
      prisma.tag.findMany({
        where: {
          orgId,
          id: {
            in: tagIds
          }
        },
        select: {
          id: true
        }
      })
    ]);

    if (customers.length !== customerIds.length) {
      return errorResponse(404, "CUSTOMER_NOT_FOUND", "One or more customers do not exist.");
    }
    if (tagIds.length > 0 && tags.length !== tagIds.length) {
      return errorResponse(404, "TAG_NOT_FOUND", "One or more tags do not exist.");
    }

    await prisma.$transaction(async (tx) => {
      if (replace) {
        await tx.customerTag.deleteMany({
          where: {
            orgId,
            customerId: {
              in: customerIds
            }
          }
        });
      }

      if (tagIds.length > 0) {
        await tx.customerTag.createMany({
          data: customerIds.flatMap((customerId) =>
            tagIds.map((tagId) => ({
              orgId,
              customerId,
              tagId
            }))
          ),
          skipDuplicates: true
        });
      }
    });

    for (const customerId of customerIds) {
      void publishCustomerUpdatedEvent({
        orgId,
        customerId
      });
    }

    return NextResponse.json(
      {
        data: {
          updatedCustomerIds: customerIds,
          appliedTagIds: tagIds,
          mode: replace ? "replace" : "append"
        },
        meta: {}
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.status, error.code, error.message);
    }

    return errorResponse(500, "CUSTOMER_BULK_TAG_ASSIGN_FAILED", "Failed to assign labels in bulk.");
  }
}
