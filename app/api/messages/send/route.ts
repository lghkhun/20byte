import { NextRequest, NextResponse } from "next/server";

import { requireApiSession } from "@/lib/auth/middleware";
import { sendOutboundMessage } from "@/server/services/messageService";
import { ServiceError } from "@/server/services/serviceError";

type SendMessageRequest = {
  orgId?: unknown;
  conversationId?: unknown;
  type?: unknown;
  text?: unknown;
  templateName?: unknown;
  templateCategory?: unknown;
  templateLanguageCode?: unknown;
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

  try {
    const message = await sendOutboundMessage({
      actorUserId: auth.session.userId,
      orgId: typeof body.orgId === "string" ? body.orgId : "",
      conversationId: typeof body.conversationId === "string" ? body.conversationId : "",
      type,
      text: typeof body.text === "string" ? body.text : undefined,
      templateName: typeof body.templateName === "string" ? body.templateName : undefined,
      templateCategory: parseTemplateCategory(body.templateCategory),
      templateLanguageCode: typeof body.templateLanguageCode === "string" ? body.templateLanguageCode : undefined
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
