import { randomUUID } from "crypto";

import { sendRedisCommand } from "@/lib/redis/redisResp";

const CLEANUP_QUEUE_KEY = "20byte:cleanup:storage";

export type StorageCleanupQueueJob = {
  id: string;
  payload: {
    requestedAt: string;
  };
  receivedAt: string;
};

function getRedisUrl(): string {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    throw new Error("Missing required environment variable: REDIS_URL");
  }

  return redisUrl;
}

function parseJobPayload(raw: string): StorageCleanupQueueJob {
  const parsed = JSON.parse(raw) as StorageCleanupQueueJob;
  if (!parsed.id || !parsed.receivedAt || !parsed.payload?.requestedAt) {
    throw new Error("Invalid cleanup queue job payload.");
  }

  return parsed;
}

export async function enqueueStorageCleanupJob(): Promise<StorageCleanupQueueJob> {
  const job: StorageCleanupQueueJob = {
    id: randomUUID(),
    payload: {
      requestedAt: new Date().toISOString()
    },
    receivedAt: new Date().toISOString()
  };

  await sendRedisCommand(getRedisUrl(), ["RPUSH", CLEANUP_QUEUE_KEY, JSON.stringify(job)]);
  return job;
}

export async function dequeueStorageCleanupJob(timeoutSeconds = 5): Promise<StorageCleanupQueueJob | null> {
  const response = await sendRedisCommand(getRedisUrl(), [
    "BLPOP",
    CLEANUP_QUEUE_KEY,
    String(Math.max(0, timeoutSeconds))
  ]);

  if (response === null) {
    return null;
  }

  if (!Array.isArray(response) || response.length < 2 || typeof response[1] !== "string") {
    throw new Error("Invalid BLPOP response for cleanup queue.");
  }

  return parseJobPayload(response[1]);
}
