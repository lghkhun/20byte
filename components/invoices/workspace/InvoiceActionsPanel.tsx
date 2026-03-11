"use client";

import { PaymentMilestoneType } from "@prisma/client";

import type { InvoiceItem, InvoiceTimeline } from "@/components/invoices/workspace/types";
import { formatDate } from "@/components/invoices/workspace/utils";

type InvoiceActionsPanelProps = {
  selectedInvoice: InvoiceItem | null;
  timeline: InvoiceTimeline | null;
  isSending: boolean;
  isMarkingPaid: boolean;
  onSendInvoice: () => Promise<void>;
  onMarkPaid: (milestoneType?: PaymentMilestoneType) => Promise<void>;
};

export function InvoiceActionsPanel({
  selectedInvoice,
  timeline,
  isSending,
  isMarkingPaid,
  onSendInvoice,
  onMarkPaid
}: InvoiceActionsPanelProps) {
  return (
    <section className="rounded-xl border border-border bg-surface/70 p-4">
      <h2 className="text-sm font-semibold text-foreground">Invoice Actions</h2>
      {!selectedInvoice ? <p className="mt-2 text-sm text-muted-foreground">Select invoice first.</p> : null}

      {selectedInvoice ? (
        <div className="mt-2 space-y-3">
          <p className="text-sm text-foreground">{selectedInvoice.invoiceNo}</p>
          <p className="text-xs text-muted-foreground">Current status: {selectedInvoice.status}</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                void onSendInvoice();
              }}
              disabled={isSending || (selectedInvoice.status !== "DRAFT" && selectedInvoice.status !== "SENT")}
              className="rounded border border-border px-2 py-1 text-xs text-foreground disabled:opacity-50"
            >
              {isSending ? "Sending..." : "Send Invoice"}
            </button>

            {selectedInvoice.kind === "DP_AND_FINAL" ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    void onMarkPaid(PaymentMilestoneType.DP);
                  }}
                  disabled={isMarkingPaid}
                  className="rounded border border-border px-2 py-1 text-xs text-foreground disabled:opacity-50"
                >
                  Mark DP Paid
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void onMarkPaid(PaymentMilestoneType.FINAL);
                  }}
                  disabled={isMarkingPaid}
                  className="rounded border border-border px-2 py-1 text-xs text-foreground disabled:opacity-50"
                >
                  Mark Final Paid
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  void onMarkPaid(PaymentMilestoneType.FULL);
                }}
                disabled={isMarkingPaid}
                className="rounded border border-border px-2 py-1 text-xs text-foreground disabled:opacity-50"
              >
                Mark Paid
              </button>
            )}
          </div>
        </div>
      ) : null}

      <div className="mt-4 border-t border-border pt-3">
        <h3 className="text-xs uppercase tracking-wide text-muted-foreground">Invoice Timeline</h3>
        {!timeline ? <p className="mt-2 text-xs text-muted-foreground">No timeline loaded.</p> : null}
        {timeline ? (
          <div className="mt-2 space-y-2">
            {timeline.events.map((event) => (
              <article key={event.id} className="rounded border border-border bg-background/40 p-2">
                <p className="text-xs text-foreground">{event.label}</p>
                <p className="text-[11px] text-muted-foreground">{formatDate(event.at)}</p>
              </article>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
