"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ShieldCheck, RefreshCcw, Layers, Globe, Users2, Activity, ShieldAlert, AlertCircle, ReceiptText, CreditCard, WalletCards, HandCoins } from "lucide-react";

import { Button } from "@/components/ui/button";
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

type BillingChargeItem = {
  id: string;
  orgId: string;
  orderId: string;
  status: string;
  paymentMethod: string;
  gatewayProvider: string;
  baseAmountCents: number;
  gatewayFeeCents: number;
  totalAmountCents: number;
  paymentNumber: string | null;
  expiredAt: string | null;
  paidAt: string | null;
  createdAt: string;
  org: {
    name: string;
  };
};

type InvoicePaymentAttemptItem = {
  id: string;
  orgId: string;
  invoiceId: string;
  orderId: string;
  provider: string;
  paymentMethod: string;
  status: string;
  feePolicy: string;
  invoiceAmountCents: number;
  feeCents: number;
  customerPayableCents: number;
  paymentNumber: string | null;
  expiresAt: string | null;
  paidAt: string | null;
  createdAt: string;
  org: {
    name: string;
  };
  invoice: {
    invoiceNo: string;
    customer: {
      displayName: string | null;
      phoneE164: string;
    };
  };
};

type WalletTopupItem = {
  id: string;
  orgId: string;
  orderId: string;
  amountCents: number;
  feeCents: number;
  customerPayableCents: number;
  paymentMethod: string;
  paymentNumber: string | null;
  status: string;
  expiresAt: string | null;
  paidAt: string | null;
  createdAt: string;
  org: {
    name: string;
  };
};

