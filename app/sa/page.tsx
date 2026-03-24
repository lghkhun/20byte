"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { notifyError } from "@/lib/ui/notify";

type SubscriptionItem = {
  id: string;
  orgId: string;
  status: string;
  trialEndAt: string;
  currentPeriodEndAt: string | null;
  org: {
    id: string;
    name: string;
    billingCharges: Array<{
      id: string;
      status: string;
      totalAmountCents: number;
      createdAt: string;
      paidAt: string | null;
    }>;
    _count: {
      members: number;
      waAccounts: number;
    };
  };
};

type UserItem = {
  id: string;
  email: string;
  phoneE164: string | null;
  name: string | null;
  platformMembership: { role: string } | null;
};

type TrendPoint = {
  date: string;
  paidCount: number;
  paidAmountCents: number;
  newOrgs: number;
};

type SuperadminOverview = {
  generatedAt: string;
  statusSummary: {
    totalOrgs: number;
    active: number;
    trialing: number;
    pastDue: number;
    canceled: number;
    connectedWhatsappOrgs: number;
  };
  trends: {
    sevenDays: TrendPoint[];
    thirtyDays: TrendPoint[];
  };
  queueHealth: {
    redisConfigured: boolean;
    redisReachable: boolean;
    metaEventQueue: number | null;
    mediaQueue: number | null;
    cleanupQueue: number | null;
    error: string | null;
  };
  paymentHealth: {
    createdLast24h: number;
    paidLast24h: number;
    pending: number;
    pendingExpired: number;
    pendingStaleOver1h: number;
  };
  webhookHealth: {
    receivedLast24h: number;
    completedLast24h: number;
    failedLast24h: number;
    replaySkippedLast24h: number;
    retriedOrdersLast24h: number;
  };
  webhookEvents: Array<{
    id: string;
    orderId: string;
    action: string;
    createdAt: string;
    meta: Record<string, unknown> | null;
  }>;
  riskOrgs: Array<{
    orgId: string;
    orgName: string;
    status: string;
    dueAt: string | null;
    daysToDue: number | null;
    waAccounts: number;
    members: number;
    riskLevel: "high" | "medium" | "low";
    reason: string;
  }>;
};

type AuditItem = {
  id: string;
  actorUserId: string;
  action: string;
  targetType: string;
  targetId: string;
  createdAt: string;
  actor: {
    id: string;
    email: string;
    name: string | null;
  } | null;
  meta: Record<string, unknown> | null;
};

function formatDate(value: string | null): string {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(date);
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
  }).format(amount);
}

const trendChartConfig = {
  paidAmountCents: { label: "Paid Amount", color: "#10b981" },
  paidCount: { label: "Paid Transactions", color: "#0ea5e9" },
  newOrgs: { label: "New Organizations", color: "#f59e0b" }
} satisfies ChartConfig;

