import { sendRedisCommand } from "@/lib/redis/redisResp";

function getRedisUrlOrNull(): string | null {
  const value = process.env.REDIS_URL?.trim();
  return value || null;
}

export async function acquireIdempotencyLock(key: string, ttlSeconds: number): Promise<boolean> {
  const redisUrl = getRedisUrlOrNull();
  if (!redisUrl) {
    return true;
  }

  try {
    const response = await sendRedisCommand(redisUrl, [
      "SET",
      key,
      "1",
      "EX",
      String(Math.max(1, Math.floor(ttlSeconds))),
      "NX"
    ]);

    return response === "OK";
  } catch {
    return true;
  }
}
