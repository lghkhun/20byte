import { type NextRequest, NextResponse } from "next/server";

import { requireApiSession } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { canAccessCustomerDirectory } from "@/lib/permissions/orgPermissions";
import { resolvePrimaryOrganizationIdForUser } from "@/server/services/organizationService";
import { ServiceError } from "@/server/services/serviceError";

type BulkCustomerRequest = {
  orgId?: unknown;
  customerIds?: unknown;
  action?: unknown;
  leadStatus?: unknown;
  followUpStatus?: unknown;
  hotness?: unknown;
  assignedToMemberId?: unknown;
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

function normalizeOptionalString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0);
}

async function requireCustomerDirectoryAccess(userId: string, orgId: string) {
  const membership = await prisma.orgMember.findUnique({
    where: {
      orgId_userId: {
        orgId,
        userId
      }
    },
    select: {
      role: true
    }
  });

  if (!membership) {
    throw new ServiceError(403, "ORG_ACCESS_DENIED", "You do not have access to this business.");
  }

  if (!canAccessCustomerDirectory(membership.role)) {
    throw new ServiceError(403, "FORBIDDEN_CUSTOMER_ACCESS", "Your role cannot access customer database.");
  }
}

export async function PATCH(request: NextRequest) {
  const auth = requireApiSession(request);
  if (auth.response) {
    return auth.response;
  }

  let body: BulkCustomerRequest;
  try {
    body = (await request.json()) as BulkCustomerRequest;
  } catch {
    return errorResponse(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  try {
    const orgId = await resolvePrimaryOrganizationIdForUser(
      auth.session.userId,
      typeof body.orgId === "string" ? body.orgId : ""
    );
    await requireCustomerDirectoryAccess(auth.session.userId, orgId);

    const customerIds = Array.from(new Set(normalizeStringArray(body.customerIds)));
    if (customerIds.length === 0) {
      return errorResponse(400, "MISSING_CUSTOMER_IDS", "customerIds is required.");
    }

    const action = normalizeOptionalString(body.action)?.toUpperCase();
    if (!action) {
      return errorResponse(400, "MISSING_ACTION", "action is required.");
    }

    const affected = await prisma.$transaction(async (tx) => {
      if (action === "DELETE") {
        await tx.customerTag.deleteMany({
          where: {
            orgId,
            customerId: {
              in: customerIds
            }
          }
        });
        await tx.customerNote.deleteMany({
          where: {
            orgId,
            customerId: {
              in: customerIds
            }
          }
        });
        const deleted = await tx.customer.deleteMany({
          where: {
            orgId,
            id: {
              in: customerIds
            }
          }
        });
        await tx.auditLog.create({
          data: {
            orgId,
            actorUserId: auth.session.userId,
            action: "LEAD_BULK_DELETE",
            entityType: "CUSTOMER",
            entityId: customerIds.join(","),
            metaJson: JSON.stringify({
              count: deleted.count
            })
          }
        });
        return deleted.count;
      }

      const data: {
        leadStatus?: string;
        followUpStatus?: string | null;
        hotness?: string;
        assignedToMemberId?: string | null;
      } = {};

      if (action === "SET_STATUS") {
        const leadStatus = normalizeOptionalString(body.leadStatus);
        if (!leadStatus) {
          throw new ServiceError(400, "MISSING_LEAD_STATUS", "leadStatus is required for SET_STATUS.");
        }
        data.leadStatus = leadStatus;
      } else if (action === "SET_FOLLOW_UP") {
        data.followUpStatus = normalizeOptionalString(body.followUpStatus);
      } else if (action === "SET_HOTNESS") {
        const hotness = normalizeOptionalString(body.hotness);
        if (!hotness) {
          throw new ServiceError(400, "MISSING_HOTNESS", "hotness is required for SET_HOTNESS.");
        }
        data.hotness = hotness;
      } else if (action === "ASSIGN") {
        const assignedToMemberId = normalizeOptionalString(body.assignedToMemberId);
        if (assignedToMemberId) {
          const assignee = await tx.orgMember.findFirst({
            where: {
              id: assignedToMemberId,
              orgId
            },
            select: {
              id: true
            }
          });
          if (!assignee) {
            throw new ServiceError(400, "INVALID_ASSIGNEE", "Assigned member does not belong to this business.");
          }
        }
        data.assignedToMemberId = assignedToMemberId;
      } else {
        throw new ServiceError(400, "INVALID_ACTION", "Unsupported action.");
      }

      const updated = await tx.customer.updateMany({
        where: {
          orgId,
          id: {
            in: customerIds
          }
        },
        data
      });

      await tx.auditLog.create({
        data: {
          orgId,
          actorUserId: auth.session.userId,
          action: "LEAD_BULK_UPDATE",
          entityType: "CUSTOMER",
          entityId: customerIds.join(","),
          metaJson: JSON.stringify({
            action,
            data,
            count: updated.count
          })
        }
      });

      return updated.count;
    });

    return NextResponse.json({
      data: {
        affected
      },
      meta: {}
    });
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.status, error.code, error.message);
    }

    if (typeof error === "object" && error && "code" in error && (error as { code?: string }).code === "P2003") {
      return errorResponse(409, "CUSTOMER_BULK_DELETE_BLOCKED", "Some leads cannot be deleted due to related data.");
    }

    return errorResponse(500, "CUSTOMER_BULK_UPDATE_FAILED", "Failed to run bulk action.");
  }
}
