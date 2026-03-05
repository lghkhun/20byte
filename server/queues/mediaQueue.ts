import { randomUUID } from "crypto";

import { sendRedisCommand } from "@/lib/redis/redisResp";

const MEDIA_QUEUE_KEY = "20byte:media:download";

export type WhatsAppMediaQueuePayload = {
  messageId: string;
};

export type WhatsAppMediaQueueJob = {
  id: string;
  payload: WhatsAppMediaQueuePayload;
  receivedAt: string;
};

function getRedisUrl(): string {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    throw new Error("Missing required environment variable: REDIS_URL");
  }

  return redisUrl;
}

function parseJobPayload(raw: string): WhatsAppMediaQueueJob {
  const parsed = JSON.parse(raw) as WhatsAppMediaQueueJob;
  const messageId = parsed.payload?.messageId;
  if (!parsed.id || !parsed.receivedAt || typeof messageId !== "string" || !messageId.trim()) {
    throw new Error("Invalid media queue job payload.");
  }

  return {
    ...parsed,
    payload: {
      messageId: messageId.trim()
    }
  };
}

export async function enqueueWhatsAppMediaDownloadJob(
  payload: WhatsAppMediaQueuePayload
): Promise<WhatsAppMediaQueueJob> {
  const messageId = payload.messageId.trim();
  if (!messageId) {
    throw new Error("Invalid media queue payload: messageId is required.");
  }

  const job: WhatsAppMediaQueueJob = {
    id: randomUUID(),
    payload: {
      messageId
    },
    receivedAt: new Date().toISOString()
  };

  await sendRedisCommand(getRedisUrl(), ["RPUSH", MEDIA_QUEUE_KEY, JSON.stringify(job)]);
  return job;
}

export async function dequeueWhatsAppMediaDownloadJob(timeoutSeconds = 5): Promise<WhatsAppMediaQueueJob | null> {
  const response = await sendRedisCommand(getRedisUrl(), [
    "BLPOP",
    MEDIA_QUEUE_KEY,
    String(Math.max(0, timeoutSeconds))
  ]);

  if (response === null) {
    return null;
  }

  if (!Array.isArray(response) || response.length < 2 || typeof response[1] !== "string") {
    throw new Error("Invalid BLPOP response for media queue.");
  }

  return parseJobPayload(response[1]);
}

