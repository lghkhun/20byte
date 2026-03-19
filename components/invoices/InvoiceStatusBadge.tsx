type InvoiceUiStatus = "DRAFT" | "SENT" | "PARTIALLY_PAID" | "PAID" | "OVERDUE" | "VOID";

type InvoiceStatusBadgeProps = {
  status: InvoiceUiStatus;
};

const STATUS_CLASS: Record<InvoiceUiStatus, string> = {
  DRAFT: "border-blue-500/30 bg-blue-500/10 text-blue-700",
  SENT: "border-indigo-500/30 bg-indigo-500/10 text-indigo-700",
  PARTIALLY_PAID: "border-amber-500/30 bg-amber-500/10 text-amber-700",
  PAID: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700",
  OVERDUE: "border-rose-500/30 bg-rose-500/10 text-rose-700",
  VOID: "border-zinc-500/30 bg-zinc-500/10 text-zinc-700"
};

export function InvoiceStatusBadge({ status }: InvoiceStatusBadgeProps) {
  return (
    <span className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-medium ${STATUS_CLASS[status]}`}>
      {status}
    </span>
  );
}
