import { cookies } from "next/headers";
import { MessageDirection, MessageSendStatus } from "@prisma/client";
import { Activity, Clock3, MessageCircleMore, TrendingUp, UsersRound } from "lucide-react";

import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { getPrimaryOrganizationForUser } from "@/server/services/organizationService";

function formatRelative(value: Date): string {
  const diffMs = Date.now() - value.getTime();
  const hours = Math.max(1, Math.floor(diffMs / 3_600_000));
  if (hours < 24) {
    return `about ${hours} hour${hours > 1 ? "s" : ""} ago`;
  }

  const days = Math.floor(hours / 24);
  return `about ${days} day${days > 1 ? "s" : ""} ago`;
}

function buildPath(values: number[], width: number, height: number): string {
  const max = Math.max(...values, 1);
  return values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * width;
      const y = height - (value / max) * (height - 12) - 6;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

export default async function DashboardPage() {
  const token = cookies().get(SESSION_COOKIE_NAME)?.value;
  const session = token ? verifySessionToken(token) : null;
  if (!session) {
    return null;
  }

  const business = await getPrimaryOrganizationForUser(session.userId);
  if (!business) {
    return <section className="p-6 text-sm text-muted-foreground">No business found.</section>;
  }

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const last7Days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(startOfToday);
    date.setDate(startOfToday.getDate() - (6 - index));
    return date;
  });

  const [incomingToday, pendingReply, totalContacts, sentToday, paidInvoices, unpaidInvoices, totalRevenue, recentMessages, waAccounts, chartCounts] =
    await Promise.all([
      prisma.message.count({
        where: {
          orgId: business.id,
          direction: MessageDirection.INBOUND,
          createdAt: { gte: startOfToday }
        }
      }),
      prisma.conversation.count({
        where: {
          orgId: business.id,
          status: "OPEN",
          unreadCount: { gt: 0 }
        }
      }),
      prisma.customer.count({
        where: { orgId: business.id }
      }),
      prisma.message.count({
        where: {
          orgId: business.id,
          direction: MessageDirection.OUTBOUND,
          sendStatus: MessageSendStatus.SENT,
          createdAt: { gte: startOfToday }
        }
      }),
      prisma.invoice.count({
        where: { orgId: business.id, status: "PAID" }
      }),
      prisma.invoice.count({
        where: { orgId: business.id, status: { in: ["DRAFT", "SENT", "PARTIALLY_PAID"] } }
      }),
      prisma.invoice.aggregate({
        where: { orgId: business.id, status: "PAID" },
        _sum: { totalCents: true }
      }),
      prisma.message.findMany({
        where: { orgId: business.id },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          text: true,
          direction: true,
          createdAt: true
        }
      }),
      prisma.waAccount.findMany({
        where: { orgId: business.id },
        orderBy: { connectedAt: "desc" },
        select: {
          id: true,
          displayPhone: true,
          connectedAt: true
        }
      }),
      Promise.all(
        last7Days.map(async (date) => {
          const nextDate = new Date(date);
          nextDate.setDate(date.getDate() + 1);
          const inbound = await prisma.message.count({
            where: {
              orgId: business.id,
              direction: MessageDirection.INBOUND,
              createdAt: {
                gte: date,
                lt: nextDate
              }
            }
          });
          const outbound = await prisma.message.count({
            where: {
              orgId: business.id,
              direction: MessageDirection.OUTBOUND,
              createdAt: {
                gte: date,
                lt: nextDate
              }
            }
          });
          return {
            label: String(date.getDate()).padStart(2, "0"),
            inbound,
            outbound
          };
        })
      )
    ]);

  const inboundPath = buildPath(chartCounts.map((item) => item.inbound), 640, 240);
  const outboundPath = buildPath(chartCounts.map((item) => item.outbound), 640, 240);

  return (
    <section className="space-y-5 p-5">
      <div className="grid gap-4 xl:grid-cols-4">
        {[
          { label: "Incoming Today", value: incomingToday, tone: "bg-blue-50 text-blue-500", sub: `${sentToday} sent`, icon: MessageCircleMore },
          { label: "Pending Reply", value: pendingReply, tone: "bg-orange-50 text-orange-500", sub: "Needs attention", icon: Clock3 },
          { label: "Total Contacts", value: totalContacts, tone: "bg-violet-50 text-violet-500", sub: "All time", icon: UsersRound },
          { label: "Activity Score", value: "98%", tone: "bg-emerald-50 text-emerald-500", sub: "Top 5% rank", icon: TrendingUp }
        ].map(({ label, value, tone, sub, icon: Icon }) => (
          <article key={label} className="rounded-[24px] border border-border/70 bg-card/95 p-6 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="mt-2 text-5xl font-semibold tracking-tight text-foreground">{value}</p>
                <span className="mt-3 inline-flex rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">{sub}</span>
              </div>
              <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${tone}`}>
                <Icon className="h-6 w-6" />
              </div>
            </div>
          </article>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(360px,0.83fr)]">
        <article className="rounded-[24px] border border-border/70 bg-card/95 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight text-foreground">Message Volume</h2>
              <p className="text-sm text-muted-foreground">Last 7 days</p>
            </div>
            <span className="rounded-xl border border-border/80 bg-background px-3 py-2 text-sm text-muted-foreground">Last 7 Days</span>
          </div>
          <div className="mt-6">
            <svg viewBox="0 0 640 260" className="h-[320px] w-full">
              <defs>
                <linearGradient id="inboundGradient" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="rgba(16,185,129,0.35)" />
                  <stop offset="100%" stopColor="rgba(16,185,129,0.03)" />
                </linearGradient>
                <linearGradient id="outboundGradient" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="rgba(59,130,246,0.35)" />
                  <stop offset="100%" stopColor="rgba(59,130,246,0.03)" />
                </linearGradient>
              </defs>
              <path d={`${inboundPath} L 640 260 L 0 260 Z`} fill="url(#inboundGradient)" />
              <path d={`${outboundPath} L 640 260 L 0 260 Z`} fill="url(#outboundGradient)" />
              <path d={inboundPath} fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" />
              <path d={outboundPath} fill="none" stroke="#4f6bed" strokeWidth="3" strokeLinecap="round" />
              {chartCounts.map((item, index) => (
                <text key={item.label} x={(index / 6) * 640} y="256" fontSize="12" fill="currentColor" className="text-muted-foreground">
                  {item.label}
                </text>
              ))}
            </svg>
          </div>
        </article>

        <article className="rounded-[24px] border border-border/70 bg-card/95 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight text-foreground">Connected Channels</h2>
              <p className="text-sm text-muted-foreground">Monitor connection status</p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary">+</div>
          </div>
          <div className="mt-5 flex gap-2">
            {["whatsapp", "whatsapp", "messenger", "instagram", "telegram", "webchat"].map((channel, index) => (
              <span key={`${channel}-${index}`} className={`flex h-10 w-10 items-center justify-center rounded-xl ${index === 0 ? "bg-slate-900 text-white" : "bg-muted/70 text-foreground"}`}>
                {channel.slice(0, 1).toUpperCase()}
              </span>
            ))}
          </div>
          <div className="mt-5 space-y-3 overflow-hidden rounded-2xl border border-border/70 bg-background/50 p-3">
            {waAccounts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No WhatsApp connection yet.</p>
            ) : (
              waAccounts.map((account) => (
                <div key={account.id} className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-card px-4 py-3">
                  <div>
                    <p className="text-lg font-semibold text-foreground">{business.name}</p>
                    <p className="text-sm text-muted-foreground">{account.displayPhone}</p>
                  </div>
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-600">
                    connected
                  </span>
                </div>
              ))
            )}
          </div>
        </article>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(360px,0.83fr)]">
        <article className="rounded-[24px] border border-border/70 bg-card/95 p-6 shadow-sm">
          <h2 className="text-3xl font-semibold tracking-tight text-foreground">Recent Activity</h2>
          <div className="mt-6 space-y-5">
            {recentMessages.map((message) => (
              <div key={message.id} className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className={`mt-1 flex h-8 w-8 items-center justify-center rounded-full ${message.direction === "INBOUND" ? "bg-blue-50 text-blue-500" : "bg-orange-50 text-orange-500"}`}>
                    <Activity className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-base font-medium text-foreground">{message.text ?? "Media message"}</p>
                    <p className="text-sm text-muted-foreground">{message.direction === "INBOUND" ? "received" : "sent"}</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">{formatRelative(message.createdAt)}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-[24px] bg-[linear-gradient(180deg,#2c2c85,#26246d)] p-6 text-white shadow-sm">
          <h2 className="text-3xl font-semibold tracking-tight">Broadcast Quota</h2>
          <p className="mt-2 text-sm text-white/70">Monthly Usage Limit</p>
          <div className="mt-24 flex items-end justify-between">
            <div>
              <p className="text-3xl font-semibold">{sentToday} Sent</p>
              <div className="mt-4 h-3 w-full rounded-full bg-white/10">
                <div className="h-3 rounded-full bg-white/20" style={{ width: `${Math.min(100, (sentToday / 200000) * 100)}%` }} />
              </div>
            </div>
            <p className="text-sm text-white/80">Limit: 200,000</p>
          </div>
          <div className="mt-10 grid grid-cols-3 gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-white/60">Paid invoices</p>
              <p className="mt-2 text-2xl font-semibold">{paidInvoices}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-white/60">Open invoices</p>
              <p className="mt-2 text-2xl font-semibold">{unpaidInvoices}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-white/60">Revenue</p>
              <p className="mt-2 text-2xl font-semibold">Rp {((totalRevenue._sum.totalCents ?? 0) / 100).toLocaleString("id-ID")}</p>
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}
