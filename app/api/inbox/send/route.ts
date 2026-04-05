import { type NextRequest, NextResponse } from "next/server";

import { consumeRateLimit } from "@/lib/redis/rateLimit";
import { requireApiSession } from "@/lib/auth/middleware";
import { resolvePrimaryOrganizationIdForUser } from "@/server/services/organizationService";
import { storeBaileysMediaBuffer } from "@/server/services/baileysService";
import { sendOutboundMessage } from "@/server/services/messageService";
import { ServiceError } from "@/server/services/serviceError";

type SendMessageRequest = {
  orgId?: unknown;
  conversationId?: unknown;
  replyToMessageId?: unknown;
  type?: unknown;
  text?: unknown;
  mimeType?: unknown;
  fileName?: unknown;
  templateName?: unknown;
  templateCategory?: unknown;
  templateLanguageCode?: unknown;
  templateComponents?: unknown;
};

type ParsedAttachment = {
  type: "IMAGE" | "VIDEO" | "AUDIO" | "DOCUMENT";
  fileName: string;
  mimeType: string;
  fileSize: number;
  buffer: Buffer;
};

export const runtime = "nodejs";

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

function parseMessageType(value: unknown): "TEXT" | "IMAGE" | "VIDEO" | "AUDIO" | "DOCUMENT" | "TEMPLATE" | "SYSTEM" | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toUpperCase();
  if (
    normalized === "TEXT" ||
    normalized === "IMAGE" ||
    normalized === "VIDEO" ||
    normalized === "AUDIO" ||
    normalized === "DOCUMENT" ||
    normalized === "TEMPLATE" ||
    normalized === "SYSTEM"
  ) {
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

function inferAttachmentType(mimeType: string): "IMAGE" | "VIDEO" | "AUDIO" | "DOCUMENT" {
  if (mimeType.startsWith("image/")) {
    return "IMAGE";
  }

  if (mimeType.startsWith("video/")) {
    return "VIDEO";
  }

  if (mimeType.startsWith("audio/")) {
    return "AUDIO";
  }

  return "DOCUMENT";
}

async function parseBody(request: NextRequest): Promise<{
  body: SendMessageRequest;
  attachment: ParsedAttachment | null;
}> {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const file = formData.get("file");
    let attachment: ParsedAttachment | null = null;

    if (file instanceof File) {
      const mimeType = file.type || "application/octet-stream";
      attachment = {
        type: inferAttachmentType(mimeType),
        fileName: file.name || "attachment",
        mimeType,
        fileSize: file.size,
        buffer: Buffer.from(await file.arrayBuffer())
      };
    }

    return {
      body: {
        orgId: formData.get("orgId"),
        conversationId: formData.get("conversationId"),
        replyToMessageId: formData.get("replyToMessageId"),
        type: formData.get("type") ?? attachment?.type,
        text: formData.get("text"),
        mimeType: attachment?.mimeType,
        fileName: attachment?.fileName
      },
      attachment
    };
  }

  return {
    body: (await request.json()) as SendMessageRequest,
    attachment: null
  };
}

export async function POST(request: NextRequest) {
  const auth = requireApiSession(request);
  if (auth.response) {
    return auth.response;
  }

  let body: SendMessageRequest;
  let attachment: ParsedAttachment | null = null;
  try {
    const parsed = await parseBody(request);
    body = parsed.body;
    attachment = parsed.attachment;
  } catch {
    return errorResponse(400, "INVALID_REQUEST_BODY", "Request body must be valid JSON or multipart form data.");
  }

  const type = parseMessageType(body.type);
  if (!type) {
    return errorResponse(400, "INVALID_MESSAGE_TYPE", "type must be one of: TEXT, IMAGE, VIDEO, AUDIO, DOCUMENT, TEMPLATE, SYSTEM.");
  }
  const templateComponents = parseTemplateComponents(body.templateComponents);
  if (type === "TEMPLATE" && templateComponents === null) {
    return errorResponse(400, "INVALID_TEMPLATE_COMPONENTS", "templateComponents array is required for template messages.");
  }

  const orgId = await resolvePrimaryOrganizationIdForUser(
    auth.session.userId,
    typeof body.orgId === "string" ? body.orgId : ""
  );
  const limitWindowKey = `ratelimit:outbound:${auth.session.userId}:${orgId}`;
  const rate = await consumeRateLimit({
    key: limitWindowKey,
    limit: 120,
    windowSec: 60
  });

  if (!rate.allowed) {
    return errorResponse(429, "OUTBOUND_RATE_LIMITED", "Too many outbound send attempts. Please retry shortly.");
  }

  try {
    let mediaMeta:
      | {
          mediaId: string;
          mediaUrl: string;
          mimeType: string;
          fileName: string;
          fileSize: number;
        }
      | undefined;

    if (attachment) {
      const stored = await storeBaileysMediaBuffer({
        orgId,
        fileName: attachment.fileName,
        mimeType: attachment.mimeType,
        buffer: attachment.buffer
      });

      mediaMeta = {
        mediaId: stored.mediaPath,
        mediaUrl: stored.mediaUrl,
        mimeType: attachment.mimeType,
        fileName: attachment.fileName,
        fileSize: attachment.fileSize
      };
    }

    const message = await sendOutboundMessage({
      actorUserId: auth.session.userId,
      orgId,
      conversationId: typeof body.conversationId === "string" ? body.conversationId : "",
      replyToMessageId: typeof body.replyToMessageId === "string" ? body.replyToMessageId : undefined,
      dispatchMode: "SYNC",
      type,
      text: typeof body.text === "string" ? body.text : undefined,
      mediaId: mediaMeta?.mediaId,
      mediaUrl: mediaMeta?.mediaUrl,
      mimeType: mediaMeta?.mimeType,
      fileName: mediaMeta?.fileName,
      fileSize: mediaMeta?.fileSize,
      templateName: typeof body.templateName === "string" ? body.templateName : undefined,
      templateCategory: parseTemplateCategory(body.templateCategory),
      templateLanguageCode: typeof body.templateLanguageCode === "string" ? body.templateLanguageCode : undefined,
      templateComponents: templateComponents ?? undefined
    });
    const responseMessage = {
      ...message,
      id: message.messageId
    };

    return NextResponse.json(
      {
        data: {
          message: responseMessage
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
