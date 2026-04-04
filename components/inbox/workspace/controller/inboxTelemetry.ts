const TELEMETRY_STORAGE_KEY = "telemetry.inbox.realtime.v1";
const TELEMETRY_MAX_SAMPLES = 300;

export type InboxTelemetryMetric =
  | "send_latency_ms"
  | "realtime_status_mismatch_count"
  | "realtime_fallback_activation_count"
  | "realtime_fallback_activation_rate";

type InboxTelemetrySample = {
  metric: InboxTelemetryMetric;
  value: number;
  at: number;
  orgId?: string;
  conversationId?: string;
};

export function recordInboxTelemetry(
  metric: InboxTelemetryMetric,
  value: number,
  context?: {
    orgId?: string | null;
    conversationId?: string | null;
  }
): void {
  if (typeof window === "undefined") {
    return;
  }

  if (!Number.isFinite(value)) {
    return;
  }

  const sample: InboxTelemetrySample = {
    metric,
    value,
    at: Date.now(),
    ...(context?.orgId ? { orgId: context.orgId } : {}),
    ...(context?.conversationId ? { conversationId: context.conversationId } : {})
  };

  try {
    const raw = window.localStorage.getItem(TELEMETRY_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as InboxTelemetrySample[]) : [];
    const next = [...parsed, sample].slice(-TELEMETRY_MAX_SAMPLES);
    window.localStorage.setItem(TELEMETRY_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Keep realtime path resilient even when telemetry storage fails.
  }
}
