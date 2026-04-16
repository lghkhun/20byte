import { randomUUID } from "crypto";

import { sendRedisCommand } from "@/lib/redis/redisResp";

const WHATSAPP_PUBLIC_WEBHOOK_QUEUE_KEY = "20byte:whatsapp:public:webhook";

export type WhatsAppPublicWebhookQueueJob = {
  id: string;
  orgId: string;
  eventId: string;
  dueAt: string;
  receivedAt: string;
};

function normalize(value: string | undefined): string {
  return (value ?? "").trim();
}

function getRedisUrl(): string {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    throw new Error("Missing required environment variable: REDIS_URL");
  }
  return redisUrl;
}

function parseJob(raw: string): WhatsAppPublicWebhookQueueJob {
  const parsed = JSON.parse(raw) as WhatsAppPublicWebhookQueueJob;
  if (!normalize(parsed.id) || !normalize(parsed.orgId) || !normalize(parsed.eventId) || !normalize(parsed.dueAt)) {
    throw new Error("Invalid WhatsApp public webhook queue payload.");
  }
  return parsed;
}

export async function enqueueWhatsAppPublicWebhookEventJob(payload: {
  orgId: string;
  eventId: string;
  dueAt: string;
}): Promise<WhatsAppPublicWebhookQueueJob> {
  const orgId = normalize(payload.orgId);
  const eventId = normalize(payload.eventId);
  const dueAt = normalize(payload.dueAt);
  if (!orgId || !eventId || !dueAt) {
    throw new Error("Invalid WhatsApp public webhook queue payload.");
  }

  const job: WhatsAppPublicWebhookQueueJob = {
    id: randomUUID(),
    orgId,
    eventId,
    dueAt,
    receivedAt: new Date().toISOString()
  };

  await sendRedisCommand(getRedisUrl(), ["RPUSH", WHATSAPP_PUBLIC_WEBHOOK_QUEUE_KEY, JSON.stringify(job)]);
  return job;
}

export async function dequeueWhatsAppPublicWebhookEventJob(timeoutSeconds = 5): Promise<WhatsAppPublicWebhookQueueJob | null> {
  const response = await sendRedisCommand(getRedisUrl(), [
    "BLPOP",
    WHATSAPP_PUBLIC_WEBHOOK_QUEUE_KEY,
    String(Math.max(0, timeoutSeconds))
  ]);

  if (response === null) {
    return null;
  }

  if (!Array.isArray(response) || response.length < 2 || typeof response[1] !== "string") {
    throw new Error("Invalid BLPOP response for WhatsApp public webhook queue.");
  }

  return parseJob(response[1]);
}

export async function requeueWhatsAppPublicWebhookEventJob(job: WhatsAppPublicWebhookQueueJob): Promise<void> {
  await sendRedisCommand(getRedisUrl(), ["RPUSH", WHATSAPP_PUBLIC_WEBHOOK_QUEUE_KEY, JSON.stringify(job)]);
}

export async function getWhatsAppPublicWebhookQueueSize(): Promise<number> {
  const response = await sendRedisCommand(getRedisUrl(), ["LLEN", WHATSAPP_PUBLIC_WEBHOOK_QUEUE_KEY]);
  if (typeof response === "number") {
    return response;
  }
  if (typeof response === "string") {
    const parsed = Number.parseInt(response, 10);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return parsed;
    }
  }
  throw new Error("Invalid LLEN response for WhatsApp public webhook queue.");
}
