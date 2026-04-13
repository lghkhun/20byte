import { createHash } from "crypto";
import { type NextRequest, NextResponse } from "next/server";

import { appendTrackingRef, generateTrackingId } from "@/lib/attribution/trackingRef";
import { prisma } from "@/lib/db/prisma";
import { getCachedJson, setCachedJson } from "@/lib/redis/cache";

function normalize(value: string | undefined): string {
  return (value ?? "").trim();
}

function normalizeTrackingParam(value: string | null): string | null {
  const normalized = normalize(value ?? undefined);
  return normalized ? normalized.slice(0, 191) : null;
}

function getClientIpHash(request: NextRequest): string | null {
  const forwarded = request.headers.get("x-forwarded-for") ?? "";
  const firstIp = normalize(forwarded.split(",")[0]);
  if (!firstIp) {
    return null;
  }

  return createHash("sha256").update(firstIp).digest("hex");
}

function buildRedirectUrl(destinationUrl: string, trackingId: string): string {
  try {
    const url = new URL(destinationUrl);
    const currentText = url.searchParams.get("text") ?? "";
    const withTrackingRef = appendTrackingRef(currentText, trackingId);
    if (withTrackingRef) {
      url.searchParams.set("text", withTrackingRef);
    }

    return url.toString();
  } catch {
    return destinationUrl;
  }
}

async function findShortlinkByCode(code: string) {
  const variants = Array.from(new Set([code, code.toLowerCase(), code.toUpperCase()]));

  for (const candidate of variants) {
    const shortlink = await prisma.shortlink.findUnique({
      where: {
        code: candidate
      },
      select: {
        id: true,
        orgId: true,
        code: true,
        destinationUrl: true,
        isEnabled: true
      }
    });

    if (shortlink) {
      return shortlink;
    }
  }

  return null;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ code: string }> }
) {
  const params = await context.params;
  const code = normalize(params.code);
  if (!code) {
    return NextResponse.json(
      {
        error: {
          code: "SHORTLINK_NOT_FOUND",
          message: "Shortlink not found."
        }
      },
      { status: 404 }
    );
  }

  const cacheKey = `cache:shortlink:${code}`;
  const cached = await getCachedJson<{
    id: string;
    orgId: string;
    code: string;
    destinationUrl: string;
    isEnabled: boolean;
  }>(cacheKey);

  const shortlink =
    cached ??
    (await findShortlinkByCode(code));

  if (!shortlink || !shortlink.isEnabled) {
    return NextResponse.json(
      {
        error: {
          code: "SHORTLINK_NOT_FOUND",
          message: "Shortlink not found."
        }
      },
      { status: 404 }
    );
  }

  if (!cached) {
    await setCachedJson(cacheKey, 60, shortlink);
  }

  const ipHash = getClientIpHash(request);
  const userAgent = normalize(request.headers.get("user-agent") ?? undefined) || null;
  const trackingId = generateTrackingId(shortlink.code);
  const fbclid = normalizeTrackingParam(request.nextUrl.searchParams.get("fbclid"));
  const fbc = normalizeTrackingParam(request.nextUrl.searchParams.get("fbc"));
  const fbp = normalizeTrackingParam(request.nextUrl.searchParams.get("fbp"));

  await prisma.shortlinkClick.create({
    data: {
      orgId: shortlink.orgId,
      shortlinkId: shortlink.id,
      trackingId,
      fbclid,
      fbc,
      fbp,
      ipHash,
      userAgent
    }
  });

  return NextResponse.redirect(buildRedirectUrl(shortlink.destinationUrl, trackingId), {
    status: 307
  });
}
