import { createHash, randomUUID } from "crypto";
import type { NextRequest } from "next/server";

import { errorResponse, successResponse } from "@/lib/api/http";
import { prisma } from "@/lib/db/prisma";
import { requireApiSession } from "@/lib/auth/middleware";
import { getMetaIntegrationRuntimeForActor } from "@/server/services/metaIntegrationService";
import { ServiceError } from "@/server/services/serviceError";

type TestEventRequest = {
  orgId?: unknown;
  phoneNumber?: unknown;
};

function normalize(value: string | undefined): string {
  return (value ?? "").trim();
}

function normalizePhoneForMeta(phoneRaw: string): string {
  const digits = phoneRaw.replace(/\D+/g, "");
  if (!digits) {
    return "";
  }
  if (digits.startsWith("62")) {
    return digits;
  }
  if (digits.startsWith("0")) {
    return `62${digits.slice(1)}`;
  }
  return digits;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export async function POST(request: NextRequest) {
  const auth = requireApiSession(request);
  if (auth.response) {
    return auth.response;
  }

  let body: TestEventRequest;
  try {
    body = (await request.json()) as TestEventRequest;
  } catch {
    return errorResponse(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  try {
    const runtime = await getMetaIntegrationRuntimeForActor(
      auth.session.userId,
      typeof body.orgId === "string" ? body.orgId : ""
    );
    if (!runtime) {
      return errorResponse(400, "META_CONFIG_NOT_READY", "Meta integration is not configured yet.");
    }

    const directPhone = typeof body.phoneNumber === "string" ? normalize(body.phoneNumber) : "";
    let fallbackPhone = "";
    if (!directPhone) {
      const waAccount = await prisma.waAccount.findFirst({
        where: {
          orgId: runtime.orgId
        },
        orderBy: {
          connectedAt: "desc"
        },
        select: {
          displayPhone: true
        }
      });
      fallbackPhone = normalize(waAccount?.displayPhone ?? "");
    }

    const normalizedPhone = normalizePhoneForMeta(directPhone || fallbackPhone);
    if (!normalizedPhone) {
      return errorResponse(400, "PHONE_REQUIRED", "Phone number is required to send test event.");
    }

    const endpoint = new URL(`https://graph.facebook.com/v18.0/${runtime.datasetId}/events`);
    const eventId = `test_${randomUUID().replace(/-/g, "").slice(0, 16)}`;

    const response = await fetch(endpoint.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${runtime.accessToken}`
      },
      body: JSON.stringify({
        data: [
          {
            event_name: "Lead",
            event_time: Math.floor(Date.now() / 1000),
            event_id: eventId,
            action_source: "physical_store",
            user_data: {
              ph: [sha256(normalizedPhone)]
            },
            custom_data: {
              funnel_step: "test_event"
            }
          }
        ],
        test_event_code: runtime.testEventCode ?? undefined
      })
    });

    if (!response.ok) {
      const bodyText = await response.text().catch(() => "");
      return errorResponse(502, "META_TEST_EVENT_FAILED", bodyText || "Failed to send Meta test event.");
    }

    return successResponse(
      {
        sent: true,
        eventId,
        phone: normalizedPhone,
        datasetId: runtime.datasetId,
        testEventCode: runtime.testEventCode ?? null
      },
      200
    );
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.status, error.code, error.message);
    }
    return errorResponse(500, "META_TEST_EVENT_FAILED", "Failed to send test event.");
  }
}
