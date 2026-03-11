"use client";

import type { CrmInvoiceItem } from "@/components/inbox/crm/types";

type InvoicesSectionProps = {
  invoices: CrmInvoiceItem[];
  isLoadingCrm: boolean;
  isSendingInvoice: boolean;
  isMarkingInvoicePaid: boolean;
  canOperateInvoice: boolean;
  activeOrgRole: string | null;
  invoiceActionError: string | null;
  invoiceActionSuccess: string | null;
  onSendInvoice: (invoiceId: string) => Promise<void>;
  onMarkInvoicePaid: (invoiceId: string, milestoneType?: "FULL" | "DP" | "FINAL") => Promise<void>;
  formatDateTime: (value: string | null) => string;
};

export function InvoicesSection({
  invoices,
  isLoadingCrm,
  isSendingInvoice,
  isMarkingInvoicePaid,
  canOperateInvoice,
  activeOrgRole,
  invoiceActionError,
  invoiceActionSuccess,
  onSendInvoice,
  onMarkInvoicePaid,
  formatDateTime
}: InvoicesSectionProps) {
  return (
    <section className="rounded-xl border border-border/80 bg-background/50 p-3.5">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">Invoices</p>
      {isLoadingCrm ? <p className="mt-2 text-xs text-muted-foreground">Loading invoices...</p> : null}
      {!isLoadingCrm && invoices.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">No invoices linked to this conversation.</p>
      ) : null}
      {!isLoadingCrm && invoices.length > 0 ? (
        <div className="mt-2 space-y-2">
          {invoices.slice(0, 6).map((invoice) => (
            <article key={invoice.id} className="rounded-lg border border-border/80 bg-background/70 p-2.5">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-medium text-foreground">{invoice.invoiceNo}</p>
                <span className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">{invoice.status}</span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {(invoice.totalCents / 100).toLocaleString("en-US")} {invoice.currency}
              </p>
              <p className="text-[11px] text-muted-foreground">Proofs: {invoice.proofCount}</p>
              <p className="text-[11px] text-muted-foreground">{formatDateTime(invoice.createdAt)}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    void onSendInvoice(invoice.id);
                  }}
                  disabled={isSendingInvoice || !canOperateInvoice || (invoice.status !== "DRAFT" && invoice.status !== "SENT")}
                  className="rounded border border-primary/40 bg-primary/10 px-2 py-1 text-[11px] font-medium text-primary transition hover:bg-primary/15 disabled:opacity-50"
                >
                  {isSendingInvoice ? "Sending..." : "Send"}
                </button>

                {invoice.kind === "DP_AND_FINAL" ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        void onMarkInvoicePaid(invoice.id, "DP");
                      }}
                      disabled={isMarkingInvoicePaid || !canOperateInvoice || (activeOrgRole !== "OWNER" && invoice.proofCount === 0)}
                      className="rounded border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-[11px] font-medium text-emerald-600 transition hover:bg-emerald-500/15 disabled:opacity-50 dark:text-emerald-400"
                    >
                      Mark DP Paid
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void onMarkInvoicePaid(invoice.id, "FINAL");
                      }}
                      disabled={isMarkingInvoicePaid || !canOperateInvoice || (activeOrgRole !== "OWNER" && invoice.proofCount === 0)}
                      className="rounded border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-[11px] font-medium text-emerald-600 transition hover:bg-emerald-500/15 disabled:opacity-50 dark:text-emerald-400"
                    >
                      Mark Final Paid
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      void onMarkInvoicePaid(invoice.id, "FULL");
                    }}
                    disabled={isMarkingInvoicePaid || !canOperateInvoice || (activeOrgRole !== "OWNER" && invoice.proofCount === 0)}
                    className="rounded border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-[11px] font-medium text-emerald-600 transition hover:bg-emerald-500/15 disabled:opacity-50 dark:text-emerald-400"
                  >
                    Mark Paid
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : null}
      {!canOperateInvoice ? (
        <p className="mt-2 text-[11px] text-muted-foreground">Role {activeOrgRole ?? "-"} cannot send/mark invoices.</p>
      ) : null}
      {invoiceActionError ? <p className="mt-2 text-[11px] text-destructive">{invoiceActionError}</p> : null}
      {invoiceActionSuccess ? <p className="mt-2 text-[11px] text-emerald-600 dark:text-emerald-400">{invoiceActionSuccess}</p> : null}
    </section>
  );
}
