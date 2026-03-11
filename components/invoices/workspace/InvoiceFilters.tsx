"use client";

import type { InvoiceStatus } from "@prisma/client";

import type { OrgItem } from "@/components/invoices/workspace/types";

type InvoiceFiltersProps = {
  orgs: OrgItem[];
  orgId: string;
  setOrgId: (value: string) => void;
  statusFilter: "ALL" | InvoiceStatus;
  setStatusFilter: (value: "ALL" | InvoiceStatus) => void;
  statusFilters: Array<"ALL" | InvoiceStatus>;
};

export function InvoiceFilters({ orgs, orgId, setOrgId, statusFilter, setStatusFilter, statusFilters }: InvoiceFiltersProps) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div>
        <label htmlFor="invoice-org" className="mb-1 block text-xs text-muted-foreground">
          Organization
        </label>
        <select
          id="invoice-org"
          value={orgId}
          onChange={(event) => setOrgId(event.target.value)}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        >
          {orgs.map((org) => (
            <option key={org.id} value={org.id}>
              {org.name}
            </option>
          ))}
        </select>
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
