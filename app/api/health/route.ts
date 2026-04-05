import { NextResponse } from "next/server";

import { prisma } from "@/lib/db/prisma";
import { sendRedisCommand } from "@/lib/redis/redisResp";

async function checkDatabase(): Promise<boolean> {
  try {
    await prisma.$queryRawUnsafe("SELECT 1");
    return true;
  } catch {
    return false;
  }
}

async function checkRedis(): Promise<boolean> {
  const redisUrl = process.env.REDIS_URL?.trim();
  if (!redisUrl) {
    return false;
  }

  try {
    const response = await sendRedisCommand(redisUrl, ["PING"]);
    return response === "PONG";
  } catch {
    return false;
  }
}

export async function GET() {
  const [database, redis] = await Promise.all([checkDatabase(), checkRedis()]);
  const ok = database && redis;

  return NextResponse.json(
    {
      ok,
      service: "20byte",
      timestamp: new Date().toISOString(),
      uptimeSec: Math.floor(process.uptime()),
      checks: {
        database,
        redis
      }
    },
    {
      status: ok ? 200 : 503,
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );
}
