import { type NextRequest, NextResponse } from "next/server";

import { publishCustomerUpdatedEvent } from "@/lib/ably/publisher";
import { requireApiSession } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { resolvePrimaryOrganizationIdForUser } from "@/server/services/organizationService";
import { assignTagToCustomer, listCustomerTags } from "@/server/services/crmService";
import { ServiceError } from "@/server/services/serviceError";

const CUSTOMER_TAGS_CACHE_TTL_MS = 2_000;
const CUSTOMER_TAGS_MAX_CACHE_ENTRIES = 800;

type CustomerTagsResponsePayload = {
  data: {
    tags: Awaited<ReturnType<typeof listCustomerTags>>;
  };
  meta: Record<string, never>;
};

const customerTagsCache = new Map<string, { expiresAt: number; payload: CustomerTagsResponsePayload }>();
const customerTagsInflight = new Map<string, Promise<CustomerTagsResponsePayload>>();

type AssignTagRequest = {
  orgId?: unknown;
  tagId?: unknown;
};

type ReplaceTagsRequest = {
  orgId?: unknown;
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

function withServerTiming<T>(response: T, startedAt: number, cacheStatus?: "HIT" | "MISS"): T {
  const durationMs = Number((performance.now() - startedAt).toFixed(1));
  if (response instanceof Response) {
    response.headers.set("Server-Timing", `app;dur=${durationMs}`);
    if (cacheStatus) {
      response.headers.set("X-Cache", cacheStatus);
    }
    response.headers.set("Cache-Control", "no-store");
  }
  return response;
}

function buildCacheKey(input: { userId: string; orgId: string; customerId: string }): string {
  return `${input.userId}::${input.orgId}::${input.customerId}`;
}

function pruneCustomerTagsCache(): void {
  const now = Date.now();
  for (const [key, value] of customerTagsCache) {
    if (value.expiresAt <= now) {
      customerTagsCache.delete(key);
    }
  }
  if (customerTagsCache.size <= CUSTOMER_TAGS_MAX_CACHE_ENTRIES) {
    return;
  }
  for (const key of customerTagsCache.keys()) {
    customerTagsCache.delete(key);
    if (customerTagsCache.size <= CUSTOMER_TAGS_MAX_CACHE_ENTRIES) {
      break;
    }
  }
}

function clearCustomerTagsRouteCache(orgId: string, customerId: string): void {
  const token = `::${orgId}::${customerId}`;
  for (const key of customerTagsCache.keys()) {
    if (key.endsWith(token)) {
      customerTagsCache.delete(key);
    }
  }
  for (const key of customerTagsInflight.keys()) {
    if (key.endsWith(token)) {
      customerTagsInflight.delete(key);
    }
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{customerId: string;}> }
) {
  const startedAt = performance.now();
  const auth = requireApiSession(request);
  if (auth.response) {
    return withServerTiming(auth.response, startedAt);
  }

  const customerId = (await context.params).customerId;
  const fresh = request.nextUrl.searchParams.get("fresh") === "1";

  try {
    const orgId = await resolvePrimaryOrganizationIdForUser(
      auth.session.userId,
      request.nextUrl.searchParams.get("orgId")?.trim() ?? ""
    );
    const cacheKey = buildCacheKey({
      userId: auth.session.userId,
      orgId,
      customerId
    });

    if (!fresh) {
      const cached = customerTagsCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        return withServerTiming(NextResponse.json(cached.payload, { status: 200 }), startedAt, "HIT");
      }
      const inflight = customerTagsInflight.get(cacheKey);
      if (inflight) {
        const payload = await inflight;
        return withServerTiming(NextResponse.json(payload, { status: 200 }), startedAt, "HIT");
      }
    }

    const requestPromise = (async (): Promise<CustomerTagsResponsePayload> => {
      const tags = await listCustomerTags(auth.session.userId, orgId, customerId);
      return {
        data: {
          tags
        },
        meta: {}
      };
    })();

    if (!fresh) {
      customerTagsInflight.set(cacheKey, requestPromise);
    }

    try {
      const payload = await requestPromise;
      if (!fresh) {
        pruneCustomerTagsCache();
        customerTagsCache.set(cacheKey, {
          expiresAt: Date.now() + CUSTOMER_TAGS_CACHE_TTL_MS,
          payload
        });
      }
      return withServerTiming(NextResponse.json(payload, { status: 200 }), startedAt, "MISS");
    } finally {
      if (!fresh) {
        customerTagsInflight.delete(cacheKey);
      }
    }
  } catch (error) {
    if (error instanceof ServiceError) {
      return withServerTiming(errorResponse(error.status, error.code, error.message), startedAt);
    }

    return withServerTiming(errorResponse(500, "CUSTOMER_TAG_LIST_FAILED", "Failed to load customer tags."), startedAt);
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{customerId: string;}> }
) {
  const startedAt = performance.now();
  const auth = requireApiSession(request);
  if (auth.response) {
    return withServerTiming(auth.response, startedAt);
  }

  let body: AssignTagRequest;
  try {
    body = (await request.json()) as AssignTagRequest;
  } catch {
    return errorResponse(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  try {
    const orgId = await resolvePrimaryOrganizationIdForUser(
      auth.session.userId,
      typeof body.orgId === "string" ? body.orgId : ""
    );
    const tag = await assignTagToCustomer(
      auth.session.userId,
      orgId,
      (await context.params).customerId,
      typeof body.tagId === "string" ? body.tagId : ""
    );
    clearCustomerTagsRouteCache(orgId, (await context.params).customerId);
    return withServerTiming(NextResponse.json(
      {
        data: {
          tag
        },
        meta: {}
      },
      { status: 200 }
    ), startedAt);
  } catch (error) {
    if (error instanceof ServiceError) {
      return withServerTiming(errorResponse(error.status, error.code, error.message), startedAt);
    }

    return withServerTiming(errorResponse(500, "CUSTOMER_TAG_ASSIGN_FAILED", "Failed to assign tag to customer."), startedAt);
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{customerId: string;}> }
) {
  const startedAt = performance.now();
  const auth = requireApiSession(request);
  if (auth.response) {
    return withServerTiming(auth.response, startedAt);
  }

  let body: ReplaceTagsRequest;
  try {
    body = (await request.json()) as ReplaceTagsRequest;
  } catch {
    return errorResponse(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  try {
    const orgId = await resolvePrimaryOrganizationIdForUser(
      auth.session.userId,
      typeof body.orgId === "string" ? body.orgId : ""
    );

    const customerId = (await context.params).customerId;
    const rawTagIds = Array.isArray(body.tagIds) ? body.tagIds : [];
    const tagIds = rawTagIds
      .map((value) => (typeof value === "string" ? value.trim() : ""))
      .filter((value) => value.length > 0);
    const uniqueTagIds = Array.from(new Set(tagIds));

    const allowedTags = await listCustomerTags(auth.session.userId, orgId, customerId);
    const allowedTagIdSet = new Set(allowedTags.map((tag) => tag.id));
    for (const tagId of uniqueTagIds) {
      if (!allowedTagIdSet.has(tagId)) {
        return errorResponse(404, "TAG_NOT_FOUND", "One or more tags do not exist.");
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.customerTag.deleteMany({
        where: {
          orgId,
          customerId
        }
      });

      if (uniqueTagIds.length > 0) {
        await tx.customerTag.createMany({
          data: uniqueTagIds.map((tagId) => ({
            orgId,
            customerId,
            tagId
          })),
          skipDuplicates: true
        });
      }
    });

    void publishCustomerUpdatedEvent({
      orgId,
      customerId
    });

    clearCustomerTagsRouteCache(orgId, customerId);
    const tags = await listCustomerTags(auth.session.userId, orgId, customerId);
    return withServerTiming(NextResponse.json(
      {
        data: {
          tags
        },
        meta: {}
      },
      { status: 200 }
    ), startedAt);
  } catch (error) {
    if (error instanceof ServiceError) {
      return withServerTiming(errorResponse(error.status, error.code, error.message), startedAt);
    }

    return withServerTiming(errorResponse(500, "CUSTOMER_TAG_REPLACE_FAILED", "Failed to replace customer tags."), startedAt);
  }
}
