"use client";

import type { InvoiceItem } from "@/components/invoices/workspace/types";
import { formatDate, formatMoney } from "@/components/invoices/workspace/utils";

type InvoiceListPanelProps = {
  isLoading: boolean;
  invoices: InvoiceItem[];
  selectedInvoiceId: string | null;
  onSelectInvoice: (invoiceId: string) => void;
  onRefresh: () => Promise<void>;
};

export function InvoiceListPanel({ isLoading, invoices, selectedInvoiceId, onSelectInvoice, onRefresh }: InvoiceListPanelProps) {
  return (
    <section className="rounded-xl border border-border bg-surface/70 p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Invoice List</h2>
        <button
          type="button"
          onClick={() => {
            void onRefresh();
          }}
          className="rounded border border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
        >
          Refresh
        </button>
      </div>

      {isLoading ? <p className="text-sm text-muted-foreground">Loading...</p> : null}
      {!isLoading && invoices.length === 0 ? <p className="text-sm text-muted-foreground">No invoices found.</p> : null}

      {!isLoading && invoices.length > 0 ? (
        <div className="space-y-2">
          {invoices.map((invoice) => (
            <button
              key={invoice.id}
              type="button"
              onClick={() => onSelectInvoice(invoice.id)}
              className={
                invoice.id === selectedInvoiceId
                  ? "w-full rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-left"
                  : "w-full rounded-md border border-border bg-background/40 p-3 text-left hover:bg-accent"
              }
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-foreground">{invoice.invoiceNo}</p>
                <span className="rounded border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground">{invoice.status}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {invoice.customerName ?? invoice.customerPhoneE164} - {formatMoney(invoice.totalCents, invoice.currency)}
              </p>
              <p className="text-[11px] text-muted-foreground">Updated {formatDate(invoice.updatedAt)}</p>
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
