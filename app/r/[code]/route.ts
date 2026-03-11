import { createHash } from "crypto";
import { type NextRequest, NextResponse } from "next/server";

import { appendInvisibleAttributionMarker } from "@/lib/ctwa/invisibleMarker";
import { prisma } from "@/lib/db/prisma";
import { getCachedJson, setCachedJson } from "@/lib/redis/cache";

function normalize(value: string | undefined): string {
  return (value ?? "").trim();
}

function getClientIpHash(request: NextRequest): string | null {
  const forwarded = request.headers.get("x-forwarded-for") ?? "";
  const firstIp = normalize(forwarded.split(",")[0]);
  if (!firstIp) {
    return null;
  }

  return createHash("sha256").update(firstIp).digest("hex");
}

function buildRedirectUrl(destinationUrl: string, shortlinkCode: string): string {
  try {
    const url = new URL(destinationUrl);
    const currentText = url.searchParams.get("text") ?? "";
    const textWithMarker = appendInvisibleAttributionMarker(currentText, shortlinkCode);
    if (textWithMarker) {
      url.searchParams.set("text", textWithMarker);
    }

    return url.toString();
  } catch {
    return destinationUrl;
  }
}

export async function GET(
  request: NextRequest,
  context: {
    params: {
      code: string;
    };
  }
) {
  const code = normalize(context.params.code).toLowerCase();
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
    (await prisma.shortlink.findUnique({
      where: {
        code
      },
      select: {
        id: true,
        orgId: true,
        code: true,
        destinationUrl: true,
        isEnabled: true
      }
    }));

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

  await prisma.shortlinkClick.create({
    data: {
      orgId: shortlink.orgId,
      shortlinkId: shortlink.id,
      ipHash,
      userAgent
    }
  });

  return NextResponse.redirect(buildRedirectUrl(shortlink.destinationUrl, shortlink.code), {
    status: 307
  });
}