type WalletWithdrawRequestItem = {
  id: string;
  orgId: string;
  amountCents: number;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  status: string;
  note: string | null;
  processedNote: string | null;
  requestedByUserId: string;
  processedByUserId: string | null;
  processedAt: string | null;
  createdAt: string;
  org: {
    name: string;
  };
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
  const [billingCharges, setBillingCharges] = useState<BillingChargeItem[]>([]);
  const [invoiceAttempts, setInvoiceAttempts] = useState<InvoicePaymentAttemptItem[]>([]);
  const [walletTopups, setWalletTopups] = useState<WalletTopupItem[]>([]);
  const [walletWithdrawRequests, setWalletWithdrawRequests] = useState<WalletWithdrawRequestItem[]>([]);
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

  const loadFinance = useCallback(async () => {
    setError(null);
    try {
      const [chargesRes, attemptsRes, topupsRes, withdrawRes] = await Promise.all([
        fetch("/api/sa/billing/charges", { cache: "no-store" }),
        fetch("/api/sa/invoices/payment-attempts", { cache: "no-store" }),
        fetch("/api/sa/wallet/topups", { cache: "no-store" }),
        fetch("/api/sa/wallet/withdrawals", { cache: "no-store" })
      ]);

      const chargesPayload = (await chargesRes.json().catch(() => null)) as { data?: { charges?: BillingChargeItem[] }; error?: { message?: string } } | null;
      const attemptsPayload = (await attemptsRes.json().catch(() => null)) as { data?: { attempts?: InvoicePaymentAttemptItem[] }; error?: { message?: string } } | null;
      const topupsPayload = (await topupsRes.json().catch(() => null)) as { data?: { topups?: WalletTopupItem[] }; error?: { message?: string } } | null;
      const withdrawPayload = (await withdrawRes.json().catch(() => null)) as { data?: { requests?: WalletWithdrawRequestItem[] }; error?: { message?: string } } | null;

      if (!chargesRes.ok) {
        throw new Error(chargesPayload?.error?.message ?? "Failed to load billing charges.");
      }
      if (!attemptsRes.ok) {
        throw new Error(attemptsPayload?.error?.message ?? "Failed to load invoice payment attempts.");
      }
      if (!topupsRes.ok) {
        throw new Error(topupsPayload?.error?.message ?? "Failed to load wallet topups.");
      }
      if (!withdrawRes.ok) {
        throw new Error(withdrawPayload?.error?.message ?? "Failed to load wallet withdraw requests.");
      }

      setBillingCharges(chargesPayload?.data?.charges ?? []);
      setInvoiceAttempts(attemptsPayload?.data?.attempts ?? []);
      setWalletTopups(topupsPayload?.data?.topups ?? []);
      setWalletWithdrawRequests(withdrawPayload?.data?.requests ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load finance data.");
    }
  }, []);

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

  useEffect(() => {
    void loadFinance();
  }, [loadFinance]);

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

  async function processWithdrawRequest(requestId: string, action: "APPROVE" | "PAID" | "REJECT") {
    setBusyKey(`withdraw:${requestId}:${action}`);
    setError(null);

    try {
      const response = await fetch(`/api/sa/wallet/withdrawals/${encodeURIComponent(requestId)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ action })
      });
      const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
      if (!response.ok) {
        throw new Error(payload?.error?.message ?? "Failed to process withdraw request.");
      }

      await Promise.all([loadFinance(), loadOverview(), loadAuditLogs()]);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to process withdraw request.");
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
    <div className="inbox-scroll h-full w-full min-w-0 flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
      <div className="w-full max-w-[1400px] mx-auto space-y-6">
        <header className="rounded-[32px] border border-border/70 bg-gradient-to-br from-card to-card/90 p-6 md:p-8 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.02)] relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6 group">
          <div className="absolute inset-0 bg-grid-black/[0.02] dark:bg-grid-white/[0.02] [mask-image:linear-gradient(to_bottom_right,white,transparent)]" />
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-emerald-500/10 blur-3xl transition-opacity duration-500 group-hover:opacity-80" />
          
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center gap-5">
             <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-600 shadow-sm shrink-0">
                <ShieldCheck className="h-8 w-8" />
             </div>
             <div>
               <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">Superadmin Panel</h1>
               <p className="mt-1.5 text-[14px] font-medium leading-relaxed text-muted-foreground/80">
                 Kelola status subscription, operasional billing, dan akses superadmin.
               </p>
             </div>
          </div>
          <Button size="lg" className="h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 font-bold text-white shadow-[0_8px_20px_-6px_rgba(16,185,129,0.3)] transition-all px-6 relative z-10" onClick={() => void Promise.all([loadCore(), loadOverview(), loadAuditLogs(), loadFinance()])} disabled={Boolean(busyKey)}>
            <RefreshCcw className={`mr-2.5 h-5 w-5 ${busyKey ? "animate-spin" : ""}`} />
            Refresh Data
          </Button>
        </header>

        {error ? <p className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-[13px] font-medium text-rose-600 dark:text-rose-400 shadow-sm w-full">{error}</p> : null}

        <Tabs defaultValue="overview" className="grid gap-6">
          <TabsList className="h-auto w-full flex-wrap sm:flex-nowrap items-stretch justify-start gap-2 rounded-2xl border border-border/60 bg-muted/30 p-2 shadow-sm">
            <TabsTrigger value="overview" className="flex-1 min-w-[120px] rounded-xl text-[13px] font-bold data-[state=active]:bg-white dark:data-[state=active]:bg-card data-[state=active]:shadow-sm data-[state=active]:text-emerald-600 py-2.5 transition-all">Overview</TabsTrigger>
            <TabsTrigger value="webhook" className="flex-1 min-w-[120px] rounded-xl text-[13px] font-bold data-[state=active]:bg-white dark:data-[state=active]:bg-card data-[state=active]:shadow-sm data-[state=active]:text-emerald-600 py-2.5 transition-all">Webhook & Jobs</TabsTrigger>
            <TabsTrigger value="risk" className="flex-1 min-w-[120px] rounded-xl text-[13px] font-bold data-[state=active]:bg-white dark:data-[state=active]:bg-card data-[state=active]:shadow-sm data-[state=active]:text-emerald-600 py-2.5 transition-all">Risk & Billing</TabsTrigger>
            <TabsTrigger value="subscriptions" className="flex-1 min-w-[120px] rounded-xl text-[13px] font-bold data-[state=active]:bg-white dark:data-[state=active]:bg-card data-[state=active]:shadow-sm data-[state=active]:text-emerald-600 py-2.5 transition-all">Subscriptions</TabsTrigger>
            <TabsTrigger value="transactions" className="flex-1 min-w-[120px] rounded-xl text-[13px] font-bold data-[state=active]:bg-white dark:data-[state=active]:bg-card data-[state=active]:shadow-sm data-[state=active]:text-emerald-600 py-2.5 transition-all">Transactions</TabsTrigger>
            <TabsTrigger value="whatsapp" className="flex-1 min-w-[120px] rounded-xl text-[13px] font-bold data-[state=active]:bg-white dark:data-[state=active]:bg-card data-[state=active]:shadow-sm data-[state=active]:text-emerald-600 py-2.5 transition-all">WhatsApp</TabsTrigger>
            <TabsTrigger value="users" className="flex-1 min-w-[120px] rounded-xl text-[13px] font-bold data-[state=active]:bg-white dark:data-[state=active]:bg-card data-[state=active]:shadow-sm data-[state=active]:text-emerald-600 py-2.5 transition-all">Users</TabsTrigger>
            <TabsTrigger value="audit" className="flex-1 min-w-[120px] rounded-xl text-[13px] font-bold data-[state=active]:bg-white dark:data-[state=active]:bg-card data-[state=active]:shadow-sm data-[state=active]:text-emerald-600 py-2.5 transition-all">Audit</TabsTrigger>
          </TabsList>

          <div className="space-y-6">
            <TabsContent value="overview" className="m-0 space-y-6">
              <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-[24px] border border-border/70 bg-card p-6 shadow-sm overflow-hidden relative">
                  <Globe className="absolute -right-4 -bottom-4 h-24 w-24 text-emerald-500/5 rotate-12" />
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground/80 relative z-10">Organizations</p>
                  <p className="mt-3 text-3xl font-black tracking-tight text-foreground relative z-10">{statusSummary.totalOrgs}</p>
                  <p className="mt-2 text-[13px] font-medium text-emerald-600 relative z-10 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" /> Active {statusSummary.active}
                    <span className="text-muted-foreground mx-1">•</span> 
                    <span className="w-2 h-2 rounded-full bg-amber-500" /> Trial {statusSummary.trialing}
                  </p>
                </div>
                
                <div className="rounded-[24px] border border-border/70 bg-card p-6 shadow-sm overflow-hidden relative">
                  <Layers className="absolute -right-4 -bottom-4 h-24 w-24 text-amber-500/5 rotate-12" />
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground/80 relative z-10">Billing Health</p>
                  <p className="mt-3 text-3xl font-black tracking-tight text-foreground relative z-10">{statusSummary.pastDue}</p>
                  <p className="mt-2 text-[13px] font-medium text-amber-600 relative z-10 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500" /> Past Due
                    <span className="text-muted-foreground mx-1">•</span> 
                    <span className="w-2 h-2 rounded-full bg-rose-500" /> Canceled {statusSummary.canceled}
                  </p>
                </div>

                <div className="rounded-[24px] border border-border/70 bg-card p-6 shadow-sm overflow-hidden relative">
                  <Activity className="absolute -right-4 -bottom-4 h-24 w-24 text-sky-500/5 rotate-12" />
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground/80 relative z-10">WA Connected</p>
                  <p className="mt-3 text-3xl font-black tracking-tight text-foreground relative z-10">{statusSummary.connectedWhatsappOrgs}</p>
                  <p className="mt-2 text-[13px] font-medium text-muted-foreground relative z-10">of {statusSummary.totalOrgs} total organizations</p>
                </div>

                <div className="rounded-[24px] border border-border/70 bg-card p-6 shadow-sm overflow-hidden relative">
                  <Users2 className="absolute -right-4 -bottom-4 h-24 w-24 text-indigo-500/5 rotate-12" />
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground/80 relative z-10">Platform Users</p>
                  <p className="mt-3 text-3xl font-black tracking-tight text-foreground relative z-10">{statTotalUsers}</p>
                  <p className="mt-2 text-[13px] font-medium text-indigo-600 relative z-10 flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4" /> Superadmin {statSuperadmins}
                  </p>
                </div>
              </section>

              <div className="rounded-[28px] border border-border/70 bg-card p-6 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                  <h2 className="text-[18px] font-bold tracking-tight text-foreground">Revenue & Signup Trends</h2>
                  <div className="flex bg-muted/40 p-1 rounded-xl border border-border/60 w-fit">
                    <Button size="sm" variant={trendWindow === "7" ? "secondary" : "ghost"} className={`rounded-lg h-8 px-4 ${trendWindow === "7" ? "shadow-sm font-bold bg-background text-foreground" : "font-medium text-muted-foreground"}`} onClick={() => setTrendWindow("7")}>7 Hari</Button>
                    <Button size="sm" variant={trendWindow === "30" ? "secondary" : "ghost"} className={`rounded-lg h-8 px-4 ${trendWindow === "30" ? "shadow-sm font-bold bg-background text-foreground" : "font-medium text-muted-foreground"}`} onClick={() => setTrendWindow("30")}>30 Hari</Button>
                  </div>
                </div>
                <div className="space-y-8">
                  {trendData.length === 0 ? (
                    <div className="py-12 flex flex-col items-center justify-center text-center">
                      <BarChart className="h-12 w-12 text-muted-foreground/30 mb-4" />
                      <p className="text-[14px] font-medium text-muted-foreground">Belum ada data tren.</p>
                    </div>
                  ) : (
                    <div className="grid gap-8 lg:grid-cols-2">
                      <div className="rounded-2xl border border-border/50 bg-background/50 p-5">
                        <div className="flex items-center justify-between mb-4">
                          <p className="text-[12px] font-bold uppercase tracking-wider text-muted-foreground">Paid Amount</p>
                          <span className="text-[13px] font-bold text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">{formatCurrency(trendData.reduce((sum, item) => sum + item.paidAmountCents, 0))} Total</span>
                        </div>
                        <TrendBarChart data={trendData} metric="paidAmountCents" />
                      </div>
                      <div className="rounded-2xl border border-border/50 bg-background/50 p-5">
                        <p className="text-[12px] font-bold uppercase tracking-wider text-muted-foreground mb-4">Paid Transactions</p>
                        <TrendBarChart data={trendData} metric="paidCount" />
                      </div>
                      <div className="rounded-2xl border border-border/50 bg-background/50 p-5 lg:col-span-2 xl:col-span-1">
                        <p className="text-[12px] font-bold uppercase tracking-wider text-muted-foreground mb-4">New Organizations</p>
                        <TrendBarChart data={trendData} metric="newOrgs" />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="webhook" className="m-0 space-y-6">
              <section className="grid gap-5 xl:grid-cols-3">
                <div className="rounded-[24px] border border-border/70 bg-card p-6 shadow-sm overflow-hidden relative group">
                  <div className="flex items-center gap-2 mb-4">
                    <Activity className="h-5 w-5 text-emerald-500" />
                    <h3 className="text-[16px] font-bold tracking-tight text-foreground">Queue / Job Monitor</h3>
                  </div>
                  <div className="space-y-3 text-[13px] font-medium text-muted-foreground">
                    <div className="flex justify-between items-center"><span className="text-foreground/80">Redis:</span><span className={overview?.queueHealth.redisConfigured ? (overview.queueHealth.redisReachable ? "text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full" : "text-rose-600 dark:text-rose-400 font-bold bg-rose-500/10 px-2 py-0.5 rounded-full") : "text-muted-foreground"}>{overview?.queueHealth.redisConfigured ? (overview.queueHealth.redisReachable ? "Connected" : "Unavailable") : "Not configured"}</span></div>
                    <div className="flex justify-between items-center"><span className="text-foreground/80">Meta event queue:</span><span className="font-bold text-foreground">{overview?.queueHealth.metaEventQueue ?? "-"}</span></div>
                    <div className="flex justify-between items-center"><span className="text-foreground/80">Media queue:</span><span className="font-bold text-foreground">{overview?.queueHealth.mediaQueue ?? "-"}</span></div>
                    <div className="flex justify-between items-center"><span className="text-foreground/80">Cleanup queue:</span><span className="font-bold text-foreground">{overview?.queueHealth.cleanupQueue ?? "-"}</span></div>
                    {overview?.queueHealth.error ? <div className="mt-4 p-3 rounded-xl bg-destructive/10 text-destructive text-[12px]">{overview.queueHealth.error}</div> : null}
                  </div>
                </div>

                <div className="rounded-[24px] border border-border/70 bg-card p-6 shadow-sm overflow-hidden relative group">
                  <div className="flex items-center gap-2 mb-4">
                    <Layers className="h-5 w-5 text-sky-500" />
                    <h3 className="text-[16px] font-bold tracking-tight text-foreground">Payment Processing</h3>
                  </div>
                  <div className="space-y-3 text-[13px] font-medium text-muted-foreground">
                    <div className="flex justify-between items-center"><span className="text-foreground/80">Charges dibuat 24h:</span><span className="font-bold text-foreground">{overview?.paymentHealth.createdLast24h ?? "-"}</span></div>
                    <div className="flex justify-between items-center"><span className="text-foreground/80">Charges paid 24h:</span><span className="font-bold text-emerald-600 dark:text-emerald-400">{overview?.paymentHealth.paidLast24h ?? "-"}</span></div>
                    <div className="flex justify-between items-center"><span className="text-foreground/80">Pending total:</span><span className="font-bold text-amber-600 dark:text-amber-400">{overview?.paymentHealth.pending ?? "-"}</span></div>
                    <div className="flex justify-between items-center"><span className="text-foreground/80">Pending expired:</span><span className="font-bold text-rose-600 dark:text-rose-400">{overview?.paymentHealth.pendingExpired ?? "-"}</span></div>
                    <div className="flex justify-between items-center"><span className="text-foreground/80">Pending stale &gt; 1h:</span><span className="font-bold text-foreground">{overview?.paymentHealth.pendingStaleOver1h ?? "-"}</span></div>
                  </div>
                </div>

                <div className="rounded-[24px] border border-border/70 bg-card p-6 shadow-sm overflow-hidden relative group">
                  <div className="flex items-center gap-2 mb-4">
                    <Globe className="h-5 w-5 text-indigo-500" />
                    <h3 className="text-[16px] font-bold tracking-tight text-foreground">Webhook Monitor</h3>
                  </div>
                  <div className="space-y-3 text-[13px] font-medium text-muted-foreground">
                    <div className="flex justify-between items-center"><span className="text-foreground/80">Received 24h:</span><span className="font-bold text-foreground">{overview?.webhookHealth.receivedLast24h ?? "-"}</span></div>
                    <div className="flex justify-between items-center"><span className="text-foreground/80">Completed 24h:</span><span className="font-bold text-emerald-600 dark:text-emerald-400">{overview?.webhookHealth.completedLast24h ?? "-"}</span></div>
                    <div className="flex justify-between items-center"><span className="text-foreground/80">Failed 24h:</span><span className="font-bold text-rose-600 dark:text-rose-400">{overview?.webhookHealth.failedLast24h ?? "-"}</span></div>
                    <div className="flex justify-between items-center"><span className="text-foreground/80">Replay skipped 24h:</span><span className="font-bold text-foreground">{overview?.webhookHealth.replaySkippedLast24h ?? "-"}</span></div>
                    <div className="flex justify-between items-center"><span className="text-foreground/80">Order retried (&gt;1x):</span><span className="font-bold text-foreground">{overview?.webhookHealth.retriedOrdersLast24h ?? "-"}</span></div>
                  </div>
                </div>
              </section>

              <div className="rounded-[28px] border border-border/70 bg-card shadow-sm overflow-hidden">
                <div className="border-b border-border/60 bg-gradient-to-r from-muted/30 to-transparent px-6 py-5">
                  <h2 className="text-[18px] font-bold tracking-tight text-foreground">Latest Webhook Events</h2>
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/20">
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="h-12 px-6 text-[12px] font-bold uppercase tracking-wider text-muted-foreground">Time</TableHead>
                        <TableHead className="h-12 px-6 text-[12px] font-bold uppercase tracking-wider text-muted-foreground">Order ID</TableHead>
                        <TableHead className="h-12 px-6 text-[12px] font-bold uppercase tracking-wider text-muted-foreground">Action</TableHead>
                        <TableHead className="h-12 px-6 text-[12px] font-bold uppercase tracking-wider text-muted-foreground">Meta</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(overview?.webhookEvents ?? []).map((event) => (
                        <TableRow key={event.id} className="border-t border-border/50 hover:bg-muted/10 transition-colors">
                          <TableCell className="px-6 py-4 whitespace-nowrap text-[13px] font-medium text-muted-foreground">{formatDateTime(event.createdAt)}</TableCell>
                          <TableCell className="px-6 py-4 text-[14px] font-semibold text-foreground">{event.orderId}</TableCell>
                          <TableCell className="px-6 py-4 text-[13px] font-medium"><span className="bg-muted/50 px-2 py-1 rounded-md text-foreground/80 border border-border/50">{event.action}</span></TableCell>
                          <TableCell className="px-6 py-4 font-mono text-[11px] text-muted-foreground/80 max-w-sm truncate" title={event.meta ? JSON.stringify(event.meta) : ""}>{event.meta ? JSON.stringify(event.meta) : "{}"}</TableCell>
                        </TableRow>
                      ))}
                      {(overview?.webhookEvents ?? []).length === 0 ? <TableRow><TableCell colSpan={4} className="px-6 py-12 text-center text-[14px] font-medium text-muted-foreground">Belum ada webhook event.</TableCell></TableRow> : null}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="risk" className="m-0 space-y-6">
              <div className="rounded-[28px] border border-border/70 bg-card shadow-sm overflow-hidden">
                <div className="border-b border-border/60 bg-gradient-to-r from-rose-500/5 to-transparent px-6 py-5 flex items-center gap-3">
                  <ShieldAlert className="h-5 w-5 text-rose-500" />
                  <h2 className="text-[18px] font-bold tracking-tight text-foreground">Risk List (Auto)</h2>
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/20">
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="h-12 px-6 text-[12px] font-bold uppercase tracking-wider text-muted-foreground">Org</TableHead>
                        <TableHead className="h-12 px-6 text-[12px] font-bold uppercase tracking-wider text-muted-foreground">Risk</TableHead>
                        <TableHead className="h-12 px-6 text-[12px] font-bold uppercase tracking-wider text-muted-foreground">Status</TableHead>
                        <TableHead className="h-12 px-6 text-[12px] font-bold uppercase tracking-wider text-muted-foreground">Due</TableHead>
                        <TableHead className="h-12 px-6 text-[12px] font-bold uppercase tracking-wider text-muted-foreground text-center">WA / Members</TableHead>
                        <TableHead className="h-12 px-6 text-[12px] font-bold uppercase tracking-wider text-muted-foreground">Reason</TableHead>
                        <TableHead className="h-12 px-6 text-[12px] font-bold uppercase tracking-wider text-muted-foreground text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(overview?.riskOrgs ?? []).map((risk) => (
                        <TableRow key={risk.orgId} className="border-t border-border/50 hover:bg-muted/10 transition-colors">
                          <TableCell className="px-6 py-4 font-bold text-foreground text-[14px]">{risk.orgName}</TableCell>
                          <TableCell className="px-6 py-4">
                            <span className={risk.riskLevel === "high" ? "rounded-full border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-[11px] font-black uppercase text-rose-600 dark:text-rose-400" : risk.riskLevel === "medium" ? "rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-black uppercase text-amber-600 dark:text-amber-400" : "rounded-full border border-slate-500/30 bg-slate-500/10 px-2.5 py-1 text-[11px] font-black uppercase text-slate-600 dark:text-slate-400"}>
                              {risk.riskLevel}
                            </span>
                          </TableCell>
                          <TableCell className="px-6 py-4 text-[13px] font-medium text-foreground/80">{risk.status}</TableCell>
                          <TableCell className="px-6 py-4 text-[13px] font-medium text-muted-foreground">{formatDateTime(risk.dueAt)}</TableCell>
                          <TableCell className="px-6 py-4 text-center">
                            <div className="flex items-center justify-center gap-2 text-[13px] font-bold text-foreground">
                              {risk.waAccounts} <span className="text-muted-foreground/50 font-normal">/</span> {risk.members}
                            </div>
                          </TableCell>
                          <TableCell className="px-6 py-4 text-[13px] font-medium text-muted-foreground">{risk.reason}</TableCell>
                          <TableCell className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button size="sm" variant="outline" className="h-8 rounded-lg text-[12px] font-bold hover:bg-emerald-500/10 hover:text-emerald-600 border-border/60" disabled={Boolean(busyKey)} onClick={() => void applySubscriptionAction(risk.orgId, "MARK_ACTIVE")}>Mark Active</Button>
                              <Button size="sm" variant="outline" className="h-8 rounded-lg text-[12px] font-bold hover:bg-sky-500/10 hover:text-sky-600 border-border/60" disabled={Boolean(busyKey)} onClick={() => void applySubscriptionAction(risk.orgId, "EXTEND_TRIAL", 3)}>Extend 3d</Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {(overview?.riskOrgs ?? []).length === 0 ? <TableRow><TableCell colSpan={7} className="px-6 py-12 text-center text-[14px] font-medium text-muted-foreground flex flex-col items-center justify-center gap-2"><ShieldCheck className="h-6 w-6 text-emerald-500/50" />Tidak ada organisasi berisiko saat ini.</TableCell></TableRow> : null}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="subscriptions" className="m-0 space-y-6">
              <div className="rounded-[28px] border border-border/70 bg-card shadow-sm overflow-hidden">
                <div className="border-b border-border/60 bg-gradient-to-r from-emerald-500/5 to-transparent px-6 py-5">
                  <h2 className="text-[18px] font-bold tracking-tight text-foreground">Subscriptions</h2>
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/20">
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="h-12 px-6 text-[12px] font-bold uppercase tracking-wider text-muted-foreground">Org</TableHead>
                        <TableHead className="h-12 px-6 text-[12px] font-bold uppercase tracking-wider text-muted-foreground">Status / Period Ends</TableHead>
                        <TableHead className="h-12 px-6 text-[12px] font-bold uppercase tracking-wider text-muted-foreground text-center">WA Connected</TableHead>
                        <TableHead className="h-12 px-6 text-[12px] font-bold uppercase tracking-wider text-muted-foreground">Latest Charge</TableHead>
                        <TableHead className="h-12 px-6 text-[12px] font-bold uppercase tracking-wider text-muted-foreground text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {subscriptions.map((item) => (
                        <TableRow key={item.id} className="border-t border-border/50 hover:bg-muted/10 transition-colors">
                          <TableCell className="px-6 py-4">
                            <p className="font-bold text-foreground text-[14px]">{item.org.name}</p>
                            <p className="text-[12px] font-medium text-muted-foreground">{item.org._count.members} Members</p>
                          </TableCell>
                          <TableCell className="px-6 py-4">
                            <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider mb-1 ${item.status === "ACTIVE" ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : item.status === "TRIALING" ? "bg-sky-500/10 text-sky-600 border-sky-500/20" : item.status === "PAST_DUE" ? "bg-amber-500/10 text-amber-600 border-amber-500/20" : "bg-rose-500/10 text-rose-600 border-rose-500/20"}`}>{item.status}</span>
                            <p className="text-[12px] font-medium text-muted-foreground mt-0.5">{item.status === 'TRIALING' ? `Ends ${formatDate(item.trialEndAt)}` : formatDate(item.currentPeriodEndAt)}</p>
                          </TableCell>
                          <TableCell className="px-6 py-4 text-center">
                            {item.org._count.waAccounts > 0 ? (
                               <span className="inline-flex rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 p-1.5" title="WhatsApp Connected"><Activity className="h-4 w-4" /></span>
                            ) : (
                               <span className="inline-flex rounded-full bg-muted/40 text-muted-foreground p-1.5" title="WhatsApp Not Connected"><AlertCircle className="h-4 w-4" /></span>
                            )}
                          </TableCell>
                          <TableCell className="px-6 py-4 text-[13px] font-medium">
                            {item.org.billingCharges[0] ? (
                               <div className="flex flex-col gap-0.5">
                                  <span className="font-semibold text-foreground">{formatCurrency(item.org.billingCharges[0].totalAmountCents)}</span>
                                  <span className="text-muted-foreground">{item.org.billingCharges[0].status}</span>
                               </div>
                            ) : <span className="text-muted-foreground">-</span>}
                          </TableCell>
                          <TableCell className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button size="sm" variant="outline" className="h-8 rounded-lg text-[12px] font-bold hover:bg-emerald-500/10 hover:text-emerald-600 border-border/60" disabled={Boolean(busyKey)} onClick={() => void applySubscriptionAction(item.orgId, "MARK_ACTIVE")}>Active</Button>
                              <Button size="sm" variant="outline" className="h-8 rounded-lg text-[12px] font-bold hover:bg-amber-500/10 hover:text-amber-600 border-border/60" disabled={Boolean(busyKey)} onClick={() => void applySubscriptionAction(item.orgId, "MARK_PAST_DUE")}>Past Due</Button>
                              <Button size="sm" variant="outline" className="h-8 rounded-lg text-[12px] font-bold hover:bg-rose-500/10 hover:text-rose-600 border-border/60 text-rose-600 dark:text-rose-400" disabled={Boolean(busyKey)} onClick={() => void applySubscriptionAction(item.orgId, "CANCEL")}>Cancel</Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {subscriptions.length === 0 ? <TableRow><TableCell colSpan={5} className="px-6 py-12 text-center text-[14px] font-medium text-muted-foreground">Belum ada organisasi terdaftar.</TableCell></TableRow> : null}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="transactions" className="m-0 space-y-6">
              <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-[24px] border border-border/70 bg-card p-6 shadow-sm overflow-hidden relative">
                  <ReceiptText className="absolute -right-4 -bottom-4 h-24 w-24 text-emerald-500/5 rotate-12" />
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground/80 relative z-10">Billing Charges</p>
                  <p className="mt-3 text-3xl font-black tracking-tight text-foreground relative z-10">{billingCharges.length}</p>
                  <p className="mt-2 text-[13px] font-medium text-muted-foreground relative z-10">Transaksi langganan organisasi</p>
                </div>
                <div className="rounded-[24px] border border-border/70 bg-card p-6 shadow-sm overflow-hidden relative">
                  <CreditCard className="absolute -right-4 -bottom-4 h-24 w-24 text-sky-500/5 rotate-12" />
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground/80 relative z-10">Invoice Payments</p>
                  <p className="mt-3 text-3xl font-black tracking-tight text-foreground relative z-10">{invoiceAttempts.length}</p>
                  <p className="mt-2 text-[13px] font-medium text-muted-foreground relative z-10">Attempt pembayaran invoice customer</p>
                </div>
                <div className="rounded-[24px] border border-border/70 bg-card p-6 shadow-sm overflow-hidden relative">
                  <WalletCards className="absolute -right-4 -bottom-4 h-24 w-24 text-indigo-500/5 rotate-12" />
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground/80 relative z-10">Wallet Topups</p>
                  <p className="mt-3 text-3xl font-black tracking-tight text-foreground relative z-10">{walletTopups.length}</p>
                  <p className="mt-2 text-[13px] font-medium text-muted-foreground relative z-10">Topup saldo wallet organisasi</p>
                </div>
                <div className="rounded-[24px] border border-border/70 bg-card p-6 shadow-sm overflow-hidden relative">
                  <HandCoins className="absolute -right-4 -bottom-4 h-24 w-24 text-amber-500/5 rotate-12" />
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground/80 relative z-10">Withdraw Requests</p>
                  <p className="mt-3 text-3xl font-black tracking-tight text-foreground relative z-10">{walletWithdrawRequests.length}</p>
                  <p className="mt-2 text-[13px] font-medium text-muted-foreground relative z-10">Request penarikan saldo wallet</p>
                </div>
              </section>

              <div className="rounded-[28px] border border-border/70 bg-card shadow-sm overflow-hidden">
                <div className="border-b border-border/60 bg-gradient-to-r from-emerald-500/5 to-transparent px-6 py-5">
                  <h2 className="text-[18px] font-bold tracking-tight text-foreground">Billing Charges (Subscription)</h2>
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/20">
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="h-12 px-6 text-[12px] font-bold uppercase tracking-wider text-muted-foreground">Order / Org</TableHead>
                        <TableHead className="h-12 px-6 text-[12px] font-bold uppercase tracking-wider text-muted-foreground">Amount</TableHead>
                        <TableHead className="h-12 px-6 text-[12px] font-bold uppercase tracking-wider text-muted-foreground">Status</TableHead>
                        <TableHead className="h-12 px-6 text-[12px] font-bold uppercase tracking-wider text-muted-foreground">Timeline</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {billingCharges.slice(0, 120).map((item) => (
                        <TableRow key={item.id} className="border-t border-border/50 hover:bg-muted/10 transition-colors">
                          <TableCell className="px-6 py-4">
                            <p className="font-bold text-foreground text-[13px]">{item.orderId}</p>
                            <p className="text-[12px] font-medium text-muted-foreground mt-0.5">{item.org.name}</p>
                          </TableCell>
                          <TableCell className="px-6 py-4 text-[13px] font-medium">
                            <p className="font-semibold text-foreground">{formatCurrency(item.totalAmountCents)}</p>
                            <p className="text-muted-foreground">Base {formatCurrency(item.baseAmountCents)} • Fee {formatCurrency(item.gatewayFeeCents)}</p>
                          </TableCell>
                          <TableCell className="px-6 py-4">
                            <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${item.status === "PAID" ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : item.status === "PENDING" ? "bg-amber-500/10 text-amber-600 border-amber-500/20" : "bg-rose-500/10 text-rose-600 border-rose-500/20"}`}>{item.status}</span>
                          </TableCell>
                          <TableCell className="px-6 py-4 text-[12px] font-medium text-muted-foreground">
                            <p>Created: {formatDateTime(item.createdAt)}</p>
                            <p>Paid: {formatDateTime(item.paidAt)}</p>
                            <p>Expired: {formatDateTime(item.expiredAt)}</p>
                          </TableCell>
                        </TableRow>
                      ))}
                      {billingCharges.length === 0 ? <TableRow><TableCell colSpan={4} className="px-6 py-12 text-center text-[14px] font-medium text-muted-foreground">Belum ada billing charge.</TableCell></TableRow> : null}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div className="rounded-[28px] border border-border/70 bg-card shadow-sm overflow-hidden">
                <div className="border-b border-border/60 bg-gradient-to-r from-sky-500/5 to-transparent px-6 py-5">
                  <h2 className="text-[18px] font-bold tracking-tight text-foreground">Invoice Payment Attempts</h2>
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/20">
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="h-12 px-6 text-[12px] font-bold uppercase tracking-wider text-muted-foreground">Invoice / Customer</TableHead>
                        <TableHead className="h-12 px-6 text-[12px] font-bold uppercase tracking-wider text-muted-foreground">Order</TableHead>
                        <TableHead className="h-12 px-6 text-[12px] font-bold uppercase tracking-wider text-muted-foreground">Amount</TableHead>
                        <TableHead className="h-12 px-6 text-[12px] font-bold uppercase tracking-wider text-muted-foreground">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invoiceAttempts.slice(0, 120).map((item) => (
                        <TableRow key={item.id} className="border-t border-border/50 hover:bg-muted/10 transition-colors">
                          <TableCell className="px-6 py-4">
                            <p className="font-bold text-foreground text-[13px]">{item.invoice.invoiceNo}</p>
                            <p className="text-[12px] font-medium text-muted-foreground mt-0.5">{item.invoice.customer.displayName || item.invoice.customer.phoneE164}</p>
                            <p className="text-[12px] font-medium text-muted-foreground">{item.org.name}</p>
                          </TableCell>
                          <TableCell className="px-6 py-4 text-[13px] font-medium">
                            <p className="font-semibold text-foreground">{item.orderId}</p>
                            <p className="text-muted-foreground">{item.provider} • {item.paymentMethod}</p>
                          </TableCell>
                          <TableCell className="px-6 py-4 text-[13px] font-medium">
                            <p className="font-semibold text-foreground">{formatCurrency(item.customerPayableCents)}</p>
                            <p className="text-muted-foreground">Invoice {formatCurrency(item.invoiceAmountCents)} • Fee {formatCurrency(item.feeCents)}</p>
                          </TableCell>
                          <TableCell className="px-6 py-4 text-[12px] font-medium text-muted-foreground">
                            <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${item.status === "PAID" ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : item.status === "PENDING" ? "bg-amber-500/10 text-amber-600 border-amber-500/20" : "bg-rose-500/10 text-rose-600 border-rose-500/20"}`}>{item.status}</span>
                            <p className="mt-1">Created: {formatDateTime(item.createdAt)}</p>
                            <p>Paid: {formatDateTime(item.paidAt)}</p>
                          </TableCell>
                        </TableRow>
                      ))}
                      {invoiceAttempts.length === 0 ? <TableRow><TableCell colSpan={4} className="px-6 py-12 text-center text-[14px] font-medium text-muted-foreground">Belum ada invoice payment attempt.</TableCell></TableRow> : null}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <section className="grid gap-6 xl:grid-cols-2">
                <div className="rounded-[28px] border border-border/70 bg-card shadow-sm overflow-hidden">
                  <div className="border-b border-border/60 bg-gradient-to-r from-indigo-500/5 to-transparent px-6 py-5">
                    <h2 className="text-[18px] font-bold tracking-tight text-foreground">Wallet Topups</h2>
                  </div>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-muted/20">
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="h-12 px-6 text-[12px] font-bold uppercase tracking-wider text-muted-foreground">Order / Org</TableHead>
                          <TableHead className="h-12 px-6 text-[12px] font-bold uppercase tracking-wider text-muted-foreground">Amount</TableHead>
                          <TableHead className="h-12 px-6 text-[12px] font-bold uppercase tracking-wider text-muted-foreground">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {walletTopups.slice(0, 80).map((item) => (
                          <TableRow key={item.id} className="border-t border-border/50 hover:bg-muted/10 transition-colors">
                            <TableCell className="px-6 py-4">
                              <p className="font-bold text-foreground text-[13px]">{item.orderId}</p>
                              <p className="text-[12px] font-medium text-muted-foreground mt-0.5">{item.org.name}</p>
                            </TableCell>
                            <TableCell className="px-6 py-4 text-[13px] font-medium">
                              <p className="font-semibold text-foreground">{formatCurrency(item.customerPayableCents)}</p>
                              <p className="text-muted-foreground">Net {formatCurrency(item.amountCents)} • Fee {formatCurrency(item.feeCents)}</p>
                            </TableCell>
                            <TableCell className="px-6 py-4 text-[12px] font-medium text-muted-foreground">
                              <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${item.status === "PAID" ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : item.status === "PENDING" ? "bg-amber-500/10 text-amber-600 border-amber-500/20" : "bg-rose-500/10 text-rose-600 border-rose-500/20"}`}>{item.status}</span>
                              <p className="mt-1">Created: {formatDateTime(item.createdAt)}</p>
                              <p>Paid: {formatDateTime(item.paidAt)}</p>
                            </TableCell>
                          </TableRow>
                        ))}
                        {walletTopups.length === 0 ? <TableRow><TableCell colSpan={3} className="px-6 py-12 text-center text-[14px] font-medium text-muted-foreground">Belum ada topup wallet.</TableCell></TableRow> : null}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                <div className="rounded-[28px] border border-border/70 bg-card shadow-sm overflow-hidden">
                  <div className="border-b border-border/60 bg-gradient-to-r from-amber-500/5 to-transparent px-6 py-5">
                    <h2 className="text-[18px] font-bold tracking-tight text-foreground">Wallet Withdraw Requests</h2>
                  </div>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-muted/20">
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="h-12 px-6 text-[12px] font-bold uppercase tracking-wider text-muted-foreground">Org / Bank</TableHead>
                          <TableHead className="h-12 px-6 text-[12px] font-bold uppercase tracking-wider text-muted-foreground">Amount</TableHead>
                          <TableHead className="h-12 px-6 text-[12px] font-bold uppercase tracking-wider text-muted-foreground">Status</TableHead>
                          <TableHead className="h-12 px-6 text-[12px] font-bold uppercase tracking-wider text-muted-foreground text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {walletWithdrawRequests.slice(0, 80).map((item) => (
                          <TableRow key={item.id} className="border-t border-border/50 hover:bg-muted/10 transition-colors">
                            <TableCell className="px-6 py-4">
                              <p className="font-bold text-foreground text-[13px]">{item.org.name}</p>
                              <p className="text-[12px] font-medium text-muted-foreground mt-0.5">{item.bankName} • {item.accountNumber}</p>
                              <p className="text-[12px] font-medium text-muted-foreground">{item.accountHolder}</p>
                            </TableCell>
                            <TableCell className="px-6 py-4 text-[13px] font-semibold text-foreground">
                              {formatCurrency(item.amountCents)}
                            </TableCell>
                            <TableCell className="px-6 py-4 text-[12px] font-medium text-muted-foreground">
                              <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${item.status === "PAID" ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : item.status === "APPROVED" ? "bg-sky-500/10 text-sky-600 border-sky-500/20" : item.status === "PENDING" ? "bg-amber-500/10 text-amber-600 border-amber-500/20" : "bg-rose-500/10 text-rose-600 border-rose-500/20"}`}>{item.status}</span>
                              <p className="mt-1">Requested: {formatDateTime(item.createdAt)}</p>
                              <p>Processed: {formatDateTime(item.processedAt)}</p>
                            </TableCell>
                            <TableCell className="px-6 py-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Button size="sm" variant="outline" className="h-8 rounded-lg text-[12px] font-bold hover:bg-sky-500/10 hover:text-sky-600 border-border/60" disabled={Boolean(busyKey) || item.status !== "PENDING"} onClick={() => void processWithdrawRequest(item.id, "APPROVE")}>Approve</Button>
                                <Button size="sm" variant="outline" className="h-8 rounded-lg text-[12px] font-bold hover:bg-emerald-500/10 hover:text-emerald-600 border-border/60" disabled={Boolean(busyKey) || item.status !== "APPROVED"} onClick={() => void processWithdrawRequest(item.id, "PAID")}>Mark Paid</Button>
                                <Button size="sm" variant="outline" className="h-8 rounded-lg text-[12px] font-bold hover:bg-rose-500/10 hover:text-rose-600 border-border/60 text-rose-600 dark:text-rose-400" disabled={Boolean(busyKey) || (item.status !== "PENDING" && item.status !== "APPROVED")} onClick={() => void processWithdrawRequest(item.id, "REJECT")}>Reject</Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                        {walletWithdrawRequests.length === 0 ? <TableRow><TableCell colSpan={4} className="px-6 py-12 text-center text-[14px] font-medium text-muted-foreground">Belum ada request withdraw.</TableCell></TableRow> : null}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </section>
            </TabsContent>

            <TabsContent value="whatsapp" className="m-0 space-y-6">
              <div className="rounded-[28px] border border-border/70 bg-card shadow-sm overflow-hidden flex flex-col items-center justify-center py-16 text-center">
                 <Globe className="h-16 w-16 text-muted-foreground/20 mb-4" />
                 <h2 className="text-[18px] font-bold tracking-tight text-foreground">WhatsApp Connectivity Insights</h2>
                 <p className="mt-2 text-[14px] font-medium text-muted-foreground max-w-sm">Informasi spesifik WhatsApp telah dipindahkan atau bisa dilihat pada tab Subscriptions.</p>
              </div>
            </TabsContent>

            <TabsContent value="users" className="m-0 space-y-6">
              <div className="rounded-[28px] border border-border/70 bg-card shadow-sm overflow-hidden">
                <div className="border-b border-border/60 bg-gradient-to-r from-muted/30 to-transparent px-6 py-5">
                  <h2 className="text-[18px] font-bold tracking-tight text-foreground">Platform Users</h2>
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/20">
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="h-12 px-6 text-[12px] font-bold uppercase tracking-wider text-muted-foreground">User / Details</TableHead>
                        <TableHead className="h-12 px-6 text-[12px] font-bold uppercase tracking-wider text-muted-foreground">Contact</TableHead>
                        <TableHead className="h-12 px-6 text-[12px] font-bold uppercase tracking-wider text-muted-foreground">Platform Role</TableHead>
                        <TableHead className="h-12 px-6 text-[12px] font-bold uppercase tracking-wider text-muted-foreground text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((user) => {
                        const enabled = Boolean(user.platformMembership);
                        return (
                          <TableRow key={user.id} className="border-t border-border/50 hover:bg-muted/10 transition-colors">
                            <TableCell className="px-6 py-4">
                               <p className="font-bold text-foreground text-[14px]">{user.name ?? "Unnamed User"}</p>
                            </TableCell>
                            <TableCell className="px-6 py-4">
                               <p className="text-[13px] font-medium text-foreground">{user.email}</p>
                               {user.phoneE164 && <p className="text-[12px] text-muted-foreground mt-0.5">{user.phoneE164}</p>}
                            </TableCell>
                            <TableCell className="px-6 py-4">
                               {enabled ? <span className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 px-2.5 py-1 rounded-full text-[11px] font-black uppercase tracking-wider shadow-sm">{user.platformMembership?.role}</span> : <span className="text-muted-foreground/60 text-[13px] font-medium">-</span>}
                            </TableCell>
                            <TableCell className="px-6 py-4 text-right">
                               <Button size="sm" variant={enabled ? "destructive" : "outline"} className={`h-8 rounded-lg text-[12px] font-bold ${enabled ? "" : "border-border/60 hover:bg-blue-500/10 hover:text-blue-600"}`} disabled={Boolean(busyKey)} onClick={() => void toggleSuperadmin(user.id, !enabled)}>{enabled ? "Revoke SA" : "Grant SA"}</Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="audit" className="m-0 space-y-6">
              <div className="rounded-[28px] border border-border/70 bg-card shadow-sm overflow-hidden">
                <div className="border-b border-border/60 bg-gradient-to-r from-muted/30 to-transparent px-6 py-6 space-y-5">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h2 className="text-[18px] font-bold tracking-tight text-foreground">Platform Audit Trail</h2>
                      <p className="mt-1 text-[13px] font-medium text-muted-foreground">Last update: {formatDateTime(overview?.generatedAt ?? null)}</p>
                    </div>
                    <Button variant="outline" size="sm" className="h-9 rounded-xl border-border/60 font-semibold" onClick={exportAuditCsv}>Export CSV</Button>
                  </div>
                  
                  <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-5 p-4 rounded-2xl bg-background/50 border border-border/50">
                    <input className="h-10 w-full rounded-xl border border-border/80 bg-background px-4 text-[13px] shadow-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all" placeholder="Search query..." value={auditQuery} onChange={(event) => setAuditQuery(event.target.value)} />
                    <select className="h-10 w-full rounded-xl border border-border/80 bg-background px-4 text-[13px] shadow-sm appearance-none focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all" value={auditAction} onChange={(event) => setAuditAction(event.target.value)}>
                      {auditActions.map((action) => (<option key={action} value={action}>{action === "all" ? "All actions" : action}</option>))}
                    </select>
                    <select className="h-10 w-full rounded-xl border border-border/80 bg-background px-4 text-[13px] shadow-sm appearance-none focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all" value={auditTargetType} onChange={(event) => setAuditTargetType(event.target.value)}>
                      {auditTargetTypes.map((target) => (<option key={target} value={target}>{target === "all" ? "All target types" : target}</option>))}
                    </select>
                    <input type="date" className="h-10 w-full rounded-xl border border-border/80 bg-background px-4 text-[13px] shadow-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-muted-foreground uppercase tracking-wide" value={auditDateFrom} onChange={(event) => setAuditDateFrom(event.target.value)} />
                    <input type="date" className="h-10 w-full rounded-xl border border-border/80 bg-background px-4 text-[13px] shadow-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-muted-foreground uppercase tracking-wide" value={auditDateTo} onChange={(event) => setAuditDateTo(event.target.value)} />
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <Button size="sm" variant="outline" className={`h-8 rounded-lg text-[12px] font-bold ${auditTargetType === 'all' && auditAction === 'all' && auditQuery === '' ? 'bg-primary/10 text-primary border-primary/20' : 'bg-transparent border-transparent hover:bg-muted text-muted-foreground hover:text-foreground'}`} onClick={() => applyAuditPreset("all")}>Clear Filters</Button>
                    <div className="w-px h-4 bg-border/80 mx-1"></div>
                    <Button size="sm" variant="outline" className="h-8 rounded-lg text-[12px] font-bold border-border/60 hover:bg-muted" onClick={() => applyAuditPreset("billing")}>Billing</Button>
                    <Button size="sm" variant="outline" className="h-8 rounded-lg text-[12px] font-bold border-border/60 hover:bg-muted" onClick={() => applyAuditPreset("webhook")}>Webhook</Button>
                    <Button size="sm" variant="outline" className="h-8 rounded-lg text-[12px] font-bold border-rose-500/20 text-rose-600 hover:bg-rose-500/10 hover:text-rose-700" onClick={() => applyAuditPreset("errors")}>Errors Only</Button>
                  </div>
                </div>
                
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/10 border-b border-border/40">
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="h-12 px-6 text-[12px] font-bold uppercase tracking-wider text-muted-foreground">Time</TableHead>
                        <TableHead className="h-12 px-6 text-[12px] font-bold uppercase tracking-wider text-muted-foreground">Severity</TableHead>
                        <TableHead className="h-12 px-6 text-[12px] font-bold uppercase tracking-wider text-muted-foreground">Actor</TableHead>
                        <TableHead className="h-12 px-6 text-[12px] font-bold uppercase tracking-wider text-muted-foreground">Action</TableHead>
                        <TableHead className="h-12 px-6 text-[12px] font-bold uppercase tracking-wider text-muted-foreground">Target</TableHead>
                        <TableHead className="h-12 px-6 text-[12px] font-bold uppercase tracking-wider text-muted-foreground">Meta</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAuditLogs.map((log) => {
                        const severity = classifySeverity(log.action);
                        const severityClass = severity === "critical" ? "rounded-full border border-rose-500/20 bg-rose-500/10 px-2.5 py-1 text-[11px] font-black uppercase tracking-wider text-rose-600 dark:text-rose-400" : severity === "warning" ? "rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-[11px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400" : "rounded-full border border-sky-500/20 bg-sky-500/10 px-2.5 py-1 text-[11px] font-black uppercase tracking-wider text-sky-600 dark:text-sky-400";
                        return (
                          <TableRow key={log.id} className={`border-t border-border/40 transition-colors ${highlightedAuditIds.includes(log.id) ? "bg-rose-500/5 hover:bg-rose-500/10" : "hover:bg-muted/10"}`}>
                            <TableCell className="px-6 py-4 whitespace-nowrap text-[13px] font-medium text-muted-foreground">{formatDateTime(log.createdAt)}</TableCell>
                            <TableCell className="px-6 py-4"><span className={severityClass}>{severity}</span></TableCell>
                            <TableCell className="px-6 py-4 text-[13px] font-bold text-foreground/80">{log.actor?.email ?? log.actorUserId}</TableCell>
                            <TableCell className="px-6 py-4 text-[13px] font-medium text-foreground"><span className="bg-muted/50 border border-border/50 px-2.5 py-1 rounded-md">{log.action}</span></TableCell>
                            <TableCell className="px-6 py-4 text-[13px] font-mono text-muted-foreground/90">{`${log.targetType}:${log.targetId}`}</TableCell>
                            <TableCell className="px-6 py-4 font-mono text-[11px] text-muted-foreground/80 max-w-sm truncate" title={log.meta ? JSON.stringify(log.meta) : ""}>{log.meta ? JSON.stringify(log.meta) : "{}"}</TableCell>
                          </TableRow>
                        );
                      })}
                      {filteredAuditLogs.length === 0 ? <TableRow><TableCell colSpan={6} className="px-6 py-16 text-center flex flex-col items-center justify-center gap-2"><ShieldCheck className="h-6 w-6 text-muted-foreground/30" /><span className="text-[14px] font-medium text-muted-foreground">Belum ada audit log pada pencarian / filter saat ini.</span></TableCell></TableRow> : null}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
