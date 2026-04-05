import { type NextRequest, NextResponse } from "next/server";
import path from "path";

import { requireApiSession } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { readBaileysMediaFile } from "@/server/services/baileysService";
import { ServiceError } from "@/server/services/serviceError";

export const runtime = "nodejs";

function inferMimeType(fileName: string): string {
  const extension = path.extname(fileName).toLowerCase();
  switch (extension) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    case ".mp4":
      return "video/mp4";
    case ".mp3":
      return "audio/mpeg";
    case ".ogg":
      return "audio/ogg";
    case ".pdf":
      return "application/pdf";
    default:
      return "application/octet-stream";
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{orgId: string;
      fileName: string;}> }
) {
  const auth = requireApiSession(request);
  if (auth.response) {
    return auth.response;
  }

  const orgId = (await context.params).orgId?.trim() ?? "";
  const fileName = path.basename((await context.params).fileName ?? "");
  if (!orgId || !fileName) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_MEDIA_PATH",
          message: "orgId and fileName are required."
        }
      },
      { status: 400 }
    );
  }

  const membership = await prisma.orgMember.findUnique({
    where: {
      orgId_userId: {
        orgId,
        userId: auth.session.userId
      }
    },
    select: {
      id: true
    }
  });

  if (!membership) {
    return NextResponse.json(
      {
        error: {
          code: "ORG_ACCESS_DENIED",
          message: "You do not have access to this business."
        }
      },
      { status: 403 }
    );
  }

  try {
    const buffer = await readBaileysMediaFile(orgId, fileName);
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": inferMimeType(fileName),
        "Cache-Control": "private, max-age=60"
      }
    });
  } catch (error) {
    if (error instanceof ServiceError) {
      return NextResponse.json(
        {
          error: {
            code: error.code,
            message: error.message
          }
        },
        { status: error.status }
      );
    }

    return NextResponse.json(
      {
        error: {
          code: "MEDIA_READ_FAILED",
          message: "Failed to read media file."
        }
      },
      { status: 500 }
    );
  }
}
