import { type NextRequest, NextResponse } from "next/server";

import { publishCustomerUpdatedEvent } from "@/lib/ably/publisher";
import { requireApiSession } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { canAccessCustomerDirectory } from "@/lib/permissions/orgPermissions";
import { normalizeAndValidatePhoneE164 } from "@/lib/validation/formValidation";
import { resolvePrimaryOrganizationIdForUser } from "@/server/services/organizationService";
import { ServiceError } from "@/server/services/serviceError";

type UpdateCustomerRequest = {
  orgId?: unknown;
  name?: unknown;
  phoneE164?: unknown;
  source?: unknown;
  leadStatus?: unknown;
  followUpStatus?: unknown;
  followUpAt?: unknown;
  businessCategory?: unknown;
  detail?: unknown;
  hotness?: unknown;
  packageName?: unknown;
  projectValueCents?: unknown;
  remarks?: unknown;
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

function normalizeOptionalInteger(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  const rounded = Math.round(value);
  if (rounded < 0) {
    return null;
  }

  return rounded;
}

function normalizeOptionalDate(value: unknown): Date | null {
  if (typeof value !== "string") {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
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

export async function GET(
  request: NextRequest,
  context: { params: Promise<{customerId: string;}> }
) {
  const auth = requireApiSession(request);
  if (auth.response) {
    return auth.response;
  }

  try {
    const orgId = await resolvePrimaryOrganizationIdForUser(
      auth.session.userId,
      request.nextUrl.searchParams.get("orgId")?.trim() ?? ""
    );
    await requireCustomerDirectoryAccess(auth.session.userId, orgId);

    const customerId = (await context.params).customerId?.trim() ?? "";
    if (!customerId) {
      return errorResponse(400, "MISSING_CUSTOMER_ID", "customerId is required.");
    }

    const [customer, changelog] = await prisma.$transaction([
      prisma.customer.findFirst({
        where: {
          id: customerId,
          orgId
        },
        select: {
          id: true,
          displayName: true,
          phoneE164: true,
          waProfilePicUrl: true,
          source: true,
          leadStatus: true,
          followUpStatus: true,
          followUpAt: true,
          businessCategory: true,
          detail: true,
          hotness: true,
          packageName: true,
          projectValueCents: true,
          remarks: true,
          assignedToMemberId: true,
          createdAt: true,
          updatedAt: true,
          firstContactAt: true,
          conversations: {
            orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
            take: 1,
            select: {
              id: true,
              crmStageId: true,
              crmStage: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          },
          invoices: {
            orderBy: {
              createdAt: "desc"
            },
            take: 1,
            select: {
              totalCents: true
            }
          },
          tagLinks: {
            select: {
              tag: {
                select: {
                  id: true,
                  name: true,
                  color: true
                }
              }
            }
          }
        }
      }),
      prisma.auditLog.findMany({
        where: {
          orgId,
          entityType: "CUSTOMER",
          entityId: customerId
        },
        orderBy: {
          createdAt: "desc"
        },
        take: 100,
        select: {
          id: true,
          action: true,
          actorUserId: true,
          metaJson: true,
          createdAt: true
        }
      })
    ]);

    if (!customer) {
      return errorResponse(404, "CUSTOMER_NOT_FOUND", "Customer does not exist.");
    }

    const actorUserIds = Array.from(new Set(changelog.map((entry) => entry.actorUserId).filter((id): id is string => Boolean(id))));
    const actors = actorUserIds.length
      ? await prisma.user.findMany({
          where: {
            id: {
              in: actorUserIds
            }
          },
          select: {
            id: true,
            name: true,
            email: true
          }
        })
      : [];
    const actorMap = new Map(actors.map((actor) => [actor.id, actor.name?.trim() || actor.email]));

    return NextResponse.json({
      data: {
        customer: {
          ...customer,
          firstContactAt: customer.firstContactAt ?? customer.createdAt,
          latestConversationId: customer.conversations[0]?.id ?? null,
          crmStageId: customer.conversations[0]?.crmStageId ?? null,
          crmStageName: customer.conversations[0]?.crmStage?.name ?? null,
          projectValueCents: customer.projectValueCents ?? customer.invoices[0]?.totalCents ?? 0,
          projectValueMode: customer.projectValueCents === null ? "AUTO" : "MANUAL",
          tags: customer.tagLinks.map((link) => link.tag)
        },
        changelog: changelog.map((entry) => ({
          id: entry.id,
          action: entry.action,
          actorUserId: entry.actorUserId,
          actorName: entry.actorUserId ? (actorMap.get(entry.actorUserId) ?? null) : null,
          metaJson: entry.metaJson,
          createdAt: entry.createdAt
        }))
      },
      meta: {}
    });
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.status, error.code, error.message);
    }

    return errorResponse(500, "CUSTOMER_FETCH_FAILED", "Failed to fetch customer details.");
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{customerId: string;}> }
) {
  const auth = requireApiSession(request);
  if (auth.response) {
    return auth.response;
  }

  let body: UpdateCustomerRequest;
  try {
    body = (await request.json()) as UpdateCustomerRequest;
  } catch {
    return errorResponse(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  try {
    const orgId = await resolvePrimaryOrganizationIdForUser(
      auth.session.userId,
      typeof body.orgId === "string" ? body.orgId : ""
    );
    await requireCustomerDirectoryAccess(auth.session.userId, orgId);

    const customerId = (await context.params).customerId?.trim() ?? "";
    if (!customerId) {
      return errorResponse(400, "MISSING_CUSTOMER_ID", "customerId is required.");
    }

    const existing = await prisma.customer.findFirst({
      where: {
        id: customerId,
        orgId
      },
      select: {
        id: true,
        displayName: true,
        phoneE164: true,
        source: true,
        leadStatus: true,
        followUpStatus: true,
        followUpAt: true,
        businessCategory: true,
        detail: true,
        hotness: true,
        packageName: true,
        projectValueCents: true,
        remarks: true,
        assignedToMemberId: true
      }
    });

    if (!existing) {
      return errorResponse(404, "CUSTOMER_NOT_FOUND", "Customer does not exist.");
    }

    const name = normalizeOptionalString(body.name);
    const hasPhone = typeof body.phoneE164 === "string" && body.phoneE164.trim().length > 0;
    const phoneE164 = hasPhone ? normalizeAndValidatePhoneE164(body.phoneE164 as string) : undefined;
    const source = normalizeOptionalString(body.source);
    const leadStatus = normalizeOptionalString(body.leadStatus);
    const followUpStatus = normalizeOptionalString(body.followUpStatus);
    const followUpAt = normalizeOptionalDate(body.followUpAt);
    const businessCategory = normalizeOptionalString(body.businessCategory);
    const detail = normalizeOptionalString(body.detail);
    const hotness = normalizeOptionalString(body.hotness);
    const packageName = normalizeOptionalString(body.packageName);
    const projectValueCents = normalizeOptionalInteger(body.projectValueCents);
    const remarks = normalizeOptionalString(body.remarks);
    const assignedToMemberId = normalizeOptionalString(body.assignedToMemberId);
    const hasFollowUpStatus = Object.prototype.hasOwnProperty.call(body, "followUpStatus");
    const hasFollowUpAt = Object.prototype.hasOwnProperty.call(body, "followUpAt");
    const hasBusinessCategory = Object.prototype.hasOwnProperty.call(body, "businessCategory");
    const hasDetail = Object.prototype.hasOwnProperty.call(body, "detail");
    const hasPackageName = Object.prototype.hasOwnProperty.call(body, "packageName");
    const hasProjectValue = Object.prototype.hasOwnProperty.call(body, "projectValueCents");
    const hasRemarks = Object.prototype.hasOwnProperty.call(body, "remarks");
    const hasAssignedTo = Object.prototype.hasOwnProperty.call(body, "assignedToMemberId");

    if (assignedToMemberId) {
      const assignee = await prisma.orgMember.findFirst({
        where: {
          id: assignedToMemberId,
          orgId
        },
        select: {
          id: true
        }
      });
      if (!assignee) {
        return errorResponse(400, "INVALID_ASSIGNEE", "Assigned member does not belong to this business.");
      }
    }

    const customer = await prisma.$transaction(async (tx) => {
      const updated = await tx.customer.update({
        where: {
          id: existing.id
        },
        data: {
          ...(name !== null ? { displayName: name } : {}),
          ...(phoneE164 ? { phoneE164 } : {}),
          ...(source !== null ? { source } : {}),
          ...(leadStatus !== null ? { leadStatus } : {}),
          ...(hasFollowUpStatus ? { followUpStatus } : {}),
          ...(hasFollowUpAt ? { followUpAt } : {}),
          ...(hasBusinessCategory ? { businessCategory } : {}),
          ...(hasDetail ? { detail } : {}),
          ...(hotness !== null ? { hotness } : {}),
          ...(hasPackageName ? { packageName } : {}),
          ...(hasProjectValue ? { projectValueCents } : {}),
          ...(hasRemarks ? { remarks } : {}),
          ...(hasAssignedTo ? { assignedToMemberId } : {})
        },
        select: {
          id: true,
          displayName: true,
          phoneE164: true,
          source: true,
          leadStatus: true,
          followUpStatus: true,
          followUpAt: true,
          businessCategory: true,
          detail: true,
          hotness: true,
          packageName: true,
          projectValueCents: true,
          remarks: true,
          assignedToMemberId: true,
          updatedAt: true
        }
      });

      const changedFields: string[] = [];
      if (existing.displayName !== updated.displayName) changedFields.push("displayName");
      if (existing.phoneE164 !== updated.phoneE164) changedFields.push("phoneE164");
      if (existing.source !== updated.source) changedFields.push("source");
      if (existing.leadStatus !== updated.leadStatus) changedFields.push("leadStatus");
      if (existing.followUpStatus !== updated.followUpStatus) changedFields.push("followUpStatus");
      if ((existing.followUpAt?.toISOString() ?? null) !== (updated.followUpAt?.toISOString() ?? null)) changedFields.push("followUpAt");
      if (existing.businessCategory !== updated.businessCategory) changedFields.push("businessCategory");
      if (existing.detail !== updated.detail) changedFields.push("detail");
      if (existing.hotness !== updated.hotness) changedFields.push("hotness");
      if (existing.packageName !== updated.packageName) changedFields.push("packageName");
      if (existing.projectValueCents !== updated.projectValueCents) changedFields.push("projectValueCents");
      if (existing.remarks !== updated.remarks) changedFields.push("remarks");
      if (existing.assignedToMemberId !== updated.assignedToMemberId) changedFields.push("assignedToMemberId");

      await tx.auditLog.create({
        data: {
          orgId,
          actorUserId: auth.session.userId,
          action: "LEAD_UPDATED",
          entityType: "CUSTOMER",
          entityId: existing.id,
          metaJson: JSON.stringify({
            source: "customers.update",
            changedFields
          })
        }
      });

      return updated;
    });

    void publishCustomerUpdatedEvent({
      orgId,
      customerId: customer.id
    });

    return NextResponse.json({ data: { customer }, meta: {} }, { status: 200 });
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.status, error.code, error.message);
    }

    if (typeof error === "object" && error && "code" in error && (error as { code?: string }).code === "P2002") {
      return errorResponse(409, "CUSTOMER_PHONE_CONFLICT", "WhatsApp number is already used by another lead.");
    }
    if (typeof error === "object" && error && "code" in error && (error as { code?: string }).code === "P2000") {
      return errorResponse(400, "CUSTOMER_UPDATE_TOO_LONG", "One of the values is too long.");
    }

    return errorResponse(500, "CUSTOMER_UPDATE_FAILED", "Failed to update customer.");
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{customerId: string;}> }
) {
  const auth = requireApiSession(request);
  if (auth.response) {
    return auth.response;
  }

  try {
    const orgId = await resolvePrimaryOrganizationIdForUser(
      auth.session.userId,
      request.nextUrl.searchParams.get("orgId")?.trim() ?? ""
    );
    await requireCustomerDirectoryAccess(auth.session.userId, orgId);

    const customerId = (await context.params).customerId?.trim() ?? "";
    if (!customerId) {
      return errorResponse(400, "MISSING_CUSTOMER_ID", "customerId is required.");
    }

    const customer = await prisma.customer.findFirst({
      where: {
        id: customerId,
        orgId
      },
      select: {
        id: true
      }
    });

    if (!customer) {
      return errorResponse(404, "CUSTOMER_NOT_FOUND", "Customer does not exist.");
    }

    await prisma.$transaction(async (tx) => {
      await tx.customerTag.deleteMany({
        where: {
          customerId: customer.id,
          orgId
        }
      });
      await tx.customerNote.deleteMany({
        where: {
          customerId: customer.id,
          orgId
        }
      });
      await tx.customer.delete({
        where: {
          id: customer.id
        }
      });
      await tx.auditLog.create({
        data: {
          orgId,
          actorUserId: auth.session.userId,
          action: "LEAD_DELETED",
          entityType: "CUSTOMER",
          entityId: customer.id,
          metaJson: JSON.stringify({
            source: "customers.delete"
          })
        }
      });
    });

    void publishCustomerUpdatedEvent({
      orgId,
      customerId: customer.id
    });

    return NextResponse.json({ data: { deleted: { id: customer.id } }, meta: {} }, { status: 200 });
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.status, error.code, error.message);
    }

    if (typeof error === "object" && error && "code" in error && (error as { code?: string }).code === "P2003") {
      return errorResponse(409, "CUSTOMER_DELETE_BLOCKED", "Customer still has active relation (conversation/invoice).");
    }

    return errorResponse(500, "CUSTOMER_DELETE_FAILED", "Failed to delete customer.");
  }
}
