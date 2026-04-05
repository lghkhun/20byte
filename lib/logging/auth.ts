type AuthFailureReason =
  | "LOGIN_USER_NOT_FOUND"
  | "LOGIN_INVALID_PASSWORD"
  | "API_MISSING_SESSION"
  | "API_INVALID_SESSION"
  | "LOGIN_INTERNAL_ERROR"
  | "AUTH_RATE_LIMITED"
  | "API_CROSS_ORIGIN_BLOCKED";

type AuthFailureLogInput = {
  reason: AuthFailureReason;
  email?: string;
  path?: string;
  method?: string;
  ip?: string;
  userAgent?: string;
};

function maskEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  const [local, domain] = normalized.split("@");
  if (!local || !domain) {
    return "unknown";
  }

  if (local.length <= 2) {
    return `**@${domain}`;
  }

  return `${local.slice(0, 2)}***@${domain}`;
}

function normalizeIp(ip: string | undefined): string | undefined {
  if (!ip) {
    return undefined;
  }

  const first = ip.split(",")[0]?.trim();
  return first || undefined;
}

export function logAuthFailure(input: AuthFailureLogInput): void {
  const payload = {
    scope: "auth",
    event: "auth_failure",
    reason: input.reason,
    emailMasked: input.email ? maskEmail(input.email) : undefined,
    path: input.path,
    method: input.method,
    ip: normalizeIp(input.ip),
    userAgent: input.userAgent,
    at: new Date().toISOString()
  };

  console.warn(JSON.stringify(payload));
}
