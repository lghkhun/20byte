import { sendRedisCommand } from "@/lib/redis/redisResp";

function getRedisUrlOrNull(): string | null {
  const value = process.env.REDIS_URL?.trim();
  return value || null;
}

export async function getCachedJson<T>(key: string): Promise<T | null> {
  const redisUrl = getRedisUrlOrNull();
  if (!redisUrl) {
    return null;
  }

  try {
    const response = await sendRedisCommand(redisUrl, ["GET", key]);
    if (typeof response !== "string" || !response) {
      return null;
    }

    return JSON.parse(response) as T;
  } catch {
    return null;
  }
}

export async function setCachedJson(key: string, ttlSeconds: number, value: unknown): Promise<void> {
  const redisUrl = getRedisUrlOrNull();
  if (!redisUrl) {
    return;
  }

  try {
    await sendRedisCommand(redisUrl, ["SET", key, JSON.stringify(value), "EX", String(Math.max(1, Math.floor(ttlSeconds)))]);
  } catch {
    // Non-blocking cache write.
  }
}

export async function deleteCachedKey(key: string): Promise<void> {
  const redisUrl = getRedisUrlOrNull();
  if (!redisUrl) {
    return;
  }

  try {
    await sendRedisCommand(redisUrl, ["DEL", key]);
  } catch {
    // Non-blocking cache delete.
  }
}
