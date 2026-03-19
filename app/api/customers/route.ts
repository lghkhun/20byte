import { type NextRequest, NextResponse } from "next/server";

import { requireApiSession } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { canAccessInbox } from "@/lib/permissions/orgPermissions";
import { normalizeAndValidatePhoneE164 } from "@/lib/validation/formValidation";
import { resolvePrimaryOrganizationIdForUser } from "@/server/services/organizationService";
import { ServiceError } from "@/server/services/serviceError";

type CreateCustomerRequest = {
  orgId?: unknown;
  name?: unknown;
  phoneE164?: unknown;
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

  if (!canAccessInbox(membership.role)) {
    throw new ServiceError(403, "FORBIDDEN_CUSTOMER_ACCESS", "Your role cannot access customer database.");
  }
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
    const maxLimit = lightweight ? 200 : 50;
    const limit = Math.min(maxLimit, parseNumber(request.nextUrl.searchParams.get("limit"), 20));
    const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
    const tagId = request.nextUrl.searchParams.get("tagId")?.trim() ?? "";

    const where = {
      orgId,
      ...(query
        ? {
            OR: [
              { displayName: { contains: query } },
              { phoneE164: { contains: query } }
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
        : {})
    };

    if (lightweight) {
      const [total, customers] = await prisma.$transaction([
        prisma.customer.count({ where }),
        prisma.customer.findMany({
          where,
          orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
          skip: (page - 1) * limit,
          take: limit,
          select: {
            id: true,
            displayName: true,
            phoneE164: true,
            waProfilePicUrl: true,
            createdAt: true,
            updatedAt: true,
            conversations: {
              orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
              take: 1,
              select: {
                id: true
              }
            }
          }
        })
      ]);

      return NextResponse.json({
        data: {
          customers: customers.map((customer) => ({
            id: customer.id,
            displayName: customer.displayName,
            phoneE164: customer.phoneE164,
            avatarUrl: customer.waProfilePicUrl,
            createdAt: customer.createdAt,
            updatedAt: customer.updatedAt,
            conversationCount: 0,
            latestConversationId: customer.conversations[0]?.id ?? null,
            tags: []
          })),
          tags: []
        },
        meta: {
          page,
          limit,
          total
        }
      });
    }

    const [total, customers, tags] = await prisma.$transaction([
      prisma.customer.count({ where }),
      prisma.customer.findMany({
        where,
        orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          displayName: true,
          phoneE164: true,
          waProfilePicUrl: true,
          createdAt: true,
          updatedAt: true,
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
              id: true
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

    return NextResponse.json({
      data: {
        customers: customers.map((customer) => ({
          id: customer.id,
          displayName: customer.displayName,
          phoneE164: customer.phoneE164,
          avatarUrl: customer.waProfilePicUrl,
          createdAt: customer.createdAt,
          updatedAt: customer.updatedAt,
          conversationCount: customer._count.conversations,
          latestConversationId: customer.conversations[0]?.id ?? null,
          tags: customer.tagLinks.map((link) => link.tag)
        })),
        tags: tags.map((tag) => ({
          id: tag.id,
          name: tag.name,
          color: tag.color,
          customerCount: tag._count.customerLinks
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

    const customer = await prisma.customer.upsert({
      where: {
        orgId_phoneE164: {
          orgId,
          phoneE164
        }
      },
      update: {
        ...(name ? { displayName: name } : {})
      },
      create: {
        orgId,
        phoneE164,
        displayName: name || null,
        source: "manual",
        firstContactAt: new Date()
      },
      select: {
        id: true,
        displayName: true,
        phoneE164: true
      }
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
