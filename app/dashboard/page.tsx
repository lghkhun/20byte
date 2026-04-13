import Link from "next/link";
import { cookies } from "next/headers";
import { InvoiceStatus, Prisma } from "@prisma/client";
import {
  ArrowDownRight,
  ArrowUpRight,
  Building2,
  CircleDollarSign,
  Info,
  MousePointerClick,
  Receipt,
  UsersRound
} from "lucide-react";

import { DashboardDateRangePicker } from "@/components/dashboard/dashboard-date-range-picker";
import { DashboardMessageChart } from "@/components/dashboard/dashboard-message-chart";
import { Badge } from "@/components/ui/badge";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { cn } from "@/lib/utils";
import { getPrimaryOrganizationForUser } from "@/server/services/organizationService";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function parseDateParam(value: string | undefined, fallback: Date): Date {
  if (!value) {
    return fallback;
  }

  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

function startOfDay(value: Date): Date {
  const next = new Date(value);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(value: Date): Date {
  const next = new Date(value);
  next.setHours(23, 59, 59, 999);
  return next;
}

function formatDateParam(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function formatCompactDate(value: Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short"
  }).format(value);
}

function formatMoney(cents: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
  }).format(cents / 100);
}

function formatInteger(value: number): string {
  return new Intl.NumberFormat("id-ID").format(value);
}

function calculateDelta(current: number, previous: number) {
  const diff = current - previous;
  const percent = previous > 0 ? (diff / previous) * 100 : current > 0 ? 100 : 0;
  return { diff, percent };
}

function formatDelta(delta: ReturnType<typeof calculateDelta>) {
  return {
    direction: delta.diff > 0 ? "up" : delta.diff < 0 ? "down" : "flat",
    label: `${delta.diff > 0 ? "+" : ""}${Math.round(delta.percent)}%`
  } as const;
}

