import type { Prisma } from "@prisma/client";
import { type NextRequest, NextResponse } from "next/server";

import { requireApiSession } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { canAccessCustomerDirectory } from "@/lib/permissions/orgPermissions";
import { normalizeAndValidatePhoneE164 } from "@/lib/validation/formValidation";
import { resolvePrimaryOrganizationIdForUser } from "@/server/services/organizationService";
import { ServiceError } from "@/server/services/serviceError";

type CreateCustomerRequest = {
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
  tagIds?: unknown;
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

function parseNumber(value: string | null, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return parsed;
}

function parseBooleanFlag(value: string | null): boolean {
  if (!value) {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
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

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0);
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

function mapCustomerRow(
  customer: {
    id: string;
    displayName: string | null;
    phoneE164: string;
    waProfilePicUrl: string | null;
    createdAt: Date;
    updatedAt: Date;
    firstContactAt: Date | null;
    source: string | null;
    leadStatus: string;
    followUpStatus: string | null;
    followUpAt: Date | null;
    businessCategory: string | null;
    detail: string | null;
    hotness: string;
    packageName: string | null;
    projectValueCents: number | null;
    remarks: string | null;
    assignedToMemberId: string | null;
    tagLinks: Array<{
      tag: {
        id: string;
        name: string;
        color: string;
      };
    }>;
    conversations: Array<{
      id: string;
      crmStageId: string | null;
      crmStage: {
        id: string;
        name: string;
      } | null;
    }>;
    invoices: Array<{
      totalCents: number;
    }>;
    _count?: {
      conversations: number;
    };
  },
  assigneeName: string | null
) {
  return {
    id: customer.id,
    displayName: customer.displayName,
    phoneE164: customer.phoneE164,
    avatarUrl: customer.waProfilePicUrl,
    createdAt: customer.createdAt,
    updatedAt: customer.updatedAt,
    firstContactAt: customer.firstContactAt ?? customer.createdAt,
    source: customer.source,
    leadStatus: customer.leadStatus,
    followUpStatus: customer.followUpStatus,
    followUpAt: customer.followUpAt,
    businessCategory: customer.businessCategory,
    detail: customer.detail,
    hotness: customer.hotness,
    packageName: customer.packageName,
    projectValueCents: customer.projectValueCents ?? customer.invoices[0]?.totalCents ?? 0,
    projectValueMode: customer.projectValueCents === null ? "AUTO" : "MANUAL",
    remarks: customer.remarks,
    assignedToMemberId: customer.assignedToMemberId,
    assignedToName: assigneeName,
    conversationCount: customer._count?.conversations ?? customer.conversations.length,
    latestConversationId: customer.conversations[0]?.id ?? null,
    crmStageId: customer.conversations[0]?.crmStageId ?? null,
    crmStageName: customer.conversations[0]?.crmStage?.name ?? null,
    tags: customer.tagLinks.map((link) => link.tag)
  };
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
    await requireCustomerDirectoryAccess(auth.session.userId, orgId);

    const page = parseNumber(request.nextUrl.searchParams.get("page"), 1);
    const lightweight = parseBooleanFlag(request.nextUrl.searchParams.get("light"));
    const maxLimit = lightweight ? 300 : 100;
    const limit = Math.min(maxLimit, parseNumber(request.nextUrl.searchParams.get("limit"), 30));
    const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
    const tagId = request.nextUrl.searchParams.get("tagId")?.trim() ?? "";
    const leadStatus = request.nextUrl.searchParams.get("leadStatus")?.trim() ?? "";
    const source = request.nextUrl.searchParams.get("source")?.trim() ?? "";
    const hotness = request.nextUrl.searchParams.get("hotness")?.trim() ?? "";
    const assignedToMemberId = request.nextUrl.searchParams.get("assignedToMemberId")?.trim() ?? "";

    const where: Prisma.CustomerWhereInput = {
      orgId,
      ...(query
        ? {
            OR: [
              { displayName: { contains: query } },
              { phoneE164: { contains: query } },
              { leadStatus: { contains: query } },
              { followUpStatus: { contains: query } },
              { businessCategory: { contains: query } },
              { detail: { contains: query } },
              { source: { contains: query } },
              { hotness: { contains: query } },
              { packageName: { contains: query } },
              { remarks: { contains: query } },
              {
                tagLinks: {
                  some: {
                    tag: {
                      name: { contains: query }
                    }
                  }
                }
              }
            ]
          }
        : {}),
      ...(tagId
        ? {
            tagLinks: {
              some: {
                tagId
              }
            }
          }
        : {}),
      ...(leadStatus
        ? {
            leadStatus
          }
        : {}),
      ...(source
        ? {
            source
          }
        : {}),
      ...(hotness
        ? {
            hotness
          }
        : {}),
      ...(assignedToMemberId
        ? {
            assignedToMemberId
          }
        : {})
    };

    const [members, tags] = await prisma.$transaction([
      prisma.orgMember.findMany({
        where: {
          orgId
        },
        orderBy: {
          createdAt: "asc"
        },
        select: {
          id: true,
          role: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      }),
      prisma.tag.findMany({
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
      })
    ]);
    const assigneeMap = new Map(members.map((member) => [member.id, member.user.name?.trim() || member.user.email]));

    if (lightweight) {
      const [total, customers] = await prisma.$transaction([
        prisma.customer.count({ where }),
        prisma.customer.findMany({
          where,
          orderBy: [{ firstContactAt: "desc" }, { createdAt: "desc" }],
          skip: (page - 1) * limit,
          take: limit,
          select: {
            id: true,
            displayName: true,
            phoneE164: true,
            waProfilePicUrl: true,
            createdAt: true,
            updatedAt: true,
            firstContactAt: true,
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
            },
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
            }
          }
        })
      ]);

      return NextResponse.json({
        data: {
          customers: customers.map((customer) => mapCustomerRow(customer, customer.assignedToMemberId ? (assigneeMap.get(customer.assignedToMemberId) ?? null) : null)),
          tags: tags.map((tag) => ({
            id: tag.id,
            name: tag.name,
            color: tag.color,
            customerCount: tag._count.customerLinks
          })),
          assignees: members.map((member) => ({
            memberId: member.id,
            userId: member.user.id,
            name: member.user.name?.trim() || member.user.email,
            role: member.role
          }))
        },
        meta: {
          page,
          limit,
          total
        }
      });
    }

    const [total, customers] = await prisma.$transaction([
      prisma.customer.count({ where }),
      prisma.customer.findMany({
        where,
        orderBy: [{ firstContactAt: "desc" }, { createdAt: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          displayName: true,
          phoneE164: true,
          waProfilePicUrl: true,
          createdAt: true,
          updatedAt: true,
          firstContactAt: true,
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
          _count: {
            select: {
              conversations: true
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
          },
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
          }
        }
      })
    ]);

    return NextResponse.json({
      data: {
        customers: customers.map((customer) => mapCustomerRow(customer, customer.assignedToMemberId ? (assigneeMap.get(customer.assignedToMemberId) ?? null) : null)),
        tags: tags.map((tag) => ({
          id: tag.id,
          name: tag.name,
          color: tag.color,
          customerCount: tag._count.customerLinks
        })),
        assignees: members.map((member) => ({
          memberId: member.id,
          userId: member.user.id,
          name: member.user.name?.trim() || member.user.email,
          role: member.role
        }))
      },
      meta: {
        page,
        limit,
        total
      }
    });
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.status, error.code, error.message);
    }

    return errorResponse(500, "CUSTOMER_LIST_FAILED", "Failed to load customers.");
  }
}

