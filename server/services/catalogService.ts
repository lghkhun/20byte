import { prisma } from "@/lib/db/prisma";
import { canAccessInbox } from "@/lib/permissions/orgPermissions";
import { ServiceError } from "@/server/services/serviceError";

type ServiceCatalogItemPayload = {
  id: string;
  name: string;
  category: string | null;
  unit: string | null;
  priceCents: number | null;
  currency: string;
  attachmentUrl: string | null;
  attachmentType: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type ListCatalogResult = {
  items: ServiceCatalogItemPayload[];
  page: number;
  limit: number;
  total: number;
};

type CreateCatalogInput = {
  actorUserId: string;
  orgId: string;
  name: string;
  category?: string;
  unit?: string;
  priceCents?: number;
  currency?: string;
  attachmentUrl?: string;
  attachmentType?: string;
};

type UpdateCatalogInput = {
  actorUserId: string;
  orgId: string;
  itemId: string;
  name?: string;
  category?: string;
  unit?: string;
  priceCents?: number;
  currency?: string;
  attachmentUrl?: string;
  attachmentType?: string;
};

const ATTACHMENT_TYPES = new Set(["image", "pdf", "link"]);

function normalize(value: string | undefined): string {
  return (value ?? "").trim();
}

function normalizePage(value: number | undefined): number {
  if (!value || Number.isNaN(value) || value < 1) {
    return 1;
  }

  return Math.floor(value);
}

function normalizeLimit(value: number | undefined): number {
  if (!value || Number.isNaN(value) || value < 1) {
    return 20;
  }

  return Math.min(100, Math.floor(value));
}

function normalizeCurrency(value: string | undefined): string {
  const normalized = normalize(value).toUpperCase();
  return normalized || "IDR";
}

function validateAttachment(attachmentUrl: string, attachmentType: string): void {
  if (attachmentUrl && !attachmentType) {
    throw new ServiceError(400, "INVALID_ATTACHMENT_TYPE", "attachmentType is required when attachmentUrl is provided.");
  }

  if (!attachmentUrl && attachmentType) {
    throw new ServiceError(400, "INVALID_ATTACHMENT_URL", "attachmentUrl is required when attachmentType is provided.");
  }

  if (attachmentType && !ATTACHMENT_TYPES.has(attachmentType)) {
    throw new ServiceError(400, "INVALID_ATTACHMENT_TYPE", "attachmentType must be image, pdf, or link.");
  }
}

async function requireCatalogAccess(actorUserId: string, orgId: string): Promise<void> {
  const membership = await prisma.orgMember.findUnique({
    where: {
      orgId_userId: {
        orgId,
        userId: actorUserId
      }
    },
    select: {
      role: true
    }
  });

  if (!membership) {
    throw new ServiceError(403, "ORG_ACCESS_DENIED", "You do not have access to this organization.");
  }

  if (!canAccessInbox(membership.role)) {
    throw new ServiceError(403, "FORBIDDEN_CATALOG_ACCESS", "Your role cannot access service catalog.");
  }
}

export async function listCatalogItems(
  actorUserId: string,
  orgIdInput: string,
  searchInput?: string,
  pageInput?: number,
  limitInput?: number
): Promise<ListCatalogResult> {
  const orgId = normalize(orgIdInput);
  const search = normalize(searchInput);
  const page = normalizePage(pageInput);
  const limit = normalizeLimit(limitInput);

  if (!orgId) {
    throw new ServiceError(400, "MISSING_ORG_ID", "orgId is required.");
  }

  await requireCatalogAccess(actorUserId, orgId);

  const where = {
    orgId,
    ...(search
      ? {
          OR: [
            { name: { contains: search } },
            { category: { contains: search } }
          ]
        }
      : {})
  };

  const [total, items] = await prisma.$transaction([
    prisma.serviceCatalogItem.count({ where }),
    prisma.serviceCatalogItem.findMany({
      where,
      orderBy: {
        createdAt: "desc"
      },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        name: true,
        category: true,
        unit: true,
        priceCents: true,
        currency: true,
        attachmentUrl: true,
        attachmentType: true,
        createdAt: true,
        updatedAt: true
      }
    })
  ]);

  return {
    items,
    page,
    limit,
    total
  };
}

