import { randomUUID } from "crypto";

import { sendRedisCommand } from "@/lib/redis/redisResp";

const META_EVENT_QUEUE_KEY = "20byte:meta:event";

export type MetaEventKind = "LEAD" | "INITIATE_CHECKOUT" | "PURCHASE";

export type MetaEventJobPayload = {
  orgId: string;
  kind: MetaEventKind;
  customerPhoneE164: string;
  customerId?: string;
  invoiceId?: string;
  invoiceNo?: string;
  trackingId?: string;
  dedupeKey?: string;
  fbclid?: string;
  fbc?: string;
  fbp?: string;
  ctwaClid?: string;
  wabaId?: string;
  currency?: string;
  value?: number;
};

export type MetaEventJob = {
  id: string;
  payload: MetaEventJobPayload;
  receivedAt: string;
};

function getRedisUrl(): string {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    throw new Error("Missing required environment variable: REDIS_URL");
  }
  return redisUrl;
}

function normalize(value: string | undefined): string {
  return (value ?? "").trim();
}

function parseMetaEventJob(raw: string): MetaEventJob {
  const parsed = JSON.parse(raw) as MetaEventJob;
  const payload = parsed.payload ?? ({} as MetaEventJobPayload);
  if (!parsed.id || !parsed.receivedAt || !payload || !normalize(payload.orgId) || !normalize(payload.customerPhoneE164) || !normalize(payload.kind)) {
    throw new Error("Invalid meta event queue payload.");
  }
  return parsed;
}

export async function enqueueMetaEventJob(payload: MetaEventJobPayload): Promise<MetaEventJob> {
  const orgId = normalize(payload.orgId);
  const customerPhoneE164 = normalize(payload.customerPhoneE164);
  if (!orgId || !customerPhoneE164) {
    throw new Error("Invalid meta event payload: orgId and customerPhoneE164 are required.");
  }

  const job: MetaEventJob = {
    id: randomUUID(),
    payload: {
      ...payload,
      orgId,
      customerPhoneE164
    },
    receivedAt: new Date().toISOString()
  };

  await sendRedisCommand(getRedisUrl(), ["RPUSH", META_EVENT_QUEUE_KEY, JSON.stringify(job)]);
  return job;
}

export async function dequeueMetaEventJob(timeoutSeconds = 5): Promise<MetaEventJob | null> {
  const response = await sendRedisCommand(getRedisUrl(), [
    "BLPOP",
    META_EVENT_QUEUE_KEY,
    String(Math.max(0, timeoutSeconds))
  ]);

  if (response === null) {
    return null;
  }

  if (!Array.isArray(response) || response.length < 2 || typeof response[1] !== "string") {
    throw new Error("Invalid BLPOP response for meta event queue.");
  }

  return parseMetaEventJob(response[1]);
}

export async function requeueMetaEventJob(job: MetaEventJob): Promise<void> {
  await sendRedisCommand(getRedisUrl(), ["RPUSH", META_EVENT_QUEUE_KEY, JSON.stringify(job)]);
}

export async function getMetaEventQueueSize(): Promise<number> {
  const response = await sendRedisCommand(getRedisUrl(), ["LLEN", META_EVENT_QUEUE_KEY]);
  if (typeof response === "number") {
    return response;
  }
  if (typeof response === "string") {
    const parsed = Number.parseInt(response, 10);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return parsed;
    }
  }
  throw new Error("Invalid LLEN response for meta event queue.");
}
