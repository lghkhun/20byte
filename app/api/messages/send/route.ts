import { type NextRequest, NextResponse } from "next/server";

import { requireApiSession } from "@/lib/auth/middleware";
import { consumeRateLimit } from "@/lib/redis/rateLimit";
import { sendOutboundMessage } from "@/server/services/messageService";
import { ServiceError } from "@/server/services/serviceError";

type SendMessageRequest = {
  orgId?: unknown;
  conversationId?: unknown;
  replyToMessageId?: unknown;
  type?: unknown;
  text?: unknown;
  templateName?: unknown;
  templateCategory?: unknown;
  templateLanguageCode?: unknown;
  templateComponents?: unknown;
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

function parseMessageType(value: unknown): "TEXT" | "TEMPLATE" | "SYSTEM" | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toUpperCase();
  if (normalized === "TEXT" || normalized === "TEMPLATE" || normalized === "SYSTEM") {
    return normalized;
  }

  return null;
}

function parseTemplateCategory(value: unknown): "MARKETING" | "UTILITY" | "AUTHENTICATION" | "SERVICE" | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim().toUpperCase();
  if (normalized === "MARKETING" || normalized === "UTILITY" || normalized === "AUTHENTICATION" || normalized === "SERVICE") {
    return normalized;
  }

  return undefined;
}

function parseTemplateComponents(value: unknown): Array<Record<string, unknown>> | null {
  if (!Array.isArray(value)) {
    return null;
  }

  return value.filter((item) => item && typeof item === "object") as Array<Record<string, unknown>>;
}

export async function POST(request: NextRequest) {
  const auth = requireApiSession(request);
  if (auth.response) {
    return auth.response;
  }

  let body: SendMessageRequest;
  try {
    body = (await request.json()) as SendMessageRequest;
  } catch {
    return errorResponse(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const type = parseMessageType(body.type);
  if (!type) {
    return errorResponse(400, "INVALID_MESSAGE_TYPE", "type must be one of: TEXT, TEMPLATE, SYSTEM.");
  }
  const templateComponents = parseTemplateComponents(body.templateComponents);
  if (type === "TEMPLATE" && templateComponents === null) {
    return errorResponse(400, "INVALID_TEMPLATE_COMPONENTS", "templateComponents array is required for template messages.");
  }

  const orgId = typeof body.orgId === "string" ? body.orgId : "";
  const rate = await consumeRateLimit({
    key: `ratelimit:outbound:${auth.session.userId}:${orgId}`,
    limit: 120,
    windowSec: 60
  });
  if (!rate.allowed) {
    return errorResponse(429, "OUTBOUND_RATE_LIMITED", "Too many outbound send attempts. Please retry shortly.");
  }

  try {
    const message = await sendOutboundMessage({
      actorUserId: auth.session.userId,
      orgId,
      conversationId: typeof body.conversationId === "string" ? body.conversationId : "",
      replyToMessageId: typeof body.replyToMessageId === "string" ? body.replyToMessageId : undefined,
      type,
      text: typeof body.text === "string" ? body.text : undefined,
      templateName: typeof body.templateName === "string" ? body.templateName : undefined,
      templateCategory: parseTemplateCategory(body.templateCategory),
      templateLanguageCode: typeof body.templateLanguageCode === "string" ? body.templateLanguageCode : undefined,
      templateComponents: templateComponents ?? undefined
    });

    return NextResponse.json(
      {
        data: {
          message
        },
        meta: {}
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.status, error.code, error.message);
    }

    return errorResponse(500, "SEND_MESSAGE_FAILED", "Failed to send outbound message.");
  }
}