export async function createCatalogItem(input: CreateCatalogInput): Promise<ServiceCatalogItemPayload> {
  const orgId = normalize(input.orgId);
  const name = normalize(input.name);
  const category = normalize(input.category) || null;
  const unit = normalize(input.unit) || null;
  const currency = normalizeCurrency(input.currency);
  const attachmentUrl = normalize(input.attachmentUrl) || null;
  const attachmentType = normalize(input.attachmentType).toLowerCase() || null;

  if (!orgId) {
    throw new ServiceError(400, "MISSING_ORG_ID", "orgId is required.");
  }

  if (!name) {
    throw new ServiceError(400, "INVALID_CATALOG_NAME", "name is required.");
  }

  if (typeof input.priceCents === "number" && (!Number.isFinite(input.priceCents) || input.priceCents < 0)) {
    throw new ServiceError(400, "INVALID_PRICE_CENTS", "priceCents must be a positive number.");
  }

  validateAttachment(attachmentUrl ?? "", attachmentType ?? "");
  await requireCatalogAccess(input.actorUserId, orgId);

  return prisma.serviceCatalogItem.create({
    data: {
      orgId,
      name,
      category,
      unit,
      priceCents: typeof input.priceCents === "number" ? Math.floor(input.priceCents) : null,
      currency,
      attachmentUrl,
      attachmentType
    },
    select: {
      id: true,
      name: true,
      category: true,
      unit: true,
      priceCents: true,
      currency: true,
      attachmentUrl: true,
      attachmentType: true,
      createdAt: true,
      updatedAt: true
    }
  });
}

export async function updateCatalogItem(input: UpdateCatalogInput): Promise<ServiceCatalogItemPayload> {
  const orgId = normalize(input.orgId);
  const itemId = normalize(input.itemId);

  if (!orgId) {
    throw new ServiceError(400, "MISSING_ORG_ID", "orgId is required.");
  }

  if (!itemId) {
    throw new ServiceError(400, "MISSING_CATALOG_ITEM_ID", "itemId is required.");
  }

  await requireCatalogAccess(input.actorUserId, orgId);

  const existing = await prisma.serviceCatalogItem.findFirst({
    where: {
      id: itemId,
      orgId
    },
    select: {
      id: true,
      attachmentUrl: true,
      attachmentType: true
    }
  });

  if (!existing) {
    throw new ServiceError(404, "CATALOG_ITEM_NOT_FOUND", "Service catalog item does not exist.");
  }

  if (input.name !== undefined && !normalize(input.name)) {
    throw new ServiceError(400, "INVALID_CATALOG_NAME", "name cannot be empty.");
  }

  const nextAttachmentUrl =
    input.attachmentUrl !== undefined ? normalize(input.attachmentUrl) || "" : existing.attachmentUrl ?? "";
  const nextAttachmentType =
    input.attachmentType !== undefined
      ? normalize(input.attachmentType).toLowerCase() || ""
      : existing.attachmentType ?? "";

  validateAttachment(nextAttachmentUrl, nextAttachmentType);

  if (typeof input.priceCents === "number" && (!Number.isFinite(input.priceCents) || input.priceCents < 0)) {
    throw new ServiceError(400, "INVALID_PRICE_CENTS", "priceCents must be a positive number.");
  }

  const updateResult = await prisma.serviceCatalogItem.updateMany({
    where: {
      id: itemId,
      orgId
    },
    data: {
      ...(input.name !== undefined ? { name: normalize(input.name) } : {}),
      ...(input.category !== undefined ? { category: normalize(input.category) || null } : {}),
      ...(input.unit !== undefined ? { unit: normalize(input.unit) || null } : {}),
      ...(input.currency !== undefined ? { currency: normalizeCurrency(input.currency) } : {}),
      ...(input.priceCents !== undefined ? { priceCents: Math.floor(input.priceCents) } : {}),
      ...(input.attachmentUrl !== undefined ? { attachmentUrl: nextAttachmentUrl || null } : {}),
      ...(input.attachmentType !== undefined ? { attachmentType: nextAttachmentType || null } : {})
    }
  });

  if (updateResult.count !== 1) {
    throw new ServiceError(404, "CATALOG_ITEM_NOT_FOUND", "Service catalog item does not exist.");
  }

  const updated = await prisma.serviceCatalogItem.findFirst({
    where: {
      id: itemId,
      orgId
    },
    select: {
      id: true,
      name: true,
      category: true,
      unit: true,
      priceCents: true,
      currency: true,
      attachmentUrl: true,
      attachmentType: true,
      createdAt: true,
      updatedAt: true
    }
  });

  if (!updated) {
    throw new ServiceError(404, "CATALOG_ITEM_NOT_FOUND", "Service catalog item does not exist.");
  }

  return updated;
}

export async function deleteCatalogItem(actorUserId: string, orgIdInput: string, itemIdInput: string): Promise<void> {
  const orgId = normalize(orgIdInput);
  const itemId = normalize(itemIdInput);

  if (!orgId) {
    throw new ServiceError(400, "MISSING_ORG_ID", "orgId is required.");
  }

  if (!itemId) {
    throw new ServiceError(400, "MISSING_CATALOG_ITEM_ID", "itemId is required.");
  }

  await requireCatalogAccess(actorUserId, orgId);

  const existing = await prisma.serviceCatalogItem.findFirst({
    where: {
      id: itemId,
      orgId
    },
    select: {
      id: true
    }
  });

  if (!existing) {
    throw new ServiceError(404, "CATALOG_ITEM_NOT_FOUND", "Service catalog item does not exist.");
  }

  await prisma.serviceCatalogItem.deleteMany({
    where: {
      id: itemId,
      orgId
    }
  });
}
