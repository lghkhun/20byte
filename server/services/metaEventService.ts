import { createHash } from "crypto";

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import type { MetaEventJobPayload } from "@/server/queues/metaEventQueue";
import { writeAuditLogSafe } from "@/server/services/auditLogService";
import { getMetaIntegrationRuntime } from "@/server/services/metaIntegrationService";

type MetaUserData = {
  ph?: string[];
  external_id?: string[];
  whatsapp_business_account_id?: string;
  ctwa_clid?: string;
};

type MetaEventData = {
  event_name: "Lead" | "InitiateCheckout" | "Purchase";
  event_time: number;
  event_id: string;
  action_source: "physical_store" | "business_messaging";
  messaging_channel?: "whatsapp";
  user_data: MetaUserData;
  custom_data?: {
    currency?: string;
    value?: number;
    order_id?: string;
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

function normalizeOptional(value: string | undefined | null): string | null {
  const normalized = (value ?? "").trim();
  return normalized ? normalized : null;
}

function isLikelyWabaId(value: string | null): value is string {
  if (!value) {
    return false;
  }
  return /^\d{6,}$/.test(value);
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function resolveMetaEventDedupeKey(payload: MetaEventJobPayload): string {
  const explicit = normalizeOptional(payload.dedupeKey);
  const base =
    explicit ??
    (payload.kind === "LEAD"
      ? `lead:${payload.customerId ?? payload.customerPhoneE164}`
      : payload.kind === "INITIATE_CHECKOUT"
        ? `initiate_checkout:${payload.invoiceNo ?? payload.invoiceId ?? payload.customerId ?? payload.customerPhoneE164}`
        : `purchase:${payload.invoiceNo ?? payload.invoiceId ?? payload.customerId ?? payload.customerPhoneE164}`);

  if (base.length <= 191) {
    return base;
  }
  return `k:${sha256(base).slice(0, 64)}`;
}

function buildMetaUserData(payload: MetaEventJobPayload, hashedPhone: string): MetaUserData {
  const ctwaClid = normalizeOptional(payload.ctwaClid);
  const wabaId = normalizeOptional(payload.wabaId);
  if (ctwaClid && isLikelyWabaId(wabaId)) {
    return {
      whatsapp_business_account_id: wabaId,
      ctwa_clid: ctwaClid
    };
  }

  const externalIdRaw = normalizeOptional(payload.customerId);
  return {
    ph: hashedPhone ? [hashedPhone] : undefined,
    external_id: externalIdRaw ? [sha256(externalIdRaw)] : undefined
  };
}

export function buildMetaEventData(payload: MetaEventJobPayload, hashedPhone: string, dedupeKey: string): MetaEventData | null {
  const userData = buildMetaUserData(payload, hashedPhone);
  const isBusinessMessaging = Boolean(userData.ctwa_clid && userData.whatsapp_business_account_id);
  const base = {
    event_time: Math.floor(Date.now() / 1000),
    event_id: dedupeKey,
    action_source: (isBusinessMessaging ? "business_messaging" : "physical_store") as "physical_store" | "business_messaging",
    messaging_channel: isBusinessMessaging ? ("whatsapp" as const) : undefined,
    user_data: userData
  };

  if (payload.kind === "LEAD") {
    return {
      ...base,
      event_name: "Lead",
      custom_data: {
        tracking_id: payload.trackingId,
        funnel_step: "lead_created"
      }
    };
  }

  if (payload.kind === "INITIATE_CHECKOUT") {
    return {
      ...base,
      event_name: "InitiateCheckout",
      custom_data: {
        currency: payload.currency ?? "IDR",
        value: payload.value,
        order_id: payload.invoiceNo ?? payload.invoiceId,
        tracking_id: payload.trackingId,
        funnel_step: "invoice_sent"
      }
    };
  }

  if (payload.kind === "PURCHASE") {
    return {
      ...base,
      event_name: "Purchase",
      custom_data: {
        currency: payload.currency ?? "IDR",
        value: payload.value,
        order_id: payload.invoiceNo ?? payload.invoiceId,
        tracking_id: payload.trackingId,
        funnel_step: "invoice_paid"
      }
    };
  }

  return null;
}

async function claimDispatch(orgId: string, kind: string, dedupeKey: string): Promise<boolean> {
  const existing = await prisma.metaEventDispatch.findUnique({
    where: {
      orgId_dedupeKey: {
        orgId,
        dedupeKey
      }
    },
    select: {
      id: true,
      sentAt: true
    }
  });

  if (existing?.sentAt) {
    return false;
  }

  if (!existing) {
    try {
      await prisma.metaEventDispatch.create({
        data: {
          orgId,
          dedupeKey,
          kind,
          attempts: 1
        }
      });
      return true;
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
        throw error;
      }
    }
  }

  const updated = await prisma.metaEventDispatch.updateMany({
    where: {
      orgId,
      dedupeKey,
      sentAt: null
    },
    data: {
      kind,
      attempts: {
        increment: 1
      }
    }
  });
  return updated.count > 0;
}

async function markDispatchFailed(orgId: string, dedupeKey: string, reason: string): Promise<void> {
  await prisma.metaEventDispatch.updateMany({
    where: {
      orgId,
      dedupeKey
    },
    data: {
      lastError: reason.slice(0, 600)
    }
  });
}

async function markDispatchSent(orgId: string, dedupeKey: string): Promise<void> {
  await prisma.metaEventDispatch.updateMany({
    where: {
      orgId,
      dedupeKey
    },
    data: {
      sentAt: new Date(),
      lastError: null
    }
  });
}

export async function processMetaEventJob(payload: MetaEventJobPayload): Promise<void> {
  const integration = await getMetaIntegrationRuntime(payload.orgId);
  if (!integration || !integration.enabled) {
    return;
  }

  const dedupeKey = resolveMetaEventDedupeKey(payload);
  const claimed = await claimDispatch(payload.orgId, payload.kind, dedupeKey);
  if (!claimed) {
    return;
  }

  const normalizedPhone = normalizePhoneForMeta(payload.customerPhoneE164);
  if (!normalizedPhone && !normalizeOptional(payload.ctwaClid)) {
    return;
  }

  const event = buildMetaEventData(payload, normalizedPhone ? sha256(normalizedPhone) : "", dedupeKey);
  if (!event) {
    return;
  }

  const endpoint = new URL(`https://graph.facebook.com/v18.0/${integration.datasetId}/events`);

  const response = await fetch(endpoint.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${integration.accessToken}`
    },
    body: JSON.stringify({
      data: [event],
      test_event_code: integration.testEventCode ?? undefined
    })
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    const retryable = response.status >= 500 || response.status === 429;
    await markDispatchFailed(payload.orgId, dedupeKey, body || `HTTP_${response.status}`);
    await writeAuditLogSafe({
      orgId: payload.orgId,
      action: "meta.event.failed",
      entityType: "meta_integration",
      entityId: payload.orgId,
      meta: {
        kind: payload.kind,
        dedupeKey,
        status: response.status,
        retryable,
        response: body.slice(0, 160)
      }
    });
    throw new MetaEventProcessingError(`Meta CAPI request failed (${response.status}).`, retryable);
  }

  await markDispatchSent(payload.orgId, dedupeKey);
  await writeAuditLogSafe({
    orgId: payload.orgId,
    action: "meta.event.sent",
    entityType: "meta_integration",
    entityId: payload.orgId,
    meta: {
      kind: payload.kind,
      dedupeKey,
      datasetId: integration.datasetId,
      event: event.event_name,
      actionSource: event.action_source
    }
  });
}
