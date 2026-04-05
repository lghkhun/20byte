import type { NextRequest, NextResponse } from "next/server";

import { errorResponse } from "@/lib/api/http";
import { consumeRateLimit } from "@/lib/redis/rateLimit";
import { getClientIp, toRateLimitHash } from "@/lib/security/request";

type AuthRateLimitScope = "login" | "register" | "forgot-password" | "set-password";

type RateLimitRule = {
  limit: number;
  windowSec: number;
};

const RATE_LIMIT_RULES: Record<AuthRateLimitScope, { ip: RateLimitRule; identity?: RateLimitRule }> = {
  login: {
    ip: { limit: 60, windowSec: 300 },
    identity: { limit: 12, windowSec: 300 }
  },
  register: {
    ip: { limit: 12, windowSec: 900 },
    identity: { limit: 4, windowSec: 3600 }
  },
  "forgot-password": {
    ip: { limit: 20, windowSec: 600 },
    identity: { limit: 3, windowSec: 600 }
  },
  "set-password": {
    ip: { limit: 40, windowSec: 600 }
  }
};

async function consumeRule(input: {
  key: string;
  rule: RateLimitRule;
  errorCode: string;
  message: string;
}): Promise<NextResponse | null> {
  const result = await consumeRateLimit({
    key: input.key,
    limit: input.rule.limit,
    windowSec: input.rule.windowSec
  });
  if (result.allowed) {
    return null;
  }

  return errorResponse(429, input.errorCode, input.message);
}

export async function enforceAuthRateLimit(input: {
  request: NextRequest;
  scope: AuthRateLimitScope;
  identity?: string;
}): Promise<NextResponse | null> {
  const rules = RATE_LIMIT_RULES[input.scope];
  const ipHash = toRateLimitHash(getClientIp(input.request));
  const ipResponse = await consumeRule({
    key: `ratelimit:auth:${input.scope}:ip:${ipHash}`,
    rule: rules.ip,
    errorCode: "RATE_LIMITED",
    message: "Terlalu banyak percobaan. Coba lagi beberapa saat."
  });
  if (ipResponse) {
    return ipResponse;
  }

  const rawIdentity = input.identity?.trim().toLowerCase() ?? "";
  if (!rawIdentity || !rules.identity) {
    return null;
  }

  const identityResponse = await consumeRule({
    key: `ratelimit:auth:${input.scope}:id:${toRateLimitHash(rawIdentity)}`,
    rule: rules.identity,
    errorCode: "RATE_LIMITED_IDENTITY",
    message: "Terlalu banyak percobaan untuk akun ini. Coba lagi beberapa saat."
  });
  if (identityResponse) {
    return identityResponse;
  }

  return null;
}