function TrendBarChart({ data, metric }: { data: TrendPoint[]; metric: "paidAmountCents" | "paidCount" | "newOrgs" }) {
  return (
    <ChartContainer config={trendChartConfig} className="h-[180px] w-full aspect-auto">
      <BarChart data={data} margin={{ top: 8, right: 8, left: -24, bottom: 4 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="date" tickLine={false} axisLine={false} tickFormatter={(value: string) => value.slice(5)} />
        <YAxis tickLine={false} axisLine={false} width={36} allowDecimals={false} />
        <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
        <Bar dataKey={metric} fill={`var(--color-${metric})`} radius={[6, 6, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}

export default function SuperadminPage() {
  const [subscriptions, setSubscriptions] = useState<SubscriptionItem[]>([]);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [overview, setOverview] = useState<SuperadminOverview | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditItem[]>([]);
  const [trendWindow, setTrendWindow] = useState<"7" | "30">("7");
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [auditQuery, setAuditQuery] = useState("");
  const [auditAction, setAuditAction] = useState("all");
  const [auditTargetType, setAuditTargetType] = useState("all");
  const [auditDateFrom, setAuditDateFrom] = useState("");
  const [auditDateTo, setAuditDateTo] = useState("");
  const [highlightedAuditIds, setHighlightedAuditIds] = useState<string[]>([]);
  const knownFailureAuditIdsRef = useRef<Set<string>>(new Set());
  const isFirstFailurePollRef = useRef(true);

  const loadCore = useCallback(async () => {
    setError(null);
    try {
      const [subRes, userRes] = await Promise.all([
        fetch("/api/sa/orgs/subscriptions", { cache: "no-store" }),
        fetch("/api/sa/users", { cache: "no-store" })
      ]);

      const subPayload = (await subRes.json().catch(() => null)) as { data?: { subscriptions?: SubscriptionItem[] }; error?: { message?: string } } | null;
      const userPayload = (await userRes.json().catch(() => null)) as { data?: { users?: UserItem[] }; error?: { message?: string } } | null;

      if (!subRes.ok) {
        throw new Error(subPayload?.error?.message ?? "Failed to load subscriptions");
      }
      if (!userRes.ok) {
        throw new Error(userPayload?.error?.message ?? "Failed to load users");
      }

      setSubscriptions(subPayload?.data?.subscriptions ?? []);
      setUsers(userPayload?.data?.users ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load superadmin page.");
    }
  }, []);

  const loadOverview = useCallback(async () => {
    setError(null);
    try {
      const overviewRes = await fetch("/api/sa/overview", { cache: "no-store" });
      const overviewPayload = (await overviewRes.json().catch(() => null)) as { data?: { overview?: SuperadminOverview }; error?: { message?: string } } | null;
      if (!overviewRes.ok) {
        throw new Error(overviewPayload?.error?.message ?? "Failed to load overview");
      }
      setOverview(overviewPayload?.data?.overview ?? null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load overview.");
    }
  }, []);

  const loadAuditLogs = useCallback(async () => {
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("limit", "300");
      if (auditQuery.trim()) {
        params.set("query", auditQuery.trim());
      }
      if (auditAction !== "all") {
        params.set("action", auditAction);
      }
      if (auditTargetType !== "all") {
        params.set("targetType", auditTargetType);
      }
      if (auditDateFrom) {
        params.set("dateFrom", auditDateFrom);
      }
      if (auditDateTo) {
        params.set("dateTo", auditDateTo);
      }

      const auditRes = await fetch(`/api/sa/audit-logs?${params.toString()}`, { cache: "no-store" });
      const auditPayload = (await auditRes.json().catch(() => null)) as { data?: { logs?: AuditItem[] }; error?: { message?: string } } | null;
      if (!auditRes.ok) {
        throw new Error(auditPayload?.error?.message ?? "Failed to load audit logs");
      }

      setAuditLogs(auditPayload?.data?.logs ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load audit logs.");
    }
  }, [auditAction, auditDateFrom, auditDateTo, auditQuery, auditTargetType]);

  const pollWebhookFailures = useCallback(async () => {
    try {
      const [verificationRes, missingChargeRes] = await Promise.all([
        fetch("/api/sa/audit-logs?limit=20&targetType=billing_webhook&action=pakasir.webhook.verification_failed", { cache: "no-store" }),
        fetch("/api/sa/audit-logs?limit=20&targetType=billing_webhook&action=pakasir.webhook.charge_not_found", { cache: "no-store" })
      ]);

      if (!verificationRes.ok || !missingChargeRes.ok) {
        return;
      }

      const verificationPayload = (await verificationRes.json().catch(() => null)) as { data?: { logs?: AuditItem[] } } | null;
      const missingChargePayload = (await missingChargeRes.json().catch(() => null)) as { data?: { logs?: AuditItem[] } } | null;
      const failureLogs = [...(verificationPayload?.data?.logs ?? []), ...(missingChargePayload?.data?.logs ?? [])];

      if (failureLogs.length === 0) {
        return;
      }

      const previousIds = knownFailureAuditIdsRef.current;
      const nextIds = new Set(failureLogs.map((log) => log.id));
      const newLogs = failureLogs.filter((log) => !previousIds.has(log.id));
      knownFailureAuditIdsRef.current = nextIds;

      if (isFirstFailurePollRef.current) {
        isFirstFailurePollRef.current = false;
        return;
      }

      if (newLogs.length === 0) {
        return;
      }

      setHighlightedAuditIds((current) => Array.from(new Set([...current, ...newLogs.map((log) => log.id)])).slice(0, 30));
      for (const log of newLogs.slice(0, 3)) {
        notifyError("Webhook pembayaran gagal diverifikasi", {
          description: `${log.action} • ${log.targetId}`,
          id: `sa-webhook-fail-${log.id}`,
          duration: 5500
        });
      }

      window.setTimeout(() => {
        setHighlightedAuditIds((current) => current.filter((id) => !newLogs.some((log) => log.id === id)));
      }, 60_000);

      void loadOverview();
      void loadAuditLogs();
    } catch {
      // best effort alert polling
    }
  }, [loadAuditLogs, loadOverview]);

  useEffect(() => {
    void loadCore();
  }, [loadCore]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    const handle = window.setInterval(() => {
      void loadOverview();
    }, 30_000);
    return () => {
      window.clearInterval(handle);
    };
  }, [loadOverview]);

  useEffect(() => {
    void pollWebhookFailures();
    const handle = window.setInterval(() => {
      void pollWebhookFailures();
    }, 30_000);
    return () => {
      window.clearInterval(handle);
    };
  }, [pollWebhookFailures]);

  useEffect(() => {
    void loadAuditLogs();
  }, [loadAuditLogs]);

  async function applySubscriptionAction(
    orgId: string,
    action: "MARK_ACTIVE" | "MARK_PAST_DUE" | "CANCEL" | "EXTEND_TRIAL",
    extendDays?: number
  ) {
    setBusyKey(`${orgId}:${action}`);
    setError(null);

    try {
      const response = await fetch(`/api/sa/orgs/${encodeURIComponent(orgId)}/subscription/actions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ action, extendDays })
      });

      const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
      if (!response.ok) {
        throw new Error(payload?.error?.message ?? "Failed to apply action.");
      }

      await Promise.all([loadCore(), loadOverview(), loadAuditLogs()]);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Failed to apply action.");
    } finally {
      setBusyKey(null);
    }
  }

  async function toggleSuperadmin(userId: string, enabled: boolean) {
    setBusyKey(`${userId}:sa:${enabled ? "on" : "off"}`);
    setError(null);

    try {
      const response = await fetch("/api/sa/platform-members", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ userId, enabled })
      });

      const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
      if (!response.ok) {
        throw new Error(payload?.error?.message ?? "Failed to update superadmin role.");
      }

      await Promise.all([loadCore(), loadOverview(), loadAuditLogs()]);
    } catch (roleError) {
      setError(roleError instanceof Error ? roleError.message : "Failed to update superadmin role.");
    } finally {
      setBusyKey(null);
    }
  }

  const statusSummary = overview?.statusSummary ?? {
    totalOrgs: subscriptions.length,
    active: subscriptions.filter((item) => item.status === "ACTIVE").length,
    trialing: subscriptions.filter((item) => item.status === "TRIALING").length,
    pastDue: subscriptions.filter((item) => item.status === "PAST_DUE").length,
    canceled: subscriptions.filter((item) => item.status === "CANCELED").length,
    connectedWhatsappOrgs: subscriptions.filter((item) => item.org._count.waAccounts > 0).length
  };

  const statTotalUsers = users.length;
  const statSuperadmins = users.filter((user) => Boolean(user.platformMembership)).length;

  const waConnectivity = subscriptions
    .map((item) => ({
      orgId: item.orgId,
      orgName: item.org.name,
      waAccounts: item.org._count.waAccounts,
      members: item.org._count.members
    }))
    .sort((left, right) => right.waAccounts - left.waAccounts || left.orgName.localeCompare(right.orgName));

  const trendData = trendWindow === "7" ? (overview?.trends.sevenDays ?? []) : (overview?.trends.thirtyDays ?? []);
  const auditActions = useMemo(
    () => [
      "all",
      ...Array.from(
        new Set([
          ...auditLogs.map((log) => log.action),
          "pakasir.webhook.received",
          "pakasir.webhook.completed",
          "pakasir.webhook.verification_failed",
          "pakasir.webhook.charge_not_found",
          "subscription.mark_active",
          "subscription.mark_past_due",
          "subscription.cancel",
          "platform_member.grant",
          "platform_member.revoke"
        ])
      )
    ],
    [auditLogs]
  );
  const auditTargetTypes = useMemo(() => ["all", ...Array.from(new Set(auditLogs.map((log) => log.targetType)))], [auditLogs]);

  const filteredAuditLogs = auditLogs;

  function classifySeverity(action: string): "critical" | "warning" | "info" {
    if (action.includes("verification_failed") || action.includes("charge_not_found") || action.includes("cancel")) {
      return "critical";
    }
    if (action.includes("past_due") || action.includes("replay_skipped") || action.includes("revoke")) {
      return "warning";
    }
    return "info";
  }

  function applyAuditPreset(preset: "all" | "billing" | "webhook" | "errors") {
    if (preset === "all") {
      setAuditQuery("");
      setAuditAction("all");
      setAuditTargetType("all");
      return;
    }

    if (preset === "billing") {
      setAuditQuery("");
      setAuditAction("all");
      setAuditTargetType("org_subscription");
      return;
    }

    if (preset === "webhook") {
      setAuditQuery("");
      setAuditAction("all");
      setAuditTargetType("billing_webhook");
      return;
    }

    setAuditQuery("");
    setAuditTargetType("billing_webhook");
    setAuditAction("pakasir.webhook.verification_failed");
  }

  function exportAuditCsv() {
    const params = new URLSearchParams();
    if (auditQuery.trim()) {
      params.set("query", auditQuery.trim());
    }
    if (auditAction !== "all") {
      params.set("action", auditAction);
    }
    if (auditTargetType !== "all") {
      params.set("targetType", auditTargetType);
    }
    if (auditDateFrom) {
      params.set("dateFrom", auditDateFrom);
    }
    if (auditDateTo) {
      params.set("dateTo", auditDateTo);
    }
    window.open(`/api/sa/audit-logs/export?${params.toString()}`, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="inbox-scroll h-full w-full min-w-0 flex-1 overflow-y-auto p-4 md:p-6">
      <div className="w-full space-y-4">
        <header className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Superadmin Panel</h1>
            <p className="mt-1 text-sm text-muted-foreground">Kelola status subscription organisasi, operasional billing, dan akses superadmin platform.</p>
          </div>
          <Button variant="outline" onClick={() => void Promise.all([loadCore(), loadOverview(), loadAuditLogs()])} disabled={Boolean(busyKey)}>
            Refresh Data
          </Button>
        </header>

        {error ? <p className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}

        <Tabs defaultValue="overview" className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
          <TabsList className="h-auto w-full flex-col items-stretch justify-start gap-1 rounded-xl border border-border/70 bg-card p-2">
            <TabsTrigger value="overview" className="w-full justify-start">Overview</TabsTrigger>
            <TabsTrigger value="webhook" className="w-full justify-start">Webhook & Jobs</TabsTrigger>
            <TabsTrigger value="risk" className="w-full justify-start">Risk & Billing</TabsTrigger>
            <TabsTrigger value="subscriptions" className="w-full justify-start">Subscriptions</TabsTrigger>
            <TabsTrigger value="whatsapp" className="w-full justify-start">WhatsApp</TabsTrigger>
            <TabsTrigger value="users" className="w-full justify-start">Users</TabsTrigger>
            <TabsTrigger value="audit" className="w-full justify-start">Audit Trail</TabsTrigger>
          </TabsList>

          <div className="space-y-4">
            <TabsContent value="overview" className="m-0 space-y-4">
              <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">Organizations</CardTitle></CardHeader>
                  <CardContent>
                    <p className="text-2xl font-semibold">{statusSummary.totalOrgs}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Active {statusSummary.active} • Trial {statusSummary.trialing}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">Billing Health</CardTitle></CardHeader>
                  <CardContent>
                    <p className="text-2xl font-semibold">{statusSummary.pastDue}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Past Due • Canceled {statusSummary.canceled}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">WhatsApp Connected</CardTitle></CardHeader>
                  <CardContent>
                    <p className="text-2xl font-semibold">{statusSummary.connectedWhatsappOrgs}</p>
                    <p className="mt-1 text-xs text-muted-foreground">of {statusSummary.totalOrgs} organizations</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">Platform Users</CardTitle></CardHeader>
                  <CardContent>
                    <p className="text-2xl font-semibold">{statTotalUsers}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Superadmin {statSuperadmins}</p>
                  </CardContent>
                </Card>
              </section>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <CardTitle>Revenue & Signup Trends</CardTitle>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant={trendWindow === "7" ? "default" : "outline"} onClick={() => setTrendWindow("7")}>7 Hari</Button>
                    <Button size="sm" variant={trendWindow === "30" ? "default" : "outline"} onClick={() => setTrendWindow("30")}>30 Hari</Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {trendData.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Belum ada data tren.</p>
                  ) : (
                    <>
                      <div>
                        <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Paid Amount</p>
                        <TrendBarChart data={trendData} metric="paidAmountCents" />
                        <p className="mt-2 text-xs text-muted-foreground">Total {formatCurrency(trendData.reduce((sum, item) => sum + item.paidAmountCents, 0))}</p>
                      </div>
                      <div>
                        <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Paid Transactions</p>
                        <TrendBarChart data={trendData} metric="paidCount" />
                      </div>
                      <div>
                        <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">New Organizations</p>
                        <TrendBarChart data={trendData} metric="newOrgs" />
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="webhook" className="m-0 space-y-4">
              <section className="grid gap-4 xl:grid-cols-3">
                <Card><CardHeader><CardTitle>Queue / Job Monitor</CardTitle></CardHeader><CardContent className="space-y-2 text-sm"><p>Redis: {overview?.queueHealth.redisConfigured ? (overview.queueHealth.redisReachable ? "Connected" : "Unavailable") : "Not configured"}</p><p>Meta event queue: {overview?.queueHealth.metaEventQueue ?? "-"}</p><p>Media queue: {overview?.queueHealth.mediaQueue ?? "-"}</p><p>Cleanup queue: {overview?.queueHealth.cleanupQueue ?? "-"}</p>{overview?.queueHealth.error ? <p className="text-xs text-destructive">{overview.queueHealth.error}</p> : null}</CardContent></Card>
                <Card><CardHeader><CardTitle>Payment Processing</CardTitle></CardHeader><CardContent className="space-y-2 text-sm"><p>Charges dibuat 24 jam: {overview?.paymentHealth.createdLast24h ?? "-"}</p><p>Charges paid 24 jam: {overview?.paymentHealth.paidLast24h ?? "-"}</p><p>Pending total: {overview?.paymentHealth.pending ?? "-"}</p><p>Pending expired: {overview?.paymentHealth.pendingExpired ?? "-"}</p><p>Pending stale &gt; 1 jam: {overview?.paymentHealth.pendingStaleOver1h ?? "-"}</p></CardContent></Card>
                <Card><CardHeader><CardTitle>Webhook Monitor</CardTitle></CardHeader><CardContent className="space-y-2 text-sm"><p>Received 24 jam: {overview?.webhookHealth.receivedLast24h ?? "-"}</p><p>Completed 24 jam: {overview?.webhookHealth.completedLast24h ?? "-"}</p><p>Failed 24 jam: {overview?.webhookHealth.failedLast24h ?? "-"}</p><p>Replay skipped 24 jam: {overview?.webhookHealth.replaySkippedLast24h ?? "-"}</p><p>Order retried (&gt;1x): {overview?.webhookHealth.retriedOrdersLast24h ?? "-"}</p></CardContent></Card>
              </section>
              <Card>
                <CardHeader><CardTitle>Latest Webhook Events</CardTitle></CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader><TableRow><TableHead>Time</TableHead><TableHead>Order ID</TableHead><TableHead>Action</TableHead><TableHead>Meta</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {(overview?.webhookEvents ?? []).map((event) => (
                        <TableRow key={event.id}><TableCell className="whitespace-nowrap">{formatDateTime(event.createdAt)}</TableCell><TableCell>{event.orderId}</TableCell><TableCell>{event.action}</TableCell><TableCell className="font-mono text-xs text-muted-foreground">{event.meta ? JSON.stringify(event.meta) : "{}"}</TableCell></TableRow>
                      ))}
                      {(overview?.webhookEvents ?? []).length === 0 ? <TableRow><TableCell colSpan={4} className="text-muted-foreground">Belum ada webhook event.</TableCell></TableRow> : null}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="risk" className="m-0 space-y-4">
              <Card>
                <CardHeader><CardTitle>Risk List (Auto)</CardTitle></CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader><TableRow><TableHead>Org</TableHead><TableHead>Risk</TableHead><TableHead>Status</TableHead><TableHead>Due</TableHead><TableHead>WA</TableHead><TableHead>Members</TableHead><TableHead>Reason</TableHead><TableHead>Action</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {(overview?.riskOrgs ?? []).map((risk) => (
                        <TableRow key={risk.orgId}>
                          <TableCell className="font-medium">{risk.orgName}</TableCell>
                          <TableCell><span className={risk.riskLevel === "high" ? "rounded-full border border-rose-300 bg-rose-500/10 px-2 py-1 text-xs font-medium text-rose-700" : risk.riskLevel === "medium" ? "rounded-full border border-amber-300 bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-700" : "rounded-full border border-slate-300 bg-slate-500/10 px-2 py-1 text-xs font-medium text-slate-700"}>{risk.riskLevel.toUpperCase()}</span></TableCell>
                          <TableCell>{risk.status}</TableCell>
                          <TableCell>{formatDateTime(risk.dueAt)}</TableCell>
                          <TableCell>{risk.waAccounts}</TableCell>
                          <TableCell>{risk.members}</TableCell>
                          <TableCell>{risk.reason}</TableCell>
                          <TableCell><div className="flex items-center gap-2"><Button size="sm" variant="outline" disabled={Boolean(busyKey)} onClick={() => void applySubscriptionAction(risk.orgId, "MARK_ACTIVE")}>Mark Active</Button><Button size="sm" variant="outline" disabled={Boolean(busyKey)} onClick={() => void applySubscriptionAction(risk.orgId, "EXTEND_TRIAL", 3)}>Extend 3d</Button></div></TableCell>
                        </TableRow>
                      ))}
                      {(overview?.riskOrgs ?? []).length === 0 ? <TableRow><TableCell colSpan={8} className="text-muted-foreground">Tidak ada organisasi berisiko saat ini.</TableCell></TableRow> : null}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="subscriptions" className="m-0 space-y-4">
              <Card>
                <CardHeader><CardTitle>Subscriptions</CardTitle></CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader><TableRow><TableHead>Org</TableHead><TableHead>Status</TableHead><TableHead>WA</TableHead><TableHead>Members</TableHead><TableHead>Trial End</TableHead><TableHead>Period End</TableHead><TableHead>Latest Charge</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {subscriptions.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.org.name}</TableCell>
                          <TableCell>{item.status}</TableCell>
                          <TableCell>{item.org._count.waAccounts > 0 ? "Connected" : "Not Connected"}</TableCell>
                          <TableCell>{item.org._count.members}</TableCell>
                          <TableCell>{formatDate(item.trialEndAt)}</TableCell>
                          <TableCell>{formatDate(item.currentPeriodEndAt)}</TableCell>
                          <TableCell>{item.org.billingCharges[0] ? `${item.org.billingCharges[0].status} • ${new Intl.NumberFormat("id-ID").format(item.org.billingCharges[0].totalAmountCents)}` : "-"}</TableCell>
                          <TableCell><div className="flex items-center gap-2"><Button size="sm" variant="outline" disabled={Boolean(busyKey)} onClick={() => void applySubscriptionAction(item.orgId, "MARK_ACTIVE")}>Active</Button><Button size="sm" variant="outline" disabled={Boolean(busyKey)} onClick={() => void applySubscriptionAction(item.orgId, "MARK_PAST_DUE")}>Past Due</Button><Button size="sm" variant="destructive" disabled={Boolean(busyKey)} onClick={() => void applySubscriptionAction(item.orgId, "CANCEL")}>Cancel</Button></div></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="whatsapp" className="m-0 space-y-4">
              <Card>
                <CardHeader><CardTitle>WhatsApp Connectivity</CardTitle></CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader><TableRow><TableHead>Organization</TableHead><TableHead>WA Accounts</TableHead><TableHead>Members</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {waConnectivity.map((row) => (
                        <TableRow key={row.orgId}><TableCell className="font-medium">{row.orgName}</TableCell><TableCell>{row.waAccounts}</TableCell><TableCell>{row.members}</TableCell><TableCell><span className={row.waAccounts > 0 ? "rounded-full border border-emerald-300 bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-700" : "rounded-full border border-rose-300 bg-rose-500/10 px-2 py-1 text-xs font-medium text-rose-700"}>{row.waAccounts > 0 ? "Connected" : "Not Connected"}</span></TableCell></TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="users" className="m-0 space-y-4">
              <Card>
                <CardHeader><CardTitle>Users</CardTitle></CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Phone</TableHead><TableHead>Platform Role</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {users.map((user) => {
                        const enabled = Boolean(user.platformMembership);
                        return (
                          <TableRow key={user.id}>
                            <TableCell>{user.name ?? "-"}</TableCell>
                            <TableCell>{user.email}</TableCell>
                            <TableCell>{user.phoneE164 ?? "-"}</TableCell>
                            <TableCell>{enabled ? user.platformMembership?.role : "-"}</TableCell>
                            <TableCell><Button size="sm" variant={enabled ? "destructive" : "outline"} disabled={Boolean(busyKey)} onClick={() => void toggleSuperadmin(user.id, !enabled)}>{enabled ? "Revoke SA" : "Grant SA"}</Button></TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="audit" className="m-0 space-y-4">
              <Card>
                <CardHeader className="space-y-3">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <CardTitle>Platform Audit Trail</CardTitle>
                      <p className="mt-1 text-xs text-muted-foreground">Last update: {formatDateTime(overview?.generatedAt ?? null)}</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={exportAuditCsv}>Export CSV</Button>
                  </div>
                  <div className="grid gap-2 md:grid-cols-5">
                    <input className="h-9 rounded-md border border-border bg-background px-3 text-sm" placeholder="Search actor/action/target/meta" value={auditQuery} onChange={(event) => setAuditQuery(event.target.value)} />
                    <select className="h-9 rounded-md border border-border bg-background px-3 text-sm" value={auditAction} onChange={(event) => setAuditAction(event.target.value)}>
                      {auditActions.map((action) => (<option key={action} value={action}>{action === "all" ? "All actions" : action}</option>))}
                    </select>
                    <select className="h-9 rounded-md border border-border bg-background px-3 text-sm" value={auditTargetType} onChange={(event) => setAuditTargetType(event.target.value)}>
                      {auditTargetTypes.map((target) => (<option key={target} value={target}>{target === "all" ? "All target types" : target}</option>))}
                    </select>
                    <input type="date" className="h-9 rounded-md border border-border bg-background px-3 text-sm" value={auditDateFrom} onChange={(event) => setAuditDateFrom(event.target.value)} />
                    <input type="date" className="h-9 rounded-md border border-border bg-background px-3 text-sm" value={auditDateTo} onChange={(event) => setAuditDateTo(event.target.value)} />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => applyAuditPreset("all")}>All</Button>
                    <Button size="sm" variant="outline" onClick={() => applyAuditPreset("billing")}>Billing Actions</Button>
                    <Button size="sm" variant="outline" onClick={() => applyAuditPreset("webhook")}>Webhook Only</Button>
                    <Button size="sm" variant="outline" onClick={() => applyAuditPreset("errors")}>Errors Only</Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader><TableRow><TableHead>Time</TableHead><TableHead>Severity</TableHead><TableHead>Actor</TableHead><TableHead>Action</TableHead><TableHead>Target</TableHead><TableHead>Meta</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {filteredAuditLogs.map((log) => {
                        const severity = classifySeverity(log.action);
                        const severityClass = severity === "critical" ? "rounded-full border border-rose-300 bg-rose-500/10 px-2 py-1 text-xs font-medium text-rose-700" : severity === "warning" ? "rounded-full border border-amber-300 bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-700" : "rounded-full border border-sky-300 bg-sky-500/10 px-2 py-1 text-xs font-medium text-sky-700";
                        return (
                          <TableRow key={log.id} className={highlightedAuditIds.includes(log.id) ? "bg-destructive/10" : ""}>
                            <TableCell className="whitespace-nowrap">{formatDateTime(log.createdAt)}</TableCell>
                            <TableCell><span className={severityClass}>{severity.toUpperCase()}</span></TableCell>
                            <TableCell>{log.actor?.email ?? log.actorUserId}</TableCell>
                            <TableCell>{log.action}</TableCell>
                            <TableCell>{`${log.targetType}:${log.targetId}`}</TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">{log.meta ? JSON.stringify(log.meta) : "{}"}</TableCell>
                          </TableRow>
                        );
                      })}
                      {filteredAuditLogs.length === 0 ? <TableRow><TableCell colSpan={6} className="text-muted-foreground">Belum ada audit log pada filter saat ini.</TableCell></TableRow> : null}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