export async function POST(request: NextRequest) {
  const auth = requireApiSession(request);
  if (auth.response) {
    return auth.response;
  }

  let body: CreateCustomerRequest;
  try {
    body = (await request.json()) as CreateCustomerRequest;
  } catch {
    return errorResponse(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  try {
    const orgId = await resolvePrimaryOrganizationIdForUser(
      auth.session.userId,
      typeof body.orgId === "string" ? body.orgId : ""
    );
    await requireCustomerDirectoryAccess(auth.session.userId, orgId);

    const phoneE164 = normalizeAndValidatePhoneE164(typeof body.phoneE164 === "string" ? body.phoneE164 : "");
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const source = normalizeOptionalString(body.source) ?? "manual";
    const leadStatus = normalizeOptionalString(body.leadStatus) ?? "NEW_LEAD";
    const followUpStatus = normalizeOptionalString(body.followUpStatus);
    const followUpAt = normalizeOptionalDate(body.followUpAt);
    const businessCategory = normalizeOptionalString(body.businessCategory);
    const detail = normalizeOptionalString(body.detail);
    const hotness = normalizeOptionalString(body.hotness) ?? "COLD";
    const packageName = normalizeOptionalString(body.packageName);
    const projectValueCents = normalizeOptionalInteger(body.projectValueCents);
    const remarks = normalizeOptionalString(body.remarks);
    const assignedToMemberId = normalizeOptionalString(body.assignedToMemberId);
    const tagIds = Array.from(new Set(normalizeStringArray(body.tagIds)));

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
      const upserted = await tx.customer.upsert({
        where: {
          orgId_phoneE164: {
            orgId,
            phoneE164
          }
        },
        update: {
          ...(name ? { displayName: name } : {}),
          source,
          leadStatus,
          followUpStatus,
          followUpAt,
          businessCategory,
          detail,
          hotness,
          packageName,
          projectValueCents,
          remarks,
          assignedToMemberId
        },
        create: {
          orgId,
          phoneE164,
          displayName: name || null,
          source,
          leadStatus,
          followUpStatus,
          followUpAt,
          businessCategory,
          detail,
          hotness,
          packageName,
          projectValueCents,
          remarks,
          assignedToMemberId,
          firstContactAt: new Date()
        },
        select: {
          id: true,
          displayName: true,
          phoneE164: true
        }
      });

      if (tagIds.length > 0) {
        const allowedTags = await tx.tag.findMany({
          where: {
            orgId,
            id: {
              in: tagIds
            }
          },
          select: {
            id: true
          }
        });

        if (allowedTags.length !== tagIds.length) {
          throw new ServiceError(400, "INVALID_TAG_IDS", "One or more selected tags are invalid.");
        }

        await tx.customerTag.deleteMany({
          where: {
            orgId,
            customerId: upserted.id
          }
        });
        await tx.customerTag.createMany({
          data: tagIds.map((tagId) => ({
            orgId,
            customerId: upserted.id,
            tagId
          })),
          skipDuplicates: true
        });
      }

      await tx.auditLog.create({
        data: {
          orgId,
          actorUserId: auth.session.userId,
          action: "LEAD_CREATED_OR_UPDATED",
          entityType: "CUSTOMER",
          entityId: upserted.id,
          metaJson: JSON.stringify({
            source: "customers.create",
            leadStatus,
            followUpStatus,
            followUpAt,
            hotness,
            assignedToMemberId
          })
        }
      });

      return upserted;
    });

    return NextResponse.json(
      {
        data: {
          customer
        },
        meta: {}
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.status, error.code, error.message);
    }

    return errorResponse(500, "CUSTOMER_CREATE_FAILED", "Failed to create customer.");
  }
}
