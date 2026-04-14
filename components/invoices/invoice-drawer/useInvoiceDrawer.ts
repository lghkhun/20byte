"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { InvoiceKind, InvoiceStatus, PaymentMilestoneType } from "@prisma/client";

import {
  computeInvoiceSummary,
  createDefaultItems,
  createDefaultMilestones,
  type CreateInvoiceResponse,
  type EditInvoiceResponse,
  type InvoiceDrawerProps,
  type InvoiceItemDraft,
  makeId,
  type MarkPaidResponse,
  type MilestoneDraft,
  type SendInvoiceResponse
} from "@/components/invoices/invoice-drawer/types";

export function useInvoiceDrawer(props: InvoiceDrawerProps) {
  const { open, customerId, conversationId, customerDisplayNameSnapshot } = props;
  const [kind, setKind] = useState<InvoiceKind>(InvoiceKind.FULL);
  const [items, setItems] = useState<InvoiceItemDraft[]>(createDefaultItems);
  const [invoiceDiscountType, setInvoiceDiscountType] = useState<"%" | "IDR">("%");
  const [invoiceDiscountValue, setInvoiceDiscountValue] = useState(0);
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState("");
  const [dpPercentage, setDpPercentage] = useState(50);
  const [milestones, setMilestones] = useState<MilestoneDraft[]>(
    createDefaultMilestones(InvoiceKind.FULL, 0)
  );
  const [invoiceDueDate, setInvoiceDueDate] = useState("");
  const [invoiceId, setInvoiceId] = useState<string | null>(null);
  const [invoiceNo, setInvoiceNo] = useState<string | null>(null);
  const [invoiceStatus, setInvoiceStatus] = useState<InvoiceStatus | "OVERDUE" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUpdatingItems, setIsUpdatingItems] = useState(false);
  const [isSendingInvoice, setIsSendingInvoice] = useState(false);
  const [isMarkingPaid, setIsMarkingPaid] = useState(false);

  const summary = useMemo(
    () => computeInvoiceSummary(items, invoiceDiscountType, invoiceDiscountValue),
    [invoiceDiscountType, invoiceDiscountValue, items]
  );
  const totalCents = summary.totalCents;

  useEffect(() => {
    setMilestones((previous) => {
      const fallback = createDefaultMilestones(kind, totalCents, dpPercentage);
      if (kind === InvoiceKind.FULL) {
        const current = previous.find((item) => item.type === PaymentMilestoneType.FULL);
        return [{ ...fallback[0], dueDate: current?.dueDate ?? "" }];
      }

      const currentDp = previous.find((item) => item.type === PaymentMilestoneType.DP);
      const currentFinal = previous.find((item) => item.type === PaymentMilestoneType.FINAL);
      return [
        { ...fallback[0], dueDate: currentDp?.dueDate ?? "" },
        { ...fallback[1], dueDate: currentFinal?.dueDate ?? "" }
      ];
    });
  }, [dpPercentage, kind, totalCents]);

  useEffect(() => {
    if (!open) {
      setKind(InvoiceKind.FULL);
      setItems(createDefaultItems());
      setInvoiceDiscountType("%");
      setInvoiceDiscountValue(0);
      setNotes("");
      setTerms("");
      setDpPercentage(50);
      setMilestones(createDefaultMilestones(InvoiceKind.FULL, 0));
      setInvoiceDueDate("");
      setInvoiceId(null);
      setInvoiceNo(null);
      setInvoiceStatus(null);
      setError(null);
      setSuccess(null);
      setIsSubmitting(false);
      setIsUpdatingItems(false);
      setIsSendingInvoice(false);
      setIsMarkingPaid(false);
    }
  }, [open]);

  function updateItem(index: number, next: Partial<InvoiceItemDraft>) {
    setItems((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...next } : item))
    );
  }

  function addItem() {
    setItems((current) => [
      ...current,
      {
        id: makeId("item"),
        name: "",
        qty: 1,
        priceCents: 0,
        unit: "",
        description: "",
        discountType: "%",
        discountValue: 0,
        taxLabel: ""
      }
    ]);
  }

  function addItemFromCatalog(item: { name: string; unit?: string; priceCents: number }) {
    setItems((current) => [
      ...current,
      {
        id: makeId("catalog-item"),
        name: item.name,
        qty: 1,
        priceCents: Math.max(0, Math.floor(item.priceCents)),
        unit: item.unit ?? "",
        description: "",
        discountType: "%",
        discountValue: 0,
        taxLabel: ""
      }
    ]);
  }

  function removeItem(index: number) {
    setItems((current) =>
      current.length <= 1 ? current : current.filter((_, itemIndex) => itemIndex !== index)
    );
  }

  function updateMilestone(index: number, next: Partial<MilestoneDraft>) {
    setMilestones((current) =>
      current.map((milestone, milestoneIndex) =>
        milestoneIndex === index ? { ...milestone, ...next } : milestone
      )
    );
  }

  function buildPayload() {
    const normalizedItems = items.map((item) => ({
      name: item.name.trim(),
      qty: Math.max(1, Math.floor(item.qty || 0)),
      priceCents: Math.max(0, Math.floor(item.priceCents || 0)),
      unit: item.unit.trim() || undefined,
      description: item.description.trim() || undefined,
      discountType: item.discountType,
      discountValue: Math.max(0, Math.floor(item.discountValue || 0)),
      taxLabel: item.taxLabel || undefined
    }));

    const normalizedMilestones = milestones.map((milestone) => ({
      type: milestone.type,
      amountCents: Math.max(0, Math.floor(milestone.amountCents)),
      dueDate: milestone.dueDate ? new Date(milestone.dueDate).toISOString() : undefined
    }));

    return {
      items: normalizedItems,
      invoiceDiscountType,
      invoiceDiscountValue: Math.max(0, Math.floor(invoiceDiscountValue || 0)),
      milestones: normalizedMilestones
    };
  }

  async function handleCreateInvoice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!customerId || isSubmitting) {
      return;
    }

    setError(null);
    setSuccess(null);
    setIsSubmitting(true);
    try {
      const payload = buildPayload();
      const response = await fetch("/api/invoices", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          customerId,
          conversationId: conversationId ?? undefined,
          customerDisplayNameSnapshot: customerDisplayNameSnapshot?.trim() || undefined,
          kind,
          currency: "IDR",
          notes: notes.trim() || undefined,
          terms: terms.trim() || undefined,
          dueDate: invoiceDueDate ? new Date(invoiceDueDate).toISOString() : undefined,
          items: payload.items,
          invoiceDiscountType: payload.invoiceDiscountType,
          invoiceDiscountValue: payload.invoiceDiscountValue,
          milestones: payload.milestones
        })
      });

      const body = (await response.json().catch(() => null)) as CreateInvoiceResponse | null;
      if (!response.ok) {
        setError(body?.error?.message ?? "Failed to create invoice.");
        return;
      }

      const created = body?.data?.invoice;
      setInvoiceId(created?.id ?? null);
      setInvoiceNo(created?.invoiceNo ?? null);
      setInvoiceStatus(created?.status ?? InvoiceStatus.DRAFT);
      setSuccess(`Draft invoice ${created?.invoiceNo ?? ""} created.`);
    } catch {
      setError("Network error while creating invoice.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleUpdateItems() {
    if (!invoiceId || isUpdatingItems) {
      return;
    }

    setError(null);
    setSuccess(null);
    setIsUpdatingItems(true);
    try {
      const payload = buildPayload();
      const response = await fetch(`/api/invoices/${encodeURIComponent(invoiceId)}/items`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          customerDisplayNameSnapshot: customerDisplayNameSnapshot?.trim() || undefined,
          items: payload.items,
          notes: notes.trim() || undefined,
          terms: terms.trim() || undefined,
          invoiceDiscountType: payload.invoiceDiscountType,
          invoiceDiscountValue: payload.invoiceDiscountValue,
          milestones: payload.milestones
        })
      });

      const body = (await response.json().catch(() => null)) as EditInvoiceResponse | null;
      if (!response.ok) {
        setError(body?.error?.message ?? "Failed to update invoice items.");
        return;
      }

      setSuccess(`Draft invoice ${body?.data?.invoice?.invoiceNo ?? invoiceNo ?? ""} updated.`);
      setInvoiceStatus(body?.data?.invoice?.status ?? invoiceStatus ?? InvoiceStatus.DRAFT);
    } catch {
      setError("Network error while updating invoice.");
    } finally {
      setIsUpdatingItems(false);
    }
  }

  async function handleSendInvoice() {
    if (!invoiceId || isSendingInvoice) {
      return;
    }

    setError(null);
    setSuccess(null);
    setIsSendingInvoice(true);
    try {
      const response = await fetch(`/api/invoices/${encodeURIComponent(invoiceId)}/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        }
      });

      const body = (await response.json().catch(() => null)) as SendInvoiceResponse | null;
      if (!response.ok) {
        setError(body?.error?.message ?? "Failed to send invoice.");
        return;
      }

      const sent = body?.data?.invoice;
      setInvoiceStatus(sent?.status ?? InvoiceStatus.SENT);
      setSuccess(`Invoice sent to customer. Link: ${sent?.publicLink ?? "-"}`);
    } catch {
      setError("Network error while sending invoice.");
    } finally {
      setIsSendingInvoice(false);
    }
  }

  async function handleMarkPaid(milestoneType?: PaymentMilestoneType) {
    if (!invoiceId || isMarkingPaid) {
      return;
    }

    setError(null);
    setSuccess(null);
    setIsMarkingPaid(true);
    try {
      const response = await fetch(`/api/invoices/${encodeURIComponent(invoiceId)}/mark-paid`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          milestoneType
        })
      });

      const body = (await response.json().catch(() => null)) as MarkPaidResponse | null;
      if (!response.ok) {
        setError(body?.error?.message ?? "Failed to mark invoice paid.");
        return;
      }

      const updated = body?.data?.invoice;
      setInvoiceStatus(updated?.status ?? InvoiceStatus.PAID);
      setSuccess(`Invoice status updated: ${updated?.status ?? "PAID"}.`);
    } catch {
      setError("Network error while marking invoice paid.");
    } finally {
      setIsMarkingPaid(false);
    }
  }

  return {
    kind,
    setKind,
    items,
    milestones,
    invoiceDiscountType,
    setInvoiceDiscountType,
    invoiceDiscountValue,
    setInvoiceDiscountValue,
    notes,
    setNotes,
    terms,
    setTerms,
    dpPercentage,
    setDpPercentage,
    invoiceDueDate,
    setInvoiceDueDate,
    invoiceId,
    invoiceNo,
    invoiceStatus,
    error,
    success,
    isSubmitting,
    isUpdatingItems,
    isSendingInvoice,
    isMarkingPaid,
    summary,
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
  };
}
