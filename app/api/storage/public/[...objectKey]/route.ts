import { type NextRequest, NextResponse } from "next/server";

import { getObjectFromR2 } from "@/lib/r2/client";

export const runtime = "nodejs";

function resolveObjectKey(params: { objectKey?: string[] }): string {
  const joined = (params.objectKey ?? []).join("/");
  return decodeURIComponent(joined).trim();
}

export async function GET(
  _request: NextRequest,
  context: {
    params: {
      objectKey?: string[];
    };
  }
) {
  const objectKey = resolveObjectKey(context.params);
  if (!objectKey) {
    return NextResponse.json(
      {
        error: {
          code: "OBJECT_KEY_REQUIRED",
          message: "Object key is required."
        }
      },
      { status: 400 }
    );
  }

  try {
    const object = await getObjectFromR2(objectKey);
    return new NextResponse(Buffer.from(object.body), {
      status: 200,
      headers: {
        "Content-Type": object.contentType ?? "application/octet-stream",
        "Cache-Control": object.cacheControl ?? "public, max-age=3600"
      }
    });
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "OBJECT_NOT_FOUND",
          message: "Asset not found."
        }
      },
      { status: 404 }
    );
  }
}
