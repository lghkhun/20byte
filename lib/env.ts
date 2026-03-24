type RequiredEnvKey =
  | "DATABASE_URL"
  | "REDIS_URL"
  | "NEXTAUTH_SECRET"
  | "NEXTAUTH_URL"
  | "APP_URL";

type OptionalEnvKey =
  | "MYSQL_PORT"
  | "REDIS_PORT"
  | "ABLY_API_KEY"
  | "SHORTLINK_BASE_URL"
  | "R2_ACCOUNT_ID"
  | "R2_ACCESS_KEY_ID"
  | "R2_SECRET_ACCESS_KEY"
  | "R2_BUCKET"
  | "R2_PUBLIC_URL"
  | "WHATSAPP_MOCK_MODE"
  | "PAKASIR_PROJECT_SLUG"
  | "PAKASIR_API_KEY"
  | "PAKASIR_BASE_URL"
  | "PAKASIR_DEFAULT_METHOD"
  | "PAKASIR_WEBHOOK_PATH"
  | "PAKASIR_WEBHOOK_TOKEN"
  | "SUPERADMIN_EMAILS";

export type AppEnv = Record<RequiredEnvKey, string> &
  Partial<Record<OptionalEnvKey, string>> & {
    MYSQL_PORT: string;
    REDIS_PORT: string;
  };

const REQUIRED_ENV_KEYS: RequiredEnvKey[] = [
  "DATABASE_URL",
  "REDIS_URL",
  "NEXTAUTH_SECRET",
  "NEXTAUTH_URL",
  "APP_URL"
];

const OPTIONAL_ENV_KEYS: OptionalEnvKey[] = [
  "MYSQL_PORT",
  "REDIS_PORT",
  "ABLY_API_KEY",
  "SHORTLINK_BASE_URL",
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET",
  "R2_PUBLIC_URL",
  "WHATSAPP_MOCK_MODE",
  "PAKASIR_PROJECT_SLUG",
  "PAKASIR_API_KEY",
  "PAKASIR_BASE_URL",
  "PAKASIR_DEFAULT_METHOD",
  "PAKASIR_WEBHOOK_PATH",
  "PAKASIR_WEBHOOK_TOKEN",
  "SUPERADMIN_EMAILS"
];

let cachedEnv: AppEnv | null = null;

const DEV_FALLBACK_AUTH_SECRET = "20byte-dev-auth-secret-change-me";

function readRequiredEnv(key: RequiredEnvKey): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
}

export function getEnv(): AppEnv {
  if (cachedEnv) {
    return cachedEnv;
  }

  const env = {} as AppEnv;

  for (const key of REQUIRED_ENV_KEYS) {
    env[key] = readRequiredEnv(key);
  }

  for (const key of OPTIONAL_ENV_KEYS) {
    const value = process.env[key];
    if (value) {
      env[key] = value;
    }
  }

  env.MYSQL_PORT = env.MYSQL_PORT ?? "3307";
  env.REDIS_PORT = env.REDIS_PORT ?? "6379";
  cachedEnv = env;

  return env;
}

export function getAuthSecret(): string {
  const fromEnv = process.env.NEXTAUTH_SECRET;
  if (fromEnv) {
    return fromEnv;
  }

  if (process.env.NODE_ENV !== "production") {
    return DEV_FALLBACK_AUTH_SECRET;
  }

  throw new Error("Missing required environment variable: NEXTAUTH_SECRET");
}

export function getPakasirConfig() {
  const slug = process.env.PAKASIR_PROJECT_SLUG?.trim() ?? "";
  const apiKey = process.env.PAKASIR_API_KEY?.trim() ?? "";
  const baseUrl = process.env.PAKASIR_BASE_URL?.trim() || "https://app.pakasir.com";
  const defaultMethod = process.env.PAKASIR_DEFAULT_METHOD?.trim() || "qris";
  const webhookPath = process.env.PAKASIR_WEBHOOK_PATH?.trim() || "/api/billing/webhooks/pakasir";
  const webhookToken = process.env.PAKASIR_WEBHOOK_TOKEN?.trim() || "";

  if (!slug) {
    throw new Error("Missing required environment variable: PAKASIR_PROJECT_SLUG");
  }

  if (!apiKey) {
    throw new Error("Missing required environment variable: PAKASIR_API_KEY");
  }

  return {
    slug,
    apiKey,
    baseUrl: baseUrl.replace(/\/+$/, ""),
    defaultMethod,
    webhookPath,
    webhookToken
  };
}

export function getSuperadminEmailAllowlist(): Set<string> {
  const raw = process.env.SUPERADMIN_EMAILS ?? "";
  const emails = raw
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  return new Set(emails);
}
