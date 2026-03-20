import { createHash } from "crypto";

import type { MetaEventJobPayload } from "@/server/queues/metaEventQueue";
import { writeAuditLogSafe } from "@/server/services/auditLogService";
import { getMetaIntegrationRuntime } from "@/server/services/metaIntegrationService";

type MetaEventData = {
  event_name: string;
  event_time: number;
  event_id: string;
  action_source: "system_generated";
  user_data: {
    ph: string[];
  };
  custom_data?: {
    currency?: string;
    value?: number;
    tracking_id?: string;
    funnel_step?: string;
  };
};

export class MetaEventProcessingError extends Error {
  retryable: boolean;

  constructor(message: string, retryable: boolean) {
    super(message);
    this.name = "MetaEventProcessingError";
    this.retryable = retryable;
  }
}

function normalizePhoneForMeta(phoneE164: string): string {
  const digits = phoneE164.replace(/\D+/g, "");
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

function buildMetaEventData(payload: MetaEventJobPayload, hashedPhone: string): MetaEventData[] {
  const eventTime = Math.floor(Date.now() / 1000);
  const common = {
    event_time: eventTime,
    action_source: "system_generated" as const,
    user_data: {
      ph: [hashedPhone]
    }
  };

  if (payload.kind === "CHAT_STARTED" && payload.conversationId) {
    return [
      {
        ...common,
        event_name: "Lead",
        event_id: `chat_${payload.conversationId}`,
        custom_data: {
          tracking_id: payload.trackingId,
          funnel_step: "chat_started"
        }
      },
      {
        ...common,
        event_name: "ChatStarted",
        event_id: `chat_custom_${payload.conversationId}`,
        custom_data: {
          tracking_id: payload.trackingId,
          funnel_step: "chat_started"
        }
      }
    ];
  }

  if (payload.kind === "INVOICE_CREATED" && payload.invoiceId) {
    return [
      {
        ...common,
        event_name: "InitiateCheckout",
        event_id: `invoice_${payload.invoiceId}`,
        custom_data: {
          currency: payload.currency ?? "IDR",
          value: payload.value,
          tracking_id: payload.trackingId,
          funnel_step: "invoice_created"
        }
      },
      {
        ...common,
        event_name: "InvoiceCreated",
        event_id: `invoice_custom_${payload.invoiceId}`,
        custom_data: {
          currency: payload.currency ?? "IDR",
          value: payload.value,
          tracking_id: payload.trackingId,
          funnel_step: "invoice_created"
        }
      }
    ];
  }

  if (payload.kind === "INVOICE_PAID" && payload.invoiceId) {
    return [
      {
        ...common,
        event_name: "Purchase",
        event_id: `payment_${payload.invoiceId}`,
        custom_data: {
          currency: payload.currency ?? "IDR",
          value: payload.value,
          tracking_id: payload.trackingId,
          funnel_step: "invoice_paid"
        }
      },
      {
        ...common,
        event_name: "InvoicePaid",
        event_id: `payment_custom_${payload.invoiceId}`,
        custom_data: {
          currency: payload.currency ?? "IDR",
          value: payload.value,
          tracking_id: payload.trackingId,
          funnel_step: "invoice_paid"
        }
      }
    ];
  }

  return [];
}

export async function processMetaEventJob(payload: MetaEventJobPayload): Promise<void> {
  const integration = await getMetaIntegrationRuntime(payload.orgId);
  if (!integration || !integration.enabled) {
    return;
  }

  const normalizedPhone = normalizePhoneForMeta(payload.customerPhoneE164);
  if (!normalizedPhone) {
    return;
  }

  const events = buildMetaEventData(payload, sha256(normalizedPhone));
  if (events.length === 0) {
    return;
  }

  const endpoint = new URL(`https://graph.facebook.com/v18.0/${integration.pixelId}/events`);

  const response = await fetch(endpoint.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${integration.accessToken}`
    },
    body: JSON.stringify({
      data: events,
      test_event_code: integration.testEventCode ?? undefined
    })
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    const retryable = response.status >= 500 || response.status === 429;
    await writeAuditLogSafe({
      orgId: payload.orgId,
      action: "meta.event.failed",
      entityType: "meta_integration",
      entityId: payload.orgId,
      meta: {
        kind: payload.kind,
        status: response.status,
        retryable,
        response: body.slice(0, 160)
      }
    });
    throw new MetaEventProcessingError(`Meta CAPI request failed (${response.status}).`, retryable);
  }

  await writeAuditLogSafe({
    orgId: payload.orgId,
    action: "meta.event.sent",
    entityType: "meta_integration",
    entityId: payload.orgId,
    meta: {
      kind: payload.kind,
      events: events.map((item) => item.event_name)
    }
  });
}
