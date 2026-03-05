import { randomUUID } from "crypto";

import { sendRedisCommand } from "@/lib/redis/redisResp";

const WEBHOOK_QUEUE_KEY = "20byte:webhook:whatsapp";

export type WhatsAppWebhookQueueJob = {
  id: string;
  payload: unknown;
  receivedAt: string;
};

function getRedisUrl(): string {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    throw new Error("Missing required environment variable: REDIS_URL");
  }

  return redisUrl;
}

function parseJobPayload(raw: string): WhatsAppWebhookQueueJob {
  const parsed = JSON.parse(raw) as WhatsAppWebhookQueueJob;
  if (!parsed.id || !parsed.receivedAt) {
    throw new Error("Invalid webhook queue job payload.");
  }

  return parsed;
}

export async function enqueueWhatsAppWebhookJob(payload: unknown): Promise<WhatsAppWebhookQueueJob> {
  const job: WhatsAppWebhookQueueJob = {
    id: randomUUID(),
    payload,
    receivedAt: new Date().toISOString()
  };

  await sendRedisCommand(getRedisUrl(), ["RPUSH", WEBHOOK_QUEUE_KEY, JSON.stringify(job)]);
  return job;
}

export async function dequeueWhatsAppWebhookJob(timeoutSeconds = 5): Promise<WhatsAppWebhookQueueJob | null> {
  const response = await sendRedisCommand(getRedisUrl(), [
    "BLPOP",
    WEBHOOK_QUEUE_KEY,
    String(Math.max(0, timeoutSeconds))
  ]);

  if (response === null) {
    return null;
  }

  if (!Array.isArray(response) || response.length < 2 || typeof response[1] !== "string") {
    throw new Error("Invalid BLPOP response for webhook queue.");
  }

  return parseJobPayload(response[1]);
}
