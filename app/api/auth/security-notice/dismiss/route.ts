import type { NextRequest } from "next/server";

import { errorResponse, successResponse } from "@/lib/api/http";
import { requireApiSession } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

export async function POST(request: NextRequest) {
  const auth = requireApiSession(request);
  if (auth.response) {
    return auth.response;
  }

  try {
    await prisma.user.update({
      where: {
        id: auth.session.userId
      },
      data: {
        securityNoticeDismissedAt: new Date()
      }
    });

    return successResponse({ dismissed: true }, 200);
  } catch {
    return errorResponse(500, "SECURITY_NOTICE_DISMISS_FAILED", "Failed to dismiss notice.");
  }
}
