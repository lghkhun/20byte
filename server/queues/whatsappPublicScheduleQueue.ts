import { randomUUID } from "crypto";

import { sendRedisCommand } from "@/lib/redis/redisResp";

const WHATSAPP_PUBLIC_SCHEDULE_QUEUE_KEY = "20byte:whatsapp:public:schedule";

export type WhatsAppPublicScheduleQueueJob = {
  id: string;
  scheduleId: string;
  orgId: string;
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

function parseJob(raw: string): WhatsAppPublicScheduleQueueJob {
  const parsed = JSON.parse(raw) as WhatsAppPublicScheduleQueueJob;
  if (!normalize(parsed.id) || !normalize(parsed.scheduleId) || !normalize(parsed.orgId) || !normalize(parsed.dueAt)) {
    throw new Error("Invalid WhatsApp public schedule queue payload.");
  }
  return parsed;
}

export async function enqueueWhatsAppPublicScheduleJob(payload: {
  scheduleId: string;
  orgId: string;
  dueAt: string;
}): Promise<WhatsAppPublicScheduleQueueJob> {
  const scheduleId = normalize(payload.scheduleId);
  const orgId = normalize(payload.orgId);
  const dueAt = normalize(payload.dueAt);
  if (!scheduleId || !orgId || !dueAt) {
    throw new Error("Invalid WhatsApp public schedule queue payload.");
  }

  const job: WhatsAppPublicScheduleQueueJob = {
    id: randomUUID(),
    scheduleId,
    orgId,
    dueAt,
    receivedAt: new Date().toISOString()
  };

  await sendRedisCommand(getRedisUrl(), ["RPUSH", WHATSAPP_PUBLIC_SCHEDULE_QUEUE_KEY, JSON.stringify(job)]);
  return job;
}

export async function dequeueWhatsAppPublicScheduleJob(timeoutSeconds = 5): Promise<WhatsAppPublicScheduleQueueJob | null> {
  const response = await sendRedisCommand(getRedisUrl(), [
    "BLPOP",
    WHATSAPP_PUBLIC_SCHEDULE_QUEUE_KEY,
    String(Math.max(0, timeoutSeconds))
  ]);

  if (response === null) {
    return null;
  }

  if (!Array.isArray(response) || response.length < 2 || typeof response[1] !== "string") {
    throw new Error("Invalid BLPOP response for WhatsApp public schedule queue.");
  }

  return parseJob(response[1]);
}

export async function requeueWhatsAppPublicScheduleJob(job: WhatsAppPublicScheduleQueueJob): Promise<void> {
  await sendRedisCommand(getRedisUrl(), ["RPUSH", WHATSAPP_PUBLIC_SCHEDULE_QUEUE_KEY, JSON.stringify(job)]);
}

export async function getWhatsAppPublicScheduleQueueSize(): Promise<number> {
  const response = await sendRedisCommand(getRedisUrl(), ["LLEN", WHATSAPP_PUBLIC_SCHEDULE_QUEUE_KEY]);
  if (typeof response === "number") {
    return response;
  }
  if (typeof response === "string") {
    const parsed = Number.parseInt(response, 10);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return parsed;
    }
  }
  throw new Error("Invalid LLEN response for WhatsApp public schedule queue.");
}
