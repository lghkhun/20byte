import { type NextRequest, NextResponse } from "next/server";

import { requireApiSession } from "@/lib/auth/middleware";

export const runtime = "nodejs";

const PREVIEW_TTL_MS = 10 * 60 * 1000;
const PREVIEW_MAX_ENTRIES = 500;
const PREVIEW_MAX_HTML_BYTES = 250_000;

type LinkPreviewPayload = {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
};

const previewCache = new Map<string, { expiresAt: number; payload: LinkPreviewPayload }>();

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

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'");
}

function stripHtml(value: string): string {
  return decodeHtmlEntities(value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim());
}

function matchMetaContent(html: string, name: string): string | null {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${escaped}["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+name=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${escaped}["'][^>]*>`, "i")
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      return stripHtml(match[1]);
    }
  }

  return null;
}

function matchTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!match || !match[1]) {
    return null;
  }
  return stripHtml(match[1]);
}

function isBlockedHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (
    host === "localhost" ||
    host === "0.0.0.0" ||
    host === "::1" ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  ) {
    return true;
  }

  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    const [a, b] = host.split(".").map((part) => Number(part));
    if (a === 10 || a === 127 || a === 0) {
      return true;
    }
    if (a === 192 && b === 168) {
      return true;
    }
    if (a === 172 && b >= 16 && b <= 31) {
      return true;
    }
    if (a === 169 && b === 254) {
      return true;
    }
  }

  return false;
}

function parseSafeUrl(rawUrl: string): URL | null {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    if (isBlockedHost(parsed.hostname)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function prunePreviewCache() {
  const now = Date.now();
  for (const [key, value] of previewCache) {
    if (value.expiresAt <= now) {
      previewCache.delete(key);
    }
  }

  if (previewCache.size <= PREVIEW_MAX_ENTRIES) {
    return;
  }

  for (const key of previewCache.keys()) {
    previewCache.delete(key);
    if (previewCache.size <= PREVIEW_MAX_ENTRIES) {
      break;
    }
  }
}

function toAbsoluteUrl(base: URL, maybeRelative: string | null): string | null {
  if (!maybeRelative) {
    return null;
  }
  try {
    return new URL(maybeRelative, base).toString();
  } catch {
    return null;
  }
}

async function fetchPreview(url: URL): Promise<LinkPreviewPayload> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4_500);

  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "User-Agent": "20byte-link-preview/1.0 (+https://20byte.com)"
      },
      redirect: "follow",
      signal: controller.signal
    });

    if (!response.ok) {
      return {
        url: url.toString(),
        title: null,
        description: null,
        image: null,
        siteName: url.hostname
      };
    }

    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
    if (!contentType.includes("text/html")) {
      return {
        url: url.toString(),
        title: null,
        description: null,
        image: null,
        siteName: url.hostname
      };
    }

    const html = (await response.text()).slice(0, PREVIEW_MAX_HTML_BYTES);

    const title = matchMetaContent(html, "og:title") || matchMetaContent(html, "twitter:title") || matchTitle(html);
    const description =
      matchMetaContent(html, "og:description") ||
      matchMetaContent(html, "twitter:description") ||
      matchMetaContent(html, "description");
    const imageRaw = matchMetaContent(html, "og:image") || matchMetaContent(html, "twitter:image");
    const siteName = matchMetaContent(html, "og:site_name") || url.hostname;

    return {
      url: url.toString(),
      title: title || null,
      description: description || null,
      image: toAbsoluteUrl(url, imageRaw),
      siteName: siteName || null
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET(request: NextRequest) {
  const auth = requireApiSession(request);
  if (auth.response) {
    return auth.response;
  }

  const urlParam = request.nextUrl.searchParams.get("url")?.trim() ?? "";
  if (!urlParam) {
    return errorResponse(400, "MISSING_URL", "url is required.");
  }

  const parsed = parseSafeUrl(urlParam);
  if (!parsed) {
    return errorResponse(400, "INVALID_URL", "Only public http(s) URLs are allowed.");
  }

  const cacheKey = parsed.toString();
  const cached = previewCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json({ data: { preview: cached.payload } }, { status: 200 });
  }

  try {
    const payload = await fetchPreview(parsed);
    prunePreviewCache();
    previewCache.set(cacheKey, {
      expiresAt: Date.now() + PREVIEW_TTL_MS,
      payload
    });

    return NextResponse.json({ data: { preview: payload } }, { status: 200 });
  } catch {
    const fallback: LinkPreviewPayload = {
      url: parsed.toString(),
      title: null,
      description: null,
      image: null,
      siteName: parsed.hostname
    };
    prunePreviewCache();
    previewCache.set(cacheKey, {
      expiresAt: Date.now() + PREVIEW_TTL_MS,
      payload: fallback
    });
    return NextResponse.json({ data: { preview: fallback } }, { status: 200 });
  }
}
