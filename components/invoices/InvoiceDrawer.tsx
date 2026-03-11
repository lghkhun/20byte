"use client";

import { useRef } from "react";
import { InvoiceKind, PaymentMilestoneType } from "@prisma/client";

import { InvoiceStatusBadge } from "@/components/invoices/InvoiceStatusBadge";
import { ServiceCatalogPanel } from "@/components/invoices/ServiceCatalogPanel";
import { type InvoiceDrawerProps, toRupiahLabel } from "@/components/invoices/invoice-drawer/types";
import { useInvoiceDrawer } from "@/components/invoices/invoice-drawer/useInvoiceDrawer";
import { useModalAccessibility } from "@/lib/a11y/useModalAccessibility";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function InvoiceDrawer({ open, orgId, customerId, conversationId, onClose }: InvoiceDrawerProps) {
  const drawerRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  const {
    kind,
    setKind,
    items,
    milestones,
    invoiceId,
    invoiceNo,
    invoiceStatus,
    error,
    success,
    isSubmitting,
    isUpdatingItems,
    isSendingInvoice,
    isMarkingPaid,
    totalCents,
    updateItem,
    addItem,
    addItemFromCatalog,
    removeItem,
    updateMilestone,
    handleCreateInvoice,
    handleUpdateItems,
    handleSendInvoice,
    handleMarkPaid
  } = useInvoiceDrawer({ open, orgId, customerId, conversationId, onClose });

  useModalAccessibility({
    open,
    onClose,
    containerRef: drawerRef,
    initialFocusRef: closeButtonRef
  });

  if (!open) {
    return null;
  }

  const canCreateDraft = !isSubmitting && Boolean(orgId) && Boolean(customerId);
  const canUpdateDraft = !isUpdatingItems && Boolean(invoiceId);
  const canSendInvoice = !isSendingInvoice && Boolean(invoiceId);
  const canMarkPaid = !isMarkingPaid && Boolean(invoiceId);

  return (
    <div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Invoice drawer">
      <div ref={drawerRef} className="ml-auto h-full w-full max-w-2xl overflow-y-auto border-l border-border bg-surface">
        <div className="sticky top-0 z-[2] border-b border-border bg-surface/95 px-4 py-3 backdrop-blur sm:px-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Create Invoice</h2>
              <p className="text-xs text-muted-foreground">Build invoice from current chat context.</p>
              {invoiceNo ? <p className="mt-1 text-xs text-emerald-300">Invoice: {invoiceNo}</p> : null}
              {invoiceStatus ? (
                <div className="mt-2">
                  <InvoiceStatusBadge status={invoiceStatus} />
                </div>
              ) : null}
            </div>
            <Button ref={closeButtonRef} type="button" variant="ghost" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>

        <form id="invoice-drawer-form" className="space-y-4 px-4 pb-28 pt-4 sm:px-5 sm:pb-24" onSubmit={handleCreateInvoice}>
          <section className="rounded-lg border border-border bg-background/40 p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Invoice Type</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setKind(InvoiceKind.FULL)}
                className={
                  kind === InvoiceKind.FULL
                    ? "rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-left text-xs text-emerald-300"
                    : "rounded-md border border-border px-3 py-2 text-left text-xs text-foreground"
                }
              >
                Full Payment
              </button>
              <button
                type="button"
                onClick={() => setKind(InvoiceKind.DP_AND_FINAL)}
                className={
                  kind === InvoiceKind.DP_AND_FINAL
                    ? "rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-left text-xs text-emerald-300"
                    : "rounded-md border border-border px-3 py-2 text-left text-xs text-foreground"
                }
              >
                Down Payment + Final
              </button>
            </div>
          </section>

          <section className="rounded-lg border border-border bg-background/40 p-3">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Invoice Items</p>
              <Button type="button" variant="secondary" onClick={addItem}>
                Add Item
              </Button>
            </div>
            <div className="mb-3">
              <ServiceCatalogPanel orgId={orgId} onUseItem={addItemFromCatalog} />
            </div>
            <div className="space-y-3">
              {items.map((item, index) => (
                <article key={item.id} className="rounded-md border border-border p-3">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Input
                      value={item.name}
                      placeholder="Item name"
                      onChange={(event) => updateItem(index, { name: event.target.value })}
                    />
                    <Input
                      value={item.unit}
                      placeholder="Unit (optional)"
                      onChange={(event) => updateItem(index, { unit: event.target.value })}
                    />
                    <Input
                      type="number"
                      min={1}
                      value={item.qty}
                      placeholder="Qty"
                      onChange={(event) => updateItem(index, { qty: Number(event.target.value) })}
                    />
                    <Input
                      type="number"
                      min={0}
                      value={item.priceCents}
                      placeholder="Price (IDR)"
                      onChange={(event) => updateItem(index, { priceCents: Number(event.target.value) })}
                    />
                  </div>
                  <Input
                    className="mt-2"
                    value={item.description}
                    placeholder="Description (optional)"
                    onChange={(event) => updateItem(index, { description: event.target.value })}
                  />
                  <div className="mt-2 flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      Subtotal: {toRupiahLabel(Math.max(0, item.qty) * Math.max(0, item.priceCents))}
                    </p>
                    <Button type="button" variant="ghost" onClick={() => removeItem(index)} disabled={items.length <= 1}>
                      Remove
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-border bg-background/40 p-3">
            <p className="mb-3 text-xs uppercase tracking-wide text-muted-foreground">Milestones</p>
            <div className="space-y-2">
              {milestones.map((milestone, index) => (
                <article key={`${milestone.type}-${index}`} className="rounded-md border border-border p-3">
                  <p className="mb-2 text-xs text-foreground">{milestone.type}</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Input
                      type="number"
                      min={0}
                      value={milestone.amountCents}
                      placeholder="Amount (IDR)"
                      onChange={(event) => updateMilestone(index, { amountCents: Number(event.target.value) })}
                    />
                    <Input
                      type="date"
                      value={milestone.dueDate}
                      onChange={(event) => updateMilestone(index, { dueDate: event.target.value })}
                    />
                  </div>
                </article>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Milestone total: {toRupiahLabel(milestones.reduce((acc, milestone) => acc + Math.max(0, milestone.amountCents), 0))}
            </p>
          </section>

          <section className="rounded-lg border border-border bg-background/40 p-3">
            <p className="text-sm font-medium text-foreground">Invoice Total: {toRupiahLabel(totalCents)}</p>
            <p className="mt-1 text-xs text-muted-foreground">Format follows DOC 07: INV-YYYY-XXXX (auto generated).</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <InvoiceStatusBadge status="DRAFT" />
              <InvoiceStatusBadge status="SENT" />
              <InvoiceStatusBadge status="PARTIALLY_PAID" />
              <InvoiceStatusBadge status="PAID" />
              <InvoiceStatusBadge status="OVERDUE" />
            </div>
          </section>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {success ? <p className="text-sm text-emerald-300">{success}</p> : null}
        </form>

        <div className="sticky bottom-0 z-[2] border-t border-border bg-surface/95 px-4 py-3 backdrop-blur sm:px-5">
          <div className="flex flex-wrap gap-2">
            <Button type="submit" form="invoice-drawer-form" disabled={!canCreateDraft}>
              {isSubmitting ? "Creating..." : "Create Draft Invoice"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                void handleUpdateItems();
              }}
              disabled={!canUpdateDraft}
            >
              {isUpdatingItems ? "Updating..." : "Update Draft Items"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                void handleSendInvoice();
              }}
              disabled={!canSendInvoice}
            >
              {isSendingInvoice ? "Sending..." : "Send Invoice"}
            </Button>
            {kind === InvoiceKind.DP_AND_FINAL ? (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    void handleMarkPaid(PaymentMilestoneType.DP);
                  }}
                  disabled={!canMarkPaid}
                >
                  {isMarkingPaid ? "Updating..." : "Mark DP Paid"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    void handleMarkPaid(PaymentMilestoneType.FINAL);
                  }}
                  disabled={!canMarkPaid}
                >
                  {isMarkingPaid ? "Updating..." : "Mark Final Paid"}
                </Button>
              </>
            ) : (
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  void handleMarkPaid(PaymentMilestoneType.FULL);
                }}
                disabled={!canMarkPaid}
              >
                {isMarkingPaid ? "Updating..." : "Mark Paid"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