export default async function DashboardPage({
  searchParams
}: {
  searchParams?: Promise<{ from?: string; to?: string }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? verifySessionToken(token) : null;
  if (!session) {
    return null;
  }

  const business = await getPrimaryOrganizationForUser(session.userId);
  if (!business) {
    return <section className="p-6 text-sm text-muted-foreground">No business found.</section>;
  }

  const today = startOfDay(new Date());
  const defaultFrom = new Date(today.getTime() - 29 * MS_PER_DAY);
  let rangeFrom = startOfDay(parseDateParam(resolvedSearchParams?.from, defaultFrom));
  const rangeTo = endOfDay(parseDateParam(resolvedSearchParams?.to, today));

  if (rangeFrom.getTime() > rangeTo.getTime()) {
    rangeFrom = startOfDay(rangeTo);
  }

  const rangeDayCount = Math.max(1, Math.floor((rangeTo.getTime() - rangeFrom.getTime()) / MS_PER_DAY) + 1);
  const previousRangeTo = endOfDay(new Date(rangeFrom.getTime() - MS_PER_DAY));
  const previousRangeFrom = startOfDay(new Date(previousRangeTo.getTime() - (rangeDayCount - 1) * MS_PER_DAY));
  const chartDays = Array.from({ length: rangeDayCount }, (_, index) => {
    const date = new Date(rangeFrom);
    date.setDate(rangeFrom.getDate() + index);
    return date;
  });

  const [
    totalContacts,
    newContactsInRange,
    shortlinkClicksInRange,
    paidCashInRange,
    paidInvoicesInRange,
    previousNewContacts,
    previousShortlinkClicks,
    previousPaidCashInRange,
    previousPaidInvoices,
    invoiceCountsByStatus,
    previousInvoiceCountsByStatus,
    messageSeries
  ] = await Promise.all([
    prisma.customer.count({ where: { orgId: business.id } }),
    prisma.customer.count({ where: { orgId: business.id, createdAt: { gte: rangeFrom, lte: rangeTo } } }),
    prisma.shortlinkClick.count({ where: { orgId: business.id, clickedAt: { gte: rangeFrom, lte: rangeTo } } }),
    prisma.paymentMilestone.aggregate({
      where: { orgId: business.id, status: "PAID", paidAt: { gte: rangeFrom, lte: rangeTo } },
      _sum: { amountCents: true }
    }),
    prisma.invoice.count({
      where: { orgId: business.id, status: InvoiceStatus.PAID, createdAt: { gte: rangeFrom, lte: rangeTo } }
    }),
    prisma.customer.count({ where: { orgId: business.id, createdAt: { gte: previousRangeFrom, lte: previousRangeTo } } }),
    prisma.shortlinkClick.count({ where: { orgId: business.id, clickedAt: { gte: previousRangeFrom, lte: previousRangeTo } } }),
    prisma.paymentMilestone.aggregate({
      where: { orgId: business.id, status: "PAID", paidAt: { gte: previousRangeFrom, lte: previousRangeTo } },
      _sum: { amountCents: true }
    }),
    prisma.invoice.count({
      where: { orgId: business.id, status: InvoiceStatus.PAID, createdAt: { gte: previousRangeFrom, lte: previousRangeTo } }
    }),
    prisma.invoice.groupBy({
      by: ["status"],
      where: { orgId: business.id, createdAt: { gte: rangeFrom, lte: rangeTo } },
      _count: { _all: true },
      _sum: { totalCents: true }
    }),
    prisma.invoice.groupBy({
      by: ["status"],
      where: { orgId: business.id, createdAt: { gte: previousRangeFrom, lte: previousRangeTo } },
      _count: { _all: true },
      _sum: { totalCents: true }
    }),
    prisma.$queryRaw<Array<{ day: Date; inbound: bigint | number; outbound: bigint | number }>>(Prisma.sql`
      SELECT
        DATE(createdAt) AS day,
        SUM(CASE WHEN direction = 'INBOUND' THEN 1 ELSE 0 END) AS inbound,
        SUM(CASE WHEN direction = 'OUTBOUND' THEN 1 ELSE 0 END) AS outbound
      FROM Message
      WHERE orgId = ${business.id}
        AND createdAt >= ${rangeFrom}
        AND createdAt <= ${rangeTo}
      GROUP BY DATE(createdAt)
      ORDER BY day ASC
    `)
  ]);

  const paidCashCents = paidCashInRange._sum.amountCents ?? 0;
  const previousPaidCashCents = previousPaidCashInRange._sum.amountCents ?? 0;
  const messageMap = new Map(
    messageSeries.map((item) => [
      new Date(item.day).toISOString().slice(0, 10),
      { inbound: Number(item.inbound), outbound: Number(item.outbound) }
    ])
  );
  const dailySeries = chartDays.map((day) => {
    const key = day.toISOString().slice(0, 10);
    const bucket = messageMap.get(key);
    return {
      label: formatCompactDate(day),
      inbound: bucket?.inbound ?? 0,
      outbound: bucket?.outbound ?? 0
    };
  });

  const invoiceStatusMap = new Map<InvoiceStatus, { count: number; totalCents: number }>();
  for (const row of invoiceCountsByStatus) {
    invoiceStatusMap.set(row.status, {
      count: row._count._all,
      totalCents: row._sum.totalCents ?? 0
    });
  }
  const previousInvoiceStatusMap = new Map<InvoiceStatus, { count: number; totalCents: number }>();
  for (const row of previousInvoiceCountsByStatus) {
    previousInvoiceStatusMap.set(row.status, {
      count: row._count._all,
      totalCents: row._sum.totalCents ?? 0
    });
  }

  const invoiceSummary = [
    { key: InvoiceStatus.DRAFT, label: "Draft", tone: "text-slate-600 bg-slate-100 border-slate-200" },
    { key: InvoiceStatus.SENT, label: "Sent", tone: "text-sky-600 bg-sky-100 border-sky-200" },
    { key: InvoiceStatus.PARTIALLY_PAID, label: "Partial", tone: "text-amber-600 bg-amber-100 border-amber-200" },
    { key: InvoiceStatus.PAID, label: "Paid", tone: "text-emerald-600 bg-emerald-100 border-emerald-200" },
    { key: InvoiceStatus.VOID, label: "Void", tone: "text-rose-600 bg-rose-100 border-rose-200" }
  ].map((status) => {
    const data = invoiceStatusMap.get(status.key) ?? { count: 0, totalCents: 0 };
    const previous = previousInvoiceStatusMap.get(status.key) ?? { count: 0, totalCents: 0 };
    return { ...status, ...data, delta: formatDelta(calculateDelta(data.count, previous.count)) };
  });

  const totalInvoicesInRange = invoiceSummary.reduce((sum, item) => sum + item.count, 0);
  const invoiceSummaryPreview = invoiceSummary.slice(0, 3);

  const metrics = [
    {
      label: "Cash Collected",
      value: formatMoney(paidCashCents),
      hint: `${formatInteger(paidInvoicesInRange)} invoice paid di rentang ini`,
      delta: formatDelta(calculateDelta(paidCashCents, previousPaidCashCents)),
      detail: `Kas masuk dihitung dari milestone pembayaran berstatus PAID dengan paidAt di dalam rentang aktif.`,
      icon: CircleDollarSign,
      accent: "from-emerald-500/20 to-emerald-500/5",
      iconClass: "text-emerald-600"
    },
    {
      label: "New Contacts",
      value: formatInteger(newContactsInRange),
      hint: `${formatInteger(totalContacts)} total kontak aktif`,
      delta: formatDelta(calculateDelta(newContactsInRange, previousNewContacts)),
      detail: `Kontak baru dihitung dari customer yang dibuat pada rentang aktif.`,
      icon: UsersRound,
      accent: "from-violet-500/20 to-violet-500/5",
      iconClass: "text-violet-600"
    },
    {
      label: "Shortlink Clicks",
      value: formatInteger(shortlinkClicksInRange),
      hint: "Klik kampanye yang terlacak",
      delta: formatDelta(calculateDelta(shortlinkClicksInRange, previousShortlinkClicks)),
      detail: `Klik berasal dari entri ShortlinkClick yang timestamp-nya masuk ke periode aktif.`,
      icon: MousePointerClick,
      accent: "from-amber-500/20 to-amber-500/5",
      iconClass: "text-amber-600"
    },
    {
      label: "Paid Invoices",
      value: formatInteger(paidInvoicesInRange),
      hint: "Invoice yang sudah lunas di periode ini",
      delta: formatDelta(calculateDelta(paidInvoicesInRange, previousPaidInvoices)),
      detail: `Jumlah invoice dengan status PAID yang dibuat dalam rentang aktif.`,
      icon: Receipt,
      accent: "from-rose-500/20 to-rose-500/5",
      iconClass: "text-rose-600"
    }
  ];

  return (
    <section className="flex h-full min-h-0 flex-1 flex-col overflow-hidden p-3 md:p-5">
      <div className="inbox-scroll flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overscroll-contain pr-1">
        <div className="flex flex-col gap-5 rounded-3xl border border-border/60 bg-card p-5 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.02)] lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-4">
            <div className="inline-flex items-center gap-3 rounded-2xl border border-primary/20 bg-primary/5 px-3.5 py-2.5 text-primary transition-colors hover:bg-primary/10">
              <span className="flex h-9 w-9 items-center justify-center rounded-[14px] bg-gradient-to-br from-primary to-primary/80 shadow-sm text-primary-foreground">
                <Building2 className="h-4 w-4" />
              </span>
              <div className="leading-tight">
                <p className="text-[10px] font-bold uppercase tracking-widest text-primary/70">Business aktif</p>
                <p className="text-[15px] font-bold tracking-tight text-primary">{business.name}</p>
              </div>
            </div>
          </div>
          <div className="flex shrink-0">
            <DashboardDateRangePicker from={formatDateParam(rangeFrom)} to={formatDateParam(rangeTo)} />
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {metrics.map(({ label, value, hint, delta, detail, icon: Icon, accent, iconClass }) => (
            <article key={label} className="group relative overflow-hidden rounded-3xl border border-border/60 bg-card p-5 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.02)] transition-shadow hover:shadow-[0_4px_24px_-4px_rgba(0,0,0,0.06)]">
              <div className="relative flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80">{label}</p>
                    <HoverCard openDelay={120}>
                      <HoverCardTrigger asChild>
                        <button type="button" className="inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground/50 hover:bg-muted/50 hover:text-foreground">
                          <Info className="h-3.5 w-3.5" />
                        </button>
                      </HoverCardTrigger>
                      <HoverCardContent align="start" className="w-72 rounded-2xl border-border/60 shadow-lg">
                        <p className="text-sm font-semibold text-foreground">{label}</p>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">{detail}</p>
                      </HoverCardContent>
                    </HoverCard>
                  </div>
                  <p className="mt-3 text-[2rem] font-bold leading-none tracking-tight text-foreground">{value}</p>
                  
                  <div className="mt-4 flex items-center gap-2 text-[11px] font-semibold">
                    <span
                      className={cn(
                        "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 border",
                        delta.direction === "up"
                          ? "border-emerald-200 bg-emerald-50 text-emerald-600"
                          : delta.direction === "down"
                            ? "border-rose-200 bg-rose-50 text-rose-600"
                            : "border-border/60 bg-muted/40 text-muted-foreground"
                      )}
                    >
                      {delta.direction === "up" ? <ArrowUpRight className="h-3 w-3" /> : null}
                      {delta.direction === "down" ? <ArrowDownRight className="h-3 w-3" /> : null}
                      {delta.label}
                    </span>
                    <span className="text-muted-foreground/70 font-medium">vs periode lalu</span>
                  </div>
                  <p className="mt-2 text-[11px] font-medium leading-relaxed text-muted-foreground/60">{hint}</p>
                </div>
                <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] bg-gradient-to-br", accent, iconClass)}>
                  <Icon className="h-5 w-5" />
                </div>
              </div>
            </article>
          ))}
        </div>

        <div className="grid items-start gap-5 2xl:grid-cols-[minmax(0,1.6fr)_minmax(360px,0.9fr)]">
          <article className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-[0_2px_10px_-4px_rgba(0,0,0,0.02)]">
            <div className="flex flex-col gap-3 border-b border-border/50 px-6 py-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80">Message Volume</p>
                <h2 className="mt-1.5 text-[22px] font-bold tracking-tight text-foreground">Inbound vs outbound per hari</h2>
                <p className="mt-1.5 text-[13px] font-medium text-muted-foreground/80">Hover chart untuk melihat detail harian per tanggal.</p>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-[12px] font-semibold">
                <div className="inline-flex items-center gap-2 rounded-lg bg-emerald-500/10 px-2.5 py-1 text-emerald-700 ring-1 ring-inset ring-emerald-500/20">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />Inbound
                </div>
                <div className="inline-flex items-center gap-2 rounded-lg bg-sky-500/10 px-2.5 py-1 text-sky-700 ring-1 ring-inset ring-sky-500/20">
                  <span className="h-2 w-2 rounded-full bg-sky-500" />Outbound
                </div>
              </div>
            </div>
            <div className="px-5 pb-5 pt-6">
              <DashboardMessageChart data={dailySeries} />
            </div>
          </article>

          <article className="rounded-3xl border border-border/60 bg-card p-6 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.02)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80">Invoice Snapshot</p>
                <h2 className="mt-1 text-[22px] font-bold tracking-tight text-foreground">Status rentang aktif</h2>
              </div>
              <div className="rounded-xl border border-border/50 bg-background/50 px-3 py-2 text-right shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Total</p>
                <p className="text-lg font-bold leading-tight text-foreground">{formatInteger(totalInvoicesInRange)}</p>
              </div>
            </div>
            <div className="mt-6 space-y-3">
              {invoiceSummaryPreview.map((item) => (
                <div key={item.key} className="group rounded-2xl border border-border/50 bg-gradient-to-br from-card to-background/50 p-4 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.02)] transition-shadow hover:shadow-[0_4px_16px_-4px_rgba(0,0,0,0.06)]">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <span className={cn("rounded-lg border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.15em]", item.tone)}>{item.label}</span>
                      <span className="text-[13px] font-semibold text-muted-foreground/90">{formatInteger(item.count)} invoice</span>
                    </div>
                    <span className="text-[15px] font-bold text-foreground">{formatMoney(item.totalCents)}</span>
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-[11px]">
                    <span
                      className={cn(
                        "inline-flex items-center gap-0.5 rounded-md border px-1.5 py-0.5 font-semibold",
                        item.delta.direction === "up"
                          ? "border-emerald-200 bg-emerald-50 text-emerald-600"
                          : item.delta.direction === "down"
                            ? "border-rose-200 bg-rose-50 text-rose-600"
                            : "border-border/60 bg-muted/40 text-muted-foreground"
                      )}
                    >
                      {item.delta.direction === "up" ? <ArrowUpRight className="h-3 w-3" /> : null}
                      {item.delta.direction === "down" ? <ArrowDownRight className="h-3 w-3" /> : null}
                      {item.delta.label}
                    </span>
                    <span className="font-medium text-muted-foreground/70">vs jumlah invoice yang sama</span>
                  </div>
                </div>
              ))}
              <div className="pt-2 text-right">
                <Link href="/invoices" className="text-[13px] font-semibold text-primary underline-offset-4 hover:underline">
                  Lihat semua status di menu Invoice &rarr;
                </Link>
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
