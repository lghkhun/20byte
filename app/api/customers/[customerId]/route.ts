import { type NextRequest, NextResponse } from "next/server";

import { requireApiSession } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { canAccessInbox } from "@/lib/permissions/orgPermissions";
import { normalizeAndValidatePhoneE164 } from "@/lib/validation/formValidation";
import { resolvePrimaryOrganizationIdForUser } from "@/server/services/organizationService";
import { ServiceError } from "@/server/services/serviceError";

type UpdateCustomerRequest = {
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

export async function PUT(
  request: NextRequest,
  context: {
    params: {
      customerId: string;
    };
  }
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

    const customerId = context.params.customerId?.trim() ?? "";
    if (!customerId) {
      return errorResponse(400, "MISSING_CUSTOMER_ID", "customerId is required.");
    }

    const name = typeof body.name === "string" ? body.name.trim() : "";
    const hasPhone = typeof body.phoneE164 === "string" && body.phoneE164.trim().length > 0;
    const phoneE164 = hasPhone ? normalizeAndValidatePhoneE164(body.phoneE164 as string) : undefined;

    const existing = await prisma.customer.findFirst({
      where: {
        id: customerId,
        orgId
      },
      select: {
        id: true
      }
    });

    if (!existing) {
      return errorResponse(404, "CUSTOMER_NOT_FOUND", "Customer does not exist.");
    }

    const customer = await prisma.customer.update({
      where: {
        id: existing.id
      },
      data: {
        displayName: name || null,
        ...(phoneE164 ? { phoneE164 } : {})
      },
      select: {
        id: true,
        displayName: true,
        phoneE164: true,
        updatedAt: true
      }
    });

    return NextResponse.json({ data: { customer }, meta: {} }, { status: 200 });
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.status, error.code, error.message);
    }

    if (typeof error === "object" && error && "code" in error && (error as { code?: string }).code === "P2002") {
      return errorResponse(409, "CUSTOMER_PHONE_CONFLICT", "Nomor WhatsApp sudah digunakan oleh kontak lain.");
    }

    return errorResponse(500, "CUSTOMER_UPDATE_FAILED", "Failed to update customer.");
  }
}

export async function DELETE(
  request: NextRequest,
  context: {
    params: {
      customerId: string;
    };
  }
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

    const customerId = context.params.customerId?.trim() ?? "";
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
    });

    return NextResponse.json({ data: { deleted: { id: customer.id } }, meta: {} }, { status: 200 });
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.status, error.code, error.message);
    }

    if (typeof error === "object" && error && "code" in error && (error as { code?: string }).code === "P2003") {
      return errorResponse(409, "CUSTOMER_DELETE_BLOCKED", "Customer masih memiliki relasi aktif (conversation/invoice).");
    }

    return errorResponse(500, "CUSTOMER_DELETE_FAILED", "Failed to delete customer.");
  }
}
