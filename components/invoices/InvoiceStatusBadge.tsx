type InvoiceUiStatus = "DRAFT" | "SENT" | "PARTIALLY_PAID" | "PAID" | "OVERDUE" | "VOID";

type InvoiceStatusBadgeProps = {
  status: InvoiceUiStatus;
};

const STATUS_CLASS: Record<InvoiceUiStatus, string> = {
  DRAFT: "border-blue-500/40 bg-blue-500/10 text-blue-300",
  SENT: "border-indigo-500/40 bg-indigo-500/10 text-indigo-300",
  PARTIALLY_PAID: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  PAID: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  OVERDUE: "border-rose-500/40 bg-rose-500/10 text-rose-300",
  VOID: "border-zinc-500/40 bg-zinc-500/10 text-zinc-300"
};

export function InvoiceStatusBadge({ status }: InvoiceStatusBadgeProps) {
  return (
    <span className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-medium ${STATUS_CLASS[status]}`}>
      {status}
    </span>
  );
}

