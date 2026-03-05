import { NextRequest, NextResponse } from "next/server";

import { verifyWebhookSignature } from "@/lib/whatsapp/webhookSignature";
import { enqueueWhatsAppWebhookJob } from "@/server/queues/webhookQueue";
import { ServiceError } from "@/server/services/serviceError";
import { assertWhatsAppWebhookPayload } from "@/server/services/whatsappWebhookService";

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

export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get("hub.mode");
  const token = request.nextUrl.searchParams.get("hub.verify_token");
  const challenge = request.nextUrl.searchParams.get("hub.challenge");
  const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;

  if (!verifyToken) {
    return errorResponse(500, "WHATSAPP_WEBHOOK_VERIFY_TOKEN_MISSING", "Webhook verify token is not configured.");
  }

  if (mode !== "subscribe" || !token || token !== verifyToken || !challenge) {
    return errorResponse(403, "WEBHOOK_VERIFICATION_FAILED", "Webhook verification failed.");
  }

  return new NextResponse(challenge, {
    status: 200,
    headers: {
      "Content-Type": "text/plain"
    }
  });
}

export async function POST(request: NextRequest) {
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (!appSecret) {
    return errorResponse(500, "WHATSAPP_APP_SECRET_MISSING", "Webhook app secret is not configured.");
  }

  const signatureHeader = request.headers.get("x-hub-signature-256");
  const rawBody = await request.text();
  if (!verifyWebhookSignature(rawBody, signatureHeader, appSecret)) {
    return errorResponse(401, "INVALID_WEBHOOK_SIGNATURE", "Webhook signature verification failed.");
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody) as unknown;
  } catch {
    return errorResponse(400, "INVALID_JSON", "Webhook payload must be valid JSON.");
  }

  try {
    assertWhatsAppWebhookPayload(payload);
    const job = await enqueueWhatsAppWebhookJob(payload);

    return NextResponse.json(
      {
        data: {
          webhook: {
            enqueued: true,
            jobId: job.id
          }
        },
        meta: {}
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.status, error.code, error.message);
    }

    return errorResponse(500, "WHATSAPP_WEBHOOK_ENQUEUE_FAILED", "Failed to enqueue webhook payload.");
  }
}
