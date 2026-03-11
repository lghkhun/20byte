"use client";

import type { InvoiceStatus, PaymentMilestoneType } from "@prisma/client";
import { useCallback, useEffect, useMemo, useState } from "react";

import { InvoiceActionsPanel } from "@/components/invoices/workspace/InvoiceActionsPanel";
import { InvoiceFilters } from "@/components/invoices/workspace/InvoiceFilters";
import { InvoiceListPanel } from "@/components/invoices/workspace/InvoiceListPanel";
import type { ApiError, InvoiceItem, InvoiceTimeline, OrgItem } from "@/components/invoices/workspace/types";
import { toErrorMessage } from "@/components/invoices/workspace/utils";

const STATUS_FILTERS: Array<"ALL" | InvoiceStatus> = ["ALL", "DRAFT", "SENT", "PARTIALLY_PAID", "PAID", "VOID"];

export function InvoicesWorkspace() {
  const [orgs, setOrgs] = useState<OrgItem[]>([]);
  const [orgId, setOrgId] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | InvoiceStatus>("ALL");
  const [invoices, setInvoices] = useState<InvoiceItem[]>([]);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<InvoiceTimeline | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isMarkingPaid, setIsMarkingPaid] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const selectedInvoice = useMemo(() => invoices.find((item) => item.id === selectedInvoiceId) ?? null, [invoices, selectedInvoiceId]);

  const loadOrganizations = useCallback(async () => {
    const response = await fetch("/api/orgs", { cache: "no-store" });
    const payload = (await response.json()) as { data?: { organizations?: OrgItem[] } } & ApiError;
    if (!response.ok) {
      throw new Error(payload.error?.message ?? "Failed to load organizations.");
    }

    const rows = payload.data?.organizations ?? [];
    setOrgs(rows);
    if (rows.length > 0) {
      setOrgId((current) => current || rows[0].id);
    }
  }, []);

  const loadInvoices = useCallback(async () => {
    if (!orgId) {
      return;
    }

    const params = new URLSearchParams({
      orgId,
      page: "1",
      limit: "50"
    });

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
    if (rows.length > 0) {
      setSelectedInvoiceId((current) => (current && rows.some((row) => row.id === current) ? current : rows[0].id));
      return;
    }

    setSelectedInvoiceId(null);
    setTimeline(null);
  }, [orgId, statusFilter]);

  const loadTimeline = useCallback(async () => {
    if (!orgId || !selectedInvoiceId) {
      setTimeline(null);
      return;
    }

    const response = await fetch(
      `/api/invoices/${encodeURIComponent(selectedInvoiceId)}/timeline?orgId=${encodeURIComponent(orgId)}`,
      { cache: "no-store" }
    );

    const payload = (await response.json()) as { data?: { timeline?: InvoiceTimeline } } & ApiError;
    if (!response.ok) {
      throw new Error(payload.error?.message ?? "Failed to load invoice timeline.");
    }

    setTimeline(payload.data?.timeline ?? null);
  }, [orgId, selectedInvoiceId]);

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      try {
        setIsLoading(true);
        setError(null);
        await loadOrganizations();
      } catch (err) {
        if (mounted) {
          setError(toErrorMessage(err, "Failed to initialize invoices module."));
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    void bootstrap();
    return () => {
      mounted = false;
    };
  }, [loadOrganizations]);

  useEffect(() => {
    let mounted = true;

    async function refresh() {
      if (!orgId) {
        return;
      }

      try {
        setError(null);
        await loadInvoices();
      } catch (err) {
        if (mounted) {
          setError(toErrorMessage(err, "Failed to refresh invoices."));
        }
      }
    }

    void refresh();
    return () => {
      mounted = false;
    };
  }, [loadInvoices, orgId]);

  useEffect(() => {
    let mounted = true;

    async function refreshTimeline() {
      if (!selectedInvoiceId || !orgId) {
        return;
      }

      try {
        await loadTimeline();
      } catch (err) {
        if (mounted) {
          setError(toErrorMessage(err, "Failed to refresh invoice timeline."));
        }
      }
    }

    void refreshTimeline();
    return () => {
      mounted = false;
    };
  }, [loadTimeline, orgId, selectedInvoiceId]);

  async function handleSendInvoice() {
    if (!orgId || !selectedInvoice || isSending) {
      return;
    }

    try {
      setError(null);
      setSuccess(null);
      setIsSending(true);

      const response = await fetch(`/api/invoices/${encodeURIComponent(selectedInvoice.id)}/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ orgId })
      });

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
    if (!orgId || !selectedInvoice || isMarkingPaid) {
      return;
    }

    try {
      setError(null);
      setSuccess(null);
      setIsMarkingPaid(true);

      const response = await fetch(`/api/invoices/${encodeURIComponent(selectedInvoice.id)}/mark-paid`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ orgId, milestoneType })
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
    <section className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold text-foreground">Invoices</h1>
        <p className="text-sm text-muted-foreground">Send invoices, mark payment, and audit timeline lifecycle.</p>
      </header>

      <InvoiceFilters
        orgs={orgs}
        orgId={orgId}
        setOrgId={setOrgId}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        statusFilters={STATUS_FILTERS}
      />

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <InvoiceListPanel
          isLoading={isLoading}
          invoices={invoices}
          selectedInvoiceId={selectedInvoiceId}
          onSelectInvoice={setSelectedInvoiceId}
          onRefresh={loadInvoices}
        />
        <InvoiceActionsPanel
          selectedInvoice={selectedInvoice}
          timeline={timeline}
          isSending={isSending}
          isMarkingPaid={isMarkingPaid}
          onSendInvoice={handleSendInvoice}
          onMarkPaid={handleMarkPaid}
        />
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {success ? <p className="text-sm text-emerald-300">{success}</p> : null}
    </section>
  );
}
