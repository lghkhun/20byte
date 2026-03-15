"use client";

import type { InvoiceStatus } from "@prisma/client";

type InvoiceFiltersProps = {
  businessName: string | null;
  statusFilter: "ALL" | InvoiceStatus;
  setStatusFilter: (value: "ALL" | InvoiceStatus) => void;
  statusFilters: Array<"ALL" | InvoiceStatus>;
};

export function InvoiceFilters({ businessName, statusFilter, setStatusFilter, statusFilters }: InvoiceFiltersProps) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="rounded-md border border-border bg-background px-3 py-2">
        <p className="mb-1 text-xs text-muted-foreground">Business</p>
        <p className="text-sm text-foreground">{businessName ?? "Primary business"}</p>
      </div>

      <div>
        <label htmlFor="invoice-status" className="mb-1 block text-xs text-muted-foreground">
          Status Filter
        </label>
        <select
          id="invoice-status"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as "ALL" | InvoiceStatus)}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        >
          {statusFilters.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
