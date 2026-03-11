"use client";

import { useEffect, useState } from "react";
import { useRef } from "react";

import { useModalAccessibility } from "@/lib/a11y/useModalAccessibility";

type AttachProofShortcutModalProps = {
  open: boolean;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (invoiceId: string, milestoneType?: "FULL" | "DP" | "FINAL") => Promise<void>;
};

export function AttachProofShortcutModal({ open, isSubmitting, onClose, onSubmit }: AttachProofShortcutModalProps) {
  const [invoiceId, setInvoiceId] = useState("");
  const [milestoneType, setMilestoneType] = useState<"" | "FULL" | "DP" | "FINAL">("");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  useModalAccessibility({
    open,
    onClose,
    containerRef,
    initialFocusRef: closeButtonRef
  });

  useEffect(() => {
    if (!open) {
      setInvoiceId("");
      setMilestoneType("");
    }
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Attach payment proof">
      <div ref={containerRef} className="mx-auto mt-24 w-full max-w-lg rounded-xl border border-border bg-surface p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Attach Payment Proof</h2>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="rounded-md border border-border px-2 py-1 text-xs text-foreground hover:bg-accent"
          >
            Close
          </button>
        </div>

        <div className="space-y-3">
          <input
            value={invoiceId}
            onChange={(event) => setInvoiceId(event.target.value)}
            placeholder="Invoice ID"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
          />
          <select
            value={milestoneType}
            onChange={(event) => setMilestoneType(event.target.value as "" | "FULL" | "DP" | "FINAL")}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
          >
            <option value="">No milestone</option>
            <option value="FULL">FULL</option>
            <option value="DP">DP</option>
            <option value="FINAL">FINAL</option>
          </select>
          <button
            type="button"
            disabled={isSubmitting || !invoiceId.trim()}
            onClick={() => {
              void onSubmit(invoiceId.trim(), milestoneType || undefined);
            }}
            className="rounded-md border border-border px-3 py-2 text-sm text-foreground hover:bg-accent disabled:opacity-50"
          >
            {isSubmitting ? "Attaching..." : "Attach Proof"}
          </button>
        </div>
      </div>
    </div>
  );
}
