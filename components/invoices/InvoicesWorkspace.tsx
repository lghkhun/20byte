"use client";

import type { InvoiceStatus, PaymentMilestoneType } from "@prisma/client";
import { FileText, PlusCircle, Search, Send, Settings2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { ApiError, InvoiceItem, InvoiceTimeline, OrgItem } from "@/components/invoices/workspace/types";
import { toErrorMessage } from "@/components/invoices/workspace/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const STATUS_FILTERS: Array<"ALL" | InvoiceStatus> = ["ALL", "DRAFT", "SENT", "PARTIALLY_PAID", "PAID", "VOID"];

function formatMoney(amountCents: number, currency: string): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency,
    maximumFractionDigits: 0
  }).format(amountCents / 100);
}

function formatDateLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(date);
}

export function InvoicesWorkspace() {
  const [orgs, setOrgs] = useState<OrgItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<"ALL" | InvoiceStatus>("ALL");
  const [invoices, setInvoices] = useState<InvoiceItem[]>([]);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<InvoiceTimeline | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isMarkingPaid, setIsMarkingPaid] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const selectedInvoice = useMemo(() => invoices.find((item) => item.id === selectedInvoiceId) ?? null, [invoices, selectedInvoiceId]);
  const activeBusiness = useMemo(() => orgs[0] ?? null, [orgs]);
  const filteredInvoices = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    if (!query) {
      return invoices;
    }

    return invoices.filter((invoice) =>
      [invoice.invoiceNo, invoice.customerName ?? "", invoice.customerPhoneE164].some((value) => value.toLowerCase().includes(query))
    );
  }, [invoices, searchText]);

  const summary = useMemo(() => {
    return filteredInvoices.reduce(
      (accumulator, invoice) => {
        if (invoice.status === "PAID") {
          accumulator.paid += 1;
          accumulator.revenue += invoice.totalCents;
        } else if (invoice.status !== "VOID") {
          accumulator.unpaid += 1;
        }
        return accumulator;
      },
      { paid: 0, unpaid: 0, revenue: 0 }
    );
  }, [filteredInvoices]);

  const loadOrganizations = useCallback(async () => {
    const response = await fetch("/api/orgs", { cache: "no-store" });
    const payload = (await response.json()) as { data?: { organizations?: OrgItem[] } } & ApiError;
    if (!response.ok) {
      throw new Error(payload.error?.message ?? "Failed to load business.");
    }

    setOrgs(payload.data?.organizations ?? []);
  }, []);

  const loadInvoices = useCallback(async () => {
    const params = new URLSearchParams({ page: "1", limit: "50" });
    if (statusFilter !== "ALL") {
      params.set("status", statusFilter);
    }

    const response = await fetch(`/api/invoices?${params.toString()}`, { cache: "no-store" });
    const payload = (await response.json()) as { data?: { invoices?: InvoiceItem[] } } & ApiError;
    if (!response.ok) {
      throw new Error(payload.error?.message ?? "Failed to load invoices.");
    }

    const rows = payload.data?.invoices ?? [];
    setInvoices(rows);
    setSelectedInvoiceId((current) => (current && rows.some((row) => row.id === current) ? current : rows[0]?.id ?? null));
    if (rows.length === 0) {
      setTimeline(null);
    }
  }, [statusFilter]);

  const loadTimeline = useCallback(async () => {
    if (!selectedInvoiceId) {
      setTimeline(null);
      return;
    }

    const response = await fetch(`/api/invoices/${encodeURIComponent(selectedInvoiceId)}/timeline`, { cache: "no-store" });
    const payload = (await response.json()) as { data?: { timeline?: InvoiceTimeline } } & ApiError;
    if (!response.ok) {
      throw new Error(payload.error?.message ?? "Failed to load invoice timeline.");
    }

    setTimeline(payload.data?.timeline ?? null);
  }, [selectedInvoiceId]);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        setIsLoading(true);
        await loadOrganizations();
      } catch (err) {
        if (mounted) {
          setError(toErrorMessage(err, "Failed to initialize invoice system."));
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [loadOrganizations]);

  useEffect(() => {
    if (!activeBusiness) {
      return;
    }

    void (async () => {
      try {
        await loadInvoices();
      } catch (err) {
        setError(toErrorMessage(err, "Failed to refresh invoices."));
      }
    })();
  }, [activeBusiness, loadInvoices]);

  useEffect(() => {
    void loadTimeline().catch((err) => {
      setError(toErrorMessage(err, "Failed to refresh invoice timeline."));
    });
  }, [loadTimeline]);

  async function handleSendInvoice() {
    if (!selectedInvoice || isSending) {
      return;
    }

    try {
      setError(null);
      setSuccess(null);
      setIsSending(true);
      const response = await fetch(`/api/invoices/${encodeURIComponent(selectedInvoice.id)}/send`, { method: "POST" });
      const payload = (await response.json()) as { data?: { invoice?: { publicLink?: string } } } & ApiError;
      if (!response.ok) {
        throw new Error(payload.error?.message ?? "Failed to send invoice.");
      }

      setSuccess(`Invoice sent. ${payload.data?.invoice?.publicLink ?? ""}`.trim());
      await loadInvoices();
      await loadTimeline();
    } catch (err) {
      setError(toErrorMessage(err, "Failed to send invoice."));
    } finally {
      setIsSending(false);
    }
  }

  async function handleMarkPaid(milestoneType?: PaymentMilestoneType) {
    if (!selectedInvoice || isMarkingPaid) {
      return;
    }

    try {
      setError(null);
      setSuccess(null);
      setIsMarkingPaid(true);
      const response = await fetch(`/api/invoices/${encodeURIComponent(selectedInvoice.id)}/mark-paid`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ milestoneType })
      });
      const payload = (await response.json()) as ApiError;
      if (!response.ok) {
        throw new Error(payload.error?.message ?? "Failed to mark invoice paid.");
      }

      setSuccess("Invoice payment status updated.");
      await loadInvoices();
      await loadTimeline();
    } catch (err) {
      setError(toErrorMessage(err, "Failed to mark invoice paid."));
    } finally {
      setIsMarkingPaid(false);
    }
  }

  return (
    <section className="space-y-5 p-5">
      <div className="rounded-[28px] border border-border/70 bg-card/95 shadow-sm">
        <div className="flex flex-wrap items-center gap-4 px-6 py-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-50 text-orange-500">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">Invoice System</h1>
            <p className="text-sm text-muted-foreground">Kelola invoice, pengiriman, dan pelunasan dalam satu workspace.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-6 border-t border-border/70 px-6 py-4 text-sm font-medium">
          <span className="text-orange-500">All Invoices</span>
          <span className="inline-flex items-center gap-2 text-muted-foreground"><PlusCircle className="h-4 w-4" />Create Invoice</span>
          <span className="inline-flex items-center gap-2 text-muted-foreground"><Settings2 className="h-4 w-4" />Settings</span>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <article className="rounded-[22px] border border-emerald-200 bg-emerald-50/70 p-5">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-600">Paid invoices</p>
          <p className="mt-3 text-4xl font-semibold text-emerald-700">{summary.paid}</p>
        </article>
        <article className="rounded-[22px] border border-rose-200 bg-rose-50/70 p-5">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-rose-600">Unpaid invoices</p>
          <p className="mt-3 text-4xl font-semibold text-rose-700">{summary.unpaid}</p>
        </article>
        <article className="rounded-[22px] border border-blue-200 bg-blue-50/70 p-5">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-600">Total revenue</p>
          <p className="mt-3 text-4xl font-semibold text-blue-700">{formatMoney(summary.revenue, "IDR")}</p>
        </article>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_380px]">
        <section className="rounded-[24px] border border-border/70 bg-card/95 p-5 shadow-sm">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight text-foreground">Invoices</h2>
              <p className="text-sm text-muted-foreground">{activeBusiness?.name ?? "Business"} invoice registry</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Search..." className="h-11 rounded-xl pl-10" />
              </label>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as "ALL" | InvoiceStatus)}
                className="h-11 rounded-xl border border-border bg-background px-3 text-sm"
              >
                {STATUS_FILTERS.map((filter) => (
                  <option key={filter} value={filter}>
                    {filter}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-hidden rounded-[22px] border border-border/70">
            <table className="w-full">
              <thead>
                <tr className="bg-background/70 text-left text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  <th className="px-4 py-4">Number</th>
                  <th className="px-4 py-4">Customer</th>
                  <th className="px-4 py-4">Date</th>
                  <th className="px-4 py-4">Amount</th>
                  <th className="px-4 py-4">Status</th>
                  <th className="px-4 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map((invoice) => (
                  <tr
                    key={invoice.id}
                    className={`border-t border-border/60 cursor-pointer ${invoice.id === selectedInvoiceId ? "bg-primary/5" : "bg-card hover:bg-accent/30"}`}
                    onClick={() => setSelectedInvoiceId(invoice.id)}
                  >
                    <td className="px-4 py-4 font-semibold text-indigo-600">{invoice.invoiceNo}</td>
                    <td className="px-4 py-4">
                      <div>
                        <p className="font-medium text-foreground">{invoice.customerName?.trim() || invoice.customerPhoneE164}</p>
                        <p className="text-sm text-muted-foreground">{invoice.customerPhoneE164}</p>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-muted-foreground">{formatDateLabel(invoice.createdAt)}</td>
                    <td className="px-4 py-4 font-semibold text-foreground">{formatMoney(invoice.totalCents, invoice.currency)}</td>
                    <td className="px-4 py-4">
                      <span className={`rounded-md px-2.5 py-1 text-xs font-semibold ${invoice.status === "PAID" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                        {invoice.status}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex justify-end gap-2">
                        <button className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-500">
                          <Send className="h-4 w-4" />
                        </button>
                        <button className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-foreground">↓</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {isLoading ? <p className="px-4 py-5 text-sm text-muted-foreground">Loading invoices...</p> : null}
            {!isLoading && filteredInvoices.length === 0 ? <p className="px-4 py-5 text-sm text-muted-foreground">No invoices found.</p> : null}
          </div>
        </section>

        <section className="rounded-[24px] border border-border/70 bg-card/95 p-5 shadow-sm">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">Invoice Detail</h2>
          {!selectedInvoice ? <p className="mt-3 text-sm text-muted-foreground">Select invoice first.</p> : null}
          {selectedInvoice ? (
            <div className="mt-4 space-y-4">
              <div className="rounded-2xl border border-border/70 bg-background/60 p-4">
                <p className="text-sm font-semibold text-foreground">{selectedInvoice.invoiceNo}</p>
                <p className="mt-1 text-sm text-muted-foreground">{selectedInvoice.customerName?.trim() || selectedInvoice.customerPhoneE164}</p>
                <p className="mt-3 text-2xl font-semibold text-foreground">{formatMoney(selectedInvoice.totalCents, selectedInvoice.currency)}</p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={() => void handleSendInvoice()} disabled={isSending}>
                  {isSending ? "Sending..." : "Send Invoice"}
                </Button>
                {selectedInvoice.kind === "DP_AND_FINAL" ? (
                  <>
                    <Button
                      type="button"
                      variant="secondary"
                      className="border border-border/80 bg-background"
                      onClick={() => void handleMarkPaid("DP" as PaymentMilestoneType)}
                      disabled={isMarkingPaid}
                    >
                      Mark DP Paid
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      className="border border-border/80 bg-background"
                      onClick={() => void handleMarkPaid("FINAL" as PaymentMilestoneType)}
                      disabled={isMarkingPaid}
                    >
                      Mark Final Paid
                    </Button>
                  </>
                ) : (
                  <Button
                    type="button"
                    variant="secondary"
                    className="border border-border/80 bg-background"
                    onClick={() => void handleMarkPaid("FULL" as PaymentMilestoneType)}
                    disabled={isMarkingPaid}
                  >
                    Mark Paid
                  </Button>
                )}
              </div>

              <div className="rounded-2xl border border-border/70 bg-background/50 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Timeline</p>
                <div className="mt-3 space-y-3">
                  {timeline?.events?.map((event) => (
                    <article key={event.id} className="rounded-xl border border-border/70 bg-card px-3 py-3">
                      <p className="text-sm font-medium text-foreground">{event.label}</p>
                      <p className="text-xs text-muted-foreground">{formatDateLabel(event.at)}</p>
                    </article>
                  ))}
                  {!timeline?.events?.length ? <p className="text-sm text-muted-foreground">No timeline yet.</p> : null}
                </div>
              </div>
            </div>
          ) : null}
        </section>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {success ? <p className="text-sm text-emerald-600">{success}</p> : null}
    </section>
  );
}
