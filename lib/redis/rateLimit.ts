import { sendRedisCommand } from "@/lib/redis/redisResp";

function getRedisUrlOrNull(): string | null {
  const value = process.env.REDIS_URL?.trim();
  return value || null;
}

export async function consumeRateLimit(input: {
  key: string;
  limit: number;
  windowSec: number;
}): Promise<{ allowed: boolean; current: number }> {
  const redisUrl = getRedisUrlOrNull();
  if (!redisUrl) {
    return { allowed: true, current: 0 };
  }

  const limit = Math.max(1, Math.floor(input.limit));
  const windowSec = Math.max(1, Math.floor(input.windowSec));

  try {
    const response = await sendRedisCommand(redisUrl, ["INCR", input.key]);
    const current = typeof response === "number" ? response : Number(response ?? 0);

    if (current === 1) {
      await sendRedisCommand(redisUrl, ["EXPIRE", input.key, String(windowSec)]);
    }

    return {
      allowed: Number.isFinite(current) && current <= limit,
      current: Number.isFinite(current) ? current : 0
    };
  } catch {
    return { allowed: true, current: 0 };
  }
}
