"use client";

import type { InvoiceStatus, PaymentMilestoneType } from "@prisma/client";
import Link from "next/link";
import {
  type ColumnDef,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable
} from "@tanstack/react-table";
import { ArrowUpDown, ArrowUpRight, Copy, ExternalLink, FileText, MoreHorizontal, Search, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { InvoiceDrawer } from "@/components/invoices/InvoiceDrawer";
import { InvoiceStatusBadge } from "@/components/invoices/InvoiceStatusBadge";
import type { ApiError, InvoiceItem, InvoiceTimeline, OrgItem } from "@/components/invoices/workspace/types";
import { toErrorMessage } from "@/components/invoices/workspace/utils";
import { fetchOrganizationsCached } from "@/lib/client/orgsCache";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { OperationFeedback } from "@/components/ui/operation-feedback";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const STATUS_FILTERS: Array<"ALL" | InvoiceStatus> = ["ALL", "DRAFT", "SENT", "PARTIALLY_PAID", "PAID", "VOID"];

type CreateConversationResponse = {
  data?: {
    conversation?: {
      id: string;
      customerId: string;
      customerDisplayName: string | null;
      customerPhoneE164: string;
    };
  };
  error?: {
    message?: string;
  };
};

type CustomerOption = {
  id: string;
  displayName: string | null;
  phoneE164: string;
  latestConversationId: string | null;
};

type CustomersResponse = {
  data?: {
    customers?: CustomerOption[];
  };
  error?: {
    message?: string;
  };
};

type InvoiceDetail = {
  id: string;
  customerId: string;
  publicToken: string;
  invoiceNo: string;
  status: InvoiceStatus;
  kind: "FULL" | "DP_AND_FINAL";
  currency: string;
  subtotalCents: number;
  totalCents: number;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  conversationId: string | null;
  customerName: string | null;
  customerPhoneE164: string;
  items: Array<{
    id: string;
    name: string;
    description: string | null;
    qty: number;
    unit: string | null;
    priceCents: number;
    amountCents: number;
  }>;
  milestones: Array<{
    id: string;
    type: PaymentMilestoneType;
    amountCents: number;
    dueDate: string | null;
    status: string;
    paidAt: string | null;
  }>;
  bankAccounts: Array<{
    bankName: string;
    accountNumber: string;
    accountHolder: string;
  }>;
};

type InvoiceDetailResponse = {
  data?: {
    invoice?: InvoiceDetail;
  };
  error?: {
    message?: string;
  };
};

function formatMoney(amountCents: number, currency: string): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency,
    maximumFractionDigits: 0
  }).format(amountCents / 100);
}

function formatDateLabel(value: string | null): string {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(date);
}

function toPublicInvoicePath(publicToken: string): string {
  return `/i/${publicToken}`;
}

function headerSortLabel(title: string, onClick: () => void) {
  return (
    <Button type="button" variant="ghost" className="h-8 -ml-2 px-2 text-xs uppercase tracking-[0.18em] text-muted-foreground" onClick={onClick}>
      {title}
      <ArrowUpDown className="ml-2 h-3.5 w-3.5" />
    </Button>
  );
}

export function InvoicesWorkspace() {
  const [orgs, setOrgs] = useState<OrgItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<"ALL" | InvoiceStatus>("ALL");
  const [invoices, setInvoices] = useState<InvoiceItem[]>([]);
  const [totalInvoices, setTotalInvoices] = useState(0);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<InvoiceTimeline | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isMarkingPaid, setIsMarkingPaid] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isBulkActing, setIsBulkActing] = useState(false);

  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [invoiceDetail, setInvoiceDetail] = useState<InvoiceDetail | null>(null);

  const [isCreateInvoiceModalOpen, setIsCreateInvoiceModalOpen] = useState(false);
  const [isManualCustomerModalOpen, setIsManualCustomerModalOpen] = useState(false);
  const [customerOptions, setCustomerOptions] = useState<CustomerOption[]>([]);
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [customerSearchText, setCustomerSearchText] = useState("");
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");

  const [isPreparingInvoiceDrawer, setIsPreparingInvoiceDrawer] = useState(false);
  const [invoiceDraftContext, setInvoiceDraftContext] = useState<{
    customerId: string;
    conversationId: string;
    customerDisplayName: string | null;
    customerPhoneE164: string;
  } | null>(null);
  const [isInvoiceDrawerOpen, setIsInvoiceDrawerOpen] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const selectedInvoice = useMemo(() => invoices.find((item) => item.id === selectedInvoiceId) ?? null, [invoices, selectedInvoiceId]);
  const activeBusiness = useMemo(() => orgs[0] ?? null, [orgs]);

  const summary = useMemo(() => {
    return invoices.reduce(
      (accumulator, invoice) => {
        if (invoice.status === "PAID") {
          accumulator.paid += 1;
          accumulator.revenue += invoice.totalCents;
        } else if (invoice.status !== "VOID") {
          accumulator.unpaid += 1;
        }
        return accumulator;
      },
      { paid: 0, unpaid: 0, revenue: 0 }
    );
  }, [invoices]);

  const selectedCustomer = useMemo(() => customerOptions.find((customer) => customer.id === selectedCustomerId) ?? null, [customerOptions, selectedCustomerId]);
  const totalPages = Math.max(1, Math.ceil(totalInvoices / pageSize));

  const loadOrganizations = useCallback(async () => {
    const organizations = (await fetchOrganizationsCached()) as OrgItem[];
    setOrgs(organizations);
  }, []);

  const loadInvoices = useCallback(async () => {
    setIsLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(pageSize) });
    if (statusFilter !== "ALL") {
      params.set("status", statusFilter);
    }
    if (searchQuery.trim()) {
      params.set("q", searchQuery.trim());
    }

    try {
      const response = await fetch(`/api/invoices?${params.toString()}`, { cache: "no-store" });
      const payload = (await response.json()) as { data?: { invoices?: InvoiceItem[] }; meta?: { total?: number } } & ApiError;
      if (!response.ok) {
        throw new Error(payload.error?.message ?? "Failed to load invoices.");
      }

      const rows = payload.data?.invoices ?? [];
      setInvoices(rows);
      setTotalInvoices(payload.meta?.total ?? rows.length);
      setSelectedInvoiceId((current) => (current && rows.some((row) => row.id === current) ? current : rows[0]?.id ?? null));
      if (rows.length === 0) {
        setTimeline(null);
      }
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, searchQuery, statusFilter]);

  const loadTimeline = useCallback(async () => {
    if (!selectedInvoiceId) {
      setTimeline(null);
      return;
    }

    const response = await fetch(`/api/invoices/${encodeURIComponent(selectedInvoiceId)}/timeline`, { cache: "no-store" });
    const payload = (await response.json()) as { data?: { timeline?: InvoiceTimeline } } & ApiError;
    if (!response.ok) {
      throw new Error(payload.error?.message ?? "Failed to load invoice timeline.");
    }

    setTimeline(payload.data?.timeline ?? null);
  }, [selectedInvoiceId]);

  const loadInvoiceDetail = useCallback(async (invoiceId: string) => {
    setIsLoadingDetail(true);
    try {
      const response = await fetch(`/api/invoices/${encodeURIComponent(invoiceId)}`, { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as InvoiceDetailResponse | null;
      if (!response.ok || !payload?.data?.invoice) {
        throw new Error(payload?.error?.message ?? "Failed to load invoice detail.");
      }

      setInvoiceDetail(payload.data.invoice);
    } catch (detailError) {
      setError(toErrorMessage(detailError, "Failed to load invoice detail."));
    } finally {
      setIsLoadingDetail(false);
    }
  }, []);

  const loadCustomers = useCallback(async () => {
    setIsLoadingCustomers(true);
    try {
      const params = new URLSearchParams({
        page: "1",
        limit: "20",
        light: "1"
      });
      if (customerSearchText.trim()) {
        params.set("q", customerSearchText.trim());
      }

      const response = await fetch(`/api/customers?${params.toString()}`, { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as CustomersResponse | null;
      if (!response.ok) {
        throw new Error(payload?.error?.message ?? "Failed to load customers.");
      }

      setCustomerOptions(payload?.data?.customers ?? []);
    } catch (loadError) {
      setError(toErrorMessage(loadError, "Failed to load customers."));
    } finally {
      setIsLoadingCustomers(false);
    }
  }, [customerSearchText]);

  const sendInvoiceById = useCallback(
    async (invoiceId: string) => {
      if (!invoiceId || isSending) {
        return;
      }

      try {
        setError(null);
        setSuccess(null);
        setIsSending(true);
        const response = await fetch(`/api/invoices/${encodeURIComponent(invoiceId)}/send`, { method: "POST" });
        const payload = (await response.json()) as { data?: { invoice?: { publicLink?: string } } } & ApiError;
        if (!response.ok) {
          throw new Error(payload.error?.message ?? "Failed to send invoice.");
        }

        setSuccess(`Invoice sent. ${payload.data?.invoice?.publicLink ?? ""}`.trim());
        if (page !== 1) {
          setPage(1);
        } else {
          await loadInvoices();
        }
        if (selectedInvoiceId === invoiceId) {
          await loadTimeline();
          await loadInvoiceDetail(invoiceId);
        }
      } catch (err) {
        setError(toErrorMessage(err, "Failed to send invoice."));
      } finally {
        setIsSending(false);
      }
    },
    [isSending, loadInvoiceDetail, loadInvoices, loadTimeline, page, selectedInvoiceId]
  );

  const deleteInvoiceById = useCallback(
    async (invoiceId: string) => {
      if (!invoiceId || isDeleting) {
        return;
      }

      try {
        setError(null);
        setSuccess(null);
        setIsDeleting(true);

        const response = await fetch(`/api/invoices/${encodeURIComponent(invoiceId)}`, {
          method: "DELETE"
        });
        const payload = (await response.json().catch(() => null)) as ApiError | null;
        if (!response.ok) {
          throw new Error(payload?.error?.message ?? "Failed to delete invoice.");
        }

        setSuccess("Invoice berhasil dihapus.");
        const nextPage = invoices.length === 1 && page > 1 ? page - 1 : page;
        if (nextPage !== page) {
          setPage(nextPage);
        } else {
          await loadInvoices();
        }
        setIsDetailModalOpen(false);
      } catch (deleteError) {
        setError(toErrorMessage(deleteError, "Failed to delete invoice."));
      } finally {
        setIsDeleting(false);
      }
    },
    [invoices.length, isDeleting, loadInvoices, page]
  );

  const bulkSendDraftByIds = useCallback(
    async (invoiceIds: string[]) => {
      if (invoiceIds.length === 0) {
        return;
      }

      const failures: string[] = [];
      for (const invoiceId of invoiceIds) {
        // Sequential request keeps timeline updates stable and avoids API burst.
        // eslint-disable-next-line no-await-in-loop
        const response = await fetch(`/api/invoices/${encodeURIComponent(invoiceId)}/send`, { method: "POST" });
        if (!response.ok) {
          failures.push(invoiceId);
        }
      }

      if (failures.length > 0) {
        throw new Error(`Failed to send ${failures.length} draft invoice(s).`);
      }
    },
    []
  );

  const bulkDeleteDraftByIds = useCallback(
    async (invoiceIds: string[]) => {
      if (invoiceIds.length === 0) {
        return;
      }

      const failures: string[] = [];
      for (const invoiceId of invoiceIds) {
        // Sequential request keeps deletion deterministic and easier to trace.
        // eslint-disable-next-line no-await-in-loop
        const response = await fetch(`/api/invoices/${encodeURIComponent(invoiceId)}`, { method: "DELETE" });
        if (!response.ok) {
          failures.push(invoiceId);
        }
      }

      if (failures.length > 0) {
        throw new Error(`Failed to delete ${failures.length} draft invoice(s).`);
      }
    },
    []
  );

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        await loadOrganizations();
      } catch (err) {
        if (mounted) {
          setError(toErrorMessage(err, "Failed to initialize invoice system."));
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [loadOrganizations]);

  useEffect(() => {
    void loadInvoices().catch((err) => {
      setError(toErrorMessage(err, "Failed to refresh invoices."));
    });
  }, [loadInvoices]);

  useEffect(() => {
    void loadTimeline().catch((err) => {
      setError(toErrorMessage(err, "Failed to refresh invoice timeline."));
    });
  }, [loadTimeline]);

  useEffect(() => {
    if (!isCreateInvoiceModalOpen || isLoadingCustomers) {
      return;
    }

    void loadCustomers();
  }, [isCreateInvoiceModalOpen, isLoadingCustomers, loadCustomers]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearchQuery(searchInput.trim());
      setPage(1);
    }, 250);

    return () => {
      window.clearTimeout(timer);
    };
  }, [searchInput]);

  const columns = useMemo<ColumnDef<InvoiceItem>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(Boolean(value))}
            aria-label="Select all"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(Boolean(value))}
            aria-label="Select row"
          />
        ),
        enableSorting: false,
        enableHiding: false
      },
      {
        accessorKey: "invoiceNo",
        header: ({ column }) => headerSortLabel("Number", () => column.toggleSorting(column.getIsSorted() === "asc")),
        cell: ({ row }) => (
          <button
            type="button"
            className="font-semibold text-indigo-600"
            onClick={() => {
              setSelectedInvoiceId(row.original.id);
              setIsDetailModalOpen(true);
              void loadInvoiceDetail(row.original.id);
            }}
          >
            {row.original.invoiceNo}
          </button>
        )
      },
      {
        id: "customer",
        accessorFn: (row) => `${row.customerName ?? ""} ${row.customerPhoneE164}`,
        header: ({ column }) => headerSortLabel("Customer", () => column.toggleSorting(column.getIsSorted() === "asc")),
        cell: ({ row }) => (
          <div>
            <p className="font-medium text-foreground">{row.original.customerName?.trim() || row.original.customerPhoneE164}</p>
            <p className="text-sm text-muted-foreground">{row.original.customerPhoneE164}</p>
          </div>
        )
      },
      {
        accessorKey: "publicToken",
        header: ({ column }) => headerSortLabel("Public Link", () => column.toggleSorting(column.getIsSorted() === "asc")),
        cell: ({ row }) => {
          const path = toPublicInvoicePath(row.original.publicToken);
          return (
            <a
              href={path}
              target="_blank"
              rel="noreferrer"
              className="inline-flex max-w-[190px] items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              title={path}
              onClick={(event) => {
                event.stopPropagation();
              }}
            >
              <span className="truncate">{path}</span>
              <ExternalLink className="h-3.5 w-3.5 shrink-0" />
            </a>
          );
        }
      },
      {
        accessorKey: "createdAt",
        header: ({ column }) => headerSortLabel("Date", () => column.toggleSorting(column.getIsSorted() === "asc")),
        cell: ({ row }) => <span className="text-sm text-muted-foreground">{formatDateLabel(row.original.createdAt)}</span>
      },
      {
        accessorKey: "totalCents",
        header: ({ column }) => headerSortLabel("Amount", () => column.toggleSorting(column.getIsSorted() === "asc")),
        cell: ({ row }) => <span className="font-semibold text-foreground">{formatMoney(row.original.totalCents, row.original.currency)}</span>
      },
      {
        accessorKey: "status",
        header: ({ column }) => headerSortLabel("Status", () => column.toggleSorting(column.getIsSorted() === "asc")),
        cell: ({ row }) => <InvoiceStatusBadge status={row.original.status} />
      },
      {
        id: "actions",
        enableHiding: false,
        cell: ({ row }) => {
          const invoice = row.original;
          return (
            <div className="flex justify-end">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="ghost" className="h-8 w-8 p-0" onClick={(event) => event.stopPropagation()}>
                    <span className="sr-only">Open actions</span>
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Invoice Actions</DropdownMenuLabel>
                  <DropdownMenuItem
                    onClick={() => {
                      setSelectedInvoiceId(invoice.id);
                      setIsDetailModalOpen(true);
                      void loadInvoiceDetail(invoice.id);
                    }}
                  >
                    View detail
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={invoice.status !== "DRAFT" && invoice.status !== "SENT"}
                    onClick={() => {
                      void sendInvoiceById(invoice.id);
                    }}
                  >
                    Send invoice
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link prefetch={false} href={invoice.conversationId ? `/inbox?conversationId=${encodeURIComponent(invoice.conversationId)}` : "/inbox"}>
                      Open CRM Panel
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive"
                    disabled={invoice.status !== "DRAFT" && invoice.status !== "VOID"}
                    onClick={() => {
                      void deleteInvoiceById(invoice.id);
                    }}
                  >
                    Delete draft/void
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        }
      }
    ],
    [deleteInvoiceById, loadInvoiceDetail, sendInvoiceById]
  );

  const table = useReactTable({
    data: invoices,
    columns,
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: {
      sorting,
      columnVisibility,
      rowSelection
    },
    initialState: {
      columnVisibility: {}
    }
  });

  const selectedRows = table.getSelectedRowModel().rows.map((row) => row.original);
  const selectedDraftIds = selectedRows.filter((item) => item.status === "DRAFT").map((item) => item.id);

  async function handleBulkSend() {
    if (selectedDraftIds.length === 0 || isBulkActing) {
      return;
    }

    try {
      setIsBulkActing(true);
      setError(null);
      setSuccess(null);

      await bulkSendDraftByIds(selectedDraftIds);
      setSuccess(`Draft invoices sent (${selectedDraftIds.length}).`);
      if (page !== 1) {
        setPage(1);
      } else {
        await loadInvoices();
      }
      if (selectedInvoiceId && selectedDraftIds.includes(selectedInvoiceId)) {
        await loadTimeline();
        await loadInvoiceDetail(selectedInvoiceId);
      }
      setRowSelection({});
    } catch (bulkError) {
      setError(toErrorMessage(bulkError, "Bulk send failed."));
    } finally {
      setIsBulkActing(false);
    }
  }

  async function handleBulkDelete() {
    if (selectedDraftIds.length === 0 || isBulkActing) {
      return;
    }

    try {
      setIsBulkActing(true);
      setError(null);
      setSuccess(null);

      const shouldRefreshDetail = Boolean(selectedInvoiceId && selectedDraftIds.includes(selectedInvoiceId));
      await bulkDeleteDraftByIds(selectedDraftIds);
      setSuccess(`Draft invoices deleted (${selectedDraftIds.length}).`);
      const nextPage = invoices.length === selectedDraftIds.length && page > 1 ? page - 1 : page;
      if (nextPage !== page) {
        setPage(nextPage);
      } else {
        await loadInvoices();
      }
      if (shouldRefreshDetail) {
        setIsDetailModalOpen(false);
      }
      setRowSelection({});
    } catch (bulkError) {
      setError(toErrorMessage(bulkError, "Bulk delete failed."));
    } finally {
      setIsBulkActing(false);
    }
  }

  async function handleMarkPaid(milestoneType?: PaymentMilestoneType) {
    if (!selectedInvoice || isMarkingPaid) {
      return;
    }

    try {
      setError(null);
      setSuccess(null);
      setIsMarkingPaid(true);
      const response = await fetch(`/api/invoices/${encodeURIComponent(selectedInvoice.id)}/mark-paid`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ milestoneType })
      });
      const payload = (await response.json()) as ApiError;
      if (!response.ok) {
        throw new Error(payload.error?.message ?? "Failed to mark invoice paid.");
      }

      setSuccess("Invoice payment status updated.");
      await loadInvoices();
      await loadTimeline();
      await loadInvoiceDetail(selectedInvoice.id);
    } catch (err) {
      setError(toErrorMessage(err, "Failed to mark invoice paid."));
    } finally {
      setIsMarkingPaid(false);
    }
  }

  async function ensureConversationForCustomer(input: {
    customerId: string;
    customerDisplayName: string | null;
    customerPhoneE164: string;
    latestConversationId: string | null;
  }) {
    if (input.latestConversationId) {
      return {
        customerId: input.customerId,
        conversationId: input.latestConversationId,
        customerDisplayName: input.customerDisplayName,
        customerPhoneE164: input.customerPhoneE164
      };
    }

    const response = await fetch("/api/conversations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        phoneE164: input.customerPhoneE164,
        customerDisplayName: input.customerDisplayName ?? undefined
      })
    });
    const payload = (await response.json().catch(() => null)) as CreateConversationResponse | null;
    if (!response.ok) {
      throw new Error(payload?.error?.message ?? "Failed to prepare customer conversation.");
    }

    const conversation = payload?.data?.conversation;
    if (!conversation?.id || !conversation.customerId) {
      throw new Error("Conversation context is incomplete.");
    }

    return {
      customerId: conversation.customerId,
      conversationId: conversation.id,
      customerDisplayName: conversation.customerDisplayName,
      customerPhoneE164: conversation.customerPhoneE164
    };
  }

  async function handleCreateInvoiceFromInvoices() {
    const hasSelectedCustomer = Boolean(selectedCustomer);
    const hasManualPhone = Boolean(newCustomerPhone.trim());

    if ((!hasSelectedCustomer && !hasManualPhone) || isPreparingInvoiceDrawer) {
      return;
    }

    try {
      setError(null);
      setSuccess(null);
      setIsPreparingInvoiceDrawer(true);

      let context: {
        customerId: string;
        conversationId: string;
        customerDisplayName: string | null;
        customerPhoneE164: string;
      };

      if (selectedCustomer) {
        context = await ensureConversationForCustomer({
          customerId: selectedCustomer.id,
          customerDisplayName: selectedCustomer.displayName,
          customerPhoneE164: selectedCustomer.phoneE164,
          latestConversationId: selectedCustomer.latestConversationId
        });
      } else {
        const response = await fetch("/api/conversations", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            phoneE164: newCustomerPhone.trim(),
            customerDisplayName: newCustomerName.trim() || undefined
          })
        });
        const payload = (await response.json().catch(() => null)) as CreateConversationResponse | null;
        if (!response.ok) {
          throw new Error(payload?.error?.message ?? "Failed to prepare customer conversation.");
        }

        const conversation = payload?.data?.conversation;
        if (!conversation?.id || !conversation.customerId) {
          throw new Error("Conversation context is incomplete.");
        }

        context = {
          customerId: conversation.customerId,
          conversationId: conversation.id,
          customerDisplayName: conversation.customerDisplayName,
          customerPhoneE164: conversation.customerPhoneE164
        };
      }

      setInvoiceDraftContext(context);
      setIsCreateInvoiceModalOpen(false);
      setIsInvoiceDrawerOpen(true);
      setSuccess("Customer conversation ready. Lanjutkan susun invoice draft.");
    } catch (err) {
      setError(toErrorMessage(err, "Failed to start invoice creation."));
    } finally {
      setIsPreparingInvoiceDrawer(false);
    }
  }

  async function handleCopyPublicLink(publicToken: string) {
    try {
      const path = toPublicInvoicePath(publicToken);
      const absoluteLink = `${window.location.origin}${path}`;
      await navigator.clipboard.writeText(absoluteLink);
      setSuccess("Public invoice link copied.");
    } catch {
      setError("Failed to copy public invoice link.");
    }
  }

  return (
    <section className="flex h-full min-h-0 flex-1 flex-col space-y-3 p-3 md:space-y-4 md:p-5">
      <div className="rounded-2xl border border-border/70 bg-card/95 shadow-sm">
        <div className="flex flex-wrap items-center gap-3 px-4 py-4 md:gap-4 md:px-6 md:py-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-500 md:h-11 md:w-11 md:rounded-2xl">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground md:text-3xl">Invoice System</h1>
            <p className="text-xs text-muted-foreground md:text-sm">Kelola invoice, pengiriman, pelunasan, dan sinkronisasi stage CRM dari satu workspace.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-border/70 px-4 py-3 text-xs md:px-6 md:py-4 md:text-sm">
          <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-primary">All Invoices</span>
          <Button
            type="button"
            variant="secondary"
            className="h-8 rounded-full border border-border/80 bg-background px-3"
            onClick={() => {
              setSelectedCustomerId("");
              setCustomerSearchText("");
              setNewCustomerName("");
              setNewCustomerPhone("");
              setIsCreateInvoiceModalOpen(true);
            }}
          >
            Create Invoice
          </Button>
          <Link href="/inbox" prefetch={false} className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1 text-muted-foreground hover:text-foreground">
            Buka Inbox CRM
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3 md:gap-4">
        <article className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 md:rounded-2xl md:p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-600 md:text-sm">Paid invoices</p>
          <p className="mt-2 text-2xl font-semibold text-emerald-700 md:mt-3 md:text-4xl">{summary.paid}</p>
        </article>
        <article className="rounded-xl border border-rose-200 bg-rose-50/70 p-4 md:rounded-2xl md:p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-600 md:text-sm">Unpaid invoices</p>
          <p className="mt-2 text-2xl font-semibold text-rose-700 md:mt-3 md:text-4xl">{summary.unpaid}</p>
        </article>
        <article className="rounded-xl border border-blue-200 bg-blue-50/70 p-4 md:rounded-2xl md:p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600 md:text-sm">Total revenue</p>
          <p className="mt-2 text-2xl font-semibold text-blue-700 md:mt-3 md:text-4xl">{formatMoney(summary.revenue, "IDR")}</p>
        </article>
      </div>

      <section className="flex min-h-0 flex-1 flex-col rounded-2xl border border-border/70 bg-card/95 p-3 shadow-sm md:p-5">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-foreground md:text-3xl">Invoices</h2>
            <p className="text-xs text-muted-foreground md:text-sm">{activeBusiness?.name ?? "Business"} invoice registry</p>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 md:w-auto">
            <label className="relative block w-full md:w-auto">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search..."
                className="h-9 rounded-lg pl-10 md:h-10 md:rounded-xl"
              />
            </label>
            <Select
              value={statusFilter}
              onValueChange={(value) => {
                setStatusFilter(value as "ALL" | InvoiceStatus);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-9 w-full rounded-lg md:h-10 md:w-[180px] md:rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_FILTERS.map((filter) => (
                  <SelectItem key={filter} value={filter}>
                    {filter}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="secondary" className="h-9 rounded-lg border border-border/80 bg-background md:h-10 md:rounded-xl">
                  Columns
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {table
                  .getAllColumns()
                  .filter((column) => column.getCanHide())
                  .map((column) => (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      className="capitalize"
                      checked={column.getIsVisible()}
                      onCheckedChange={(value) => column.toggleVisibility(Boolean(value))}
                    >
                      {column.id}
                    </DropdownMenuCheckboxItem>
                  ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {selectedRows.length > 0 ? (
          <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-border/80 bg-background/60 px-3 py-2">
            <p className="text-sm text-muted-foreground">{selectedRows.length} selected</p>
            <Button type="button" size="sm" onClick={() => void handleBulkSend()} disabled={isBulkActing || selectedDraftIds.length === 0}>
              Send Draft ({selectedDraftIds.length})
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              onClick={() => void handleBulkDelete()}
              disabled={isBulkActing || selectedDraftIds.length === 0}
            >
              Delete Draft ({selectedDraftIds.length})
            </Button>
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-border/70 md:rounded-2xl">
          <Table className="min-w-[920px]">
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id}>
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                    Loading invoices...
                  </TableCell>
                </TableRow>
              ) : table.getRowModel().rows.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() ? "selected" : undefined}
                    className={row.original.id === selectedInvoiceId ? "bg-primary/5" : ""}
                    onDoubleClick={() => {
                      setSelectedInvoiceId(row.original.id);
                      setIsDetailModalOpen(true);
                      void loadInvoiceDetail(row.original.id);
                    }}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                    No invoices found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">{totalInvoices} invoices</p>
          <div className="flex items-center gap-2">
            <Select
              value={String(pageSize)}
              onValueChange={(value) => {
                setPageSize(Number(value));
                setPage(1);
              }}
            >
              <SelectTrigger className="h-9 w-[120px] rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10 rows</SelectItem>
                <SelectItem value="20">20 rows</SelectItem>
                <SelectItem value="50">50 rows</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground md:text-sm">
              Halaman {page} / {totalPages}
            </span>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="border border-border/80 bg-background"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page <= 1}
            >
              Previous
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="border border-border/80 bg-background"
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              disabled={page >= totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        {error ? <OperationFeedback tone="error" message={error} /> : null}
        {success ? <OperationFeedback tone="success" message={success} /> : null}
      </div>

      <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
        <DialogContent className="max-h-[92vh] overflow-auto sm:max-w-[1080px]">
          <DialogHeader>
            <DialogTitle>Invoice Detail</DialogTitle>
            <DialogDescription>Detail invoice dengan format dokumen invoice standar dan aksi CRUD.</DialogDescription>
          </DialogHeader>

          {isLoadingDetail || !invoiceDetail ? (
            <p className="text-sm text-muted-foreground">Loading detail invoice...</p>
          ) : (
            <div className="space-y-5">
              <div className="rounded-xl border border-border/70 bg-background/40 p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Invoice Document</p>
                    <h3 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">{invoiceDetail.invoiceNo}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Created: {formatDateLabel(invoiceDetail.createdAt)} | Due: {formatDateLabel(invoiceDetail.dueDate)}
                    </p>
                  </div>
                  <InvoiceStatusBadge status={invoiceDetail.status} />
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <div className="rounded-lg border border-border/70 p-3">
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">From</p>
                    <p className="mt-2 text-sm font-medium text-foreground">{activeBusiness?.name ?? "Your Business"}</p>
                  </div>
                  <div className="rounded-lg border border-border/70 p-3">
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Bill To</p>
                    <p className="mt-2 text-sm font-medium text-foreground">{invoiceDetail.customerName?.trim() || invoiceDetail.customerPhoneE164}</p>
                    <p className="text-sm text-muted-foreground">{invoiceDetail.customerPhoneE164}</p>
                  </div>
                </div>

                <div className="mt-4 rounded-lg border border-border/70 p-3">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Public Link Slug</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <a
                      href={toPublicInvoicePath(invoiceDetail.publicToken)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex max-w-full items-center gap-2 rounded-md border border-border/70 bg-background px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
                      title={toPublicInvoicePath(invoiceDetail.publicToken)}
                    >
                      <span className="max-w-[360px] truncate">{toPublicInvoicePath(invoiceDetail.publicToken)}</span>
                      <ExternalLink className="h-4 w-4 shrink-0" />
                    </a>
                    <Button type="button" size="sm" variant="secondary" className="border border-border/80 bg-background" onClick={() => void handleCopyPublicLink(invoiceDetail.publicToken)}>
                      <Copy className="mr-2 h-3.5 w-3.5" />
                      Copy Link
                    </Button>
                  </div>
                </div>

                <div className="mt-5 overflow-auto rounded-lg border border-border/70">
                  <Table className="min-w-[640px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead>Qty</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead className="text-right">Subtotal</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invoiceDetail.items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <p className="font-medium text-foreground">{item.name}</p>
                            {item.description ? <p className="text-xs text-muted-foreground">{item.description}</p> : null}
                          </TableCell>
                          <TableCell>
                            {item.qty}
                            {item.unit ? ` ${item.unit}` : ""}
                          </TableCell>
                          <TableCell>{formatMoney(item.priceCents, invoiceDetail.currency)}</TableCell>
                          <TableCell className="text-right font-semibold">{formatMoney(item.amountCents, invoiceDetail.currency)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="mt-4 flex justify-end">
                  <div className="w-full max-w-xs space-y-1 rounded-lg border border-border/70 bg-background/50 p-3 text-sm">
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>Subtotal</span>
                      <span>{formatMoney(invoiceDetail.subtotalCents, invoiceDetail.currency)}</span>
                    </div>
                    <div className="flex items-center justify-between text-base font-semibold text-foreground">
                      <span>Total</span>
                      <span>{formatMoney(invoiceDetail.totalCents, invoiceDetail.currency)}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-border/70 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Payment Milestones</p>
                  <div className="mt-3 space-y-2">
                    {invoiceDetail.milestones.map((milestone) => (
                      <article key={milestone.id} className="rounded-lg border border-border/70 p-3">
                        <p className="text-sm font-medium text-foreground">{milestone.type}</p>
                        <p className="text-sm text-muted-foreground">{formatMoney(milestone.amountCents, invoiceDetail.currency)}</p>
                        <p className="text-xs text-muted-foreground">Due: {formatDateLabel(milestone.dueDate)}</p>
                        <p className="text-xs text-muted-foreground">Status: {milestone.status}</p>
                      </article>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-border/70 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Transfer Instructions</p>
                  <div className="mt-3 space-y-2">
                    {invoiceDetail.bankAccounts.length === 0 ? <p className="text-sm text-muted-foreground">No bank account configured.</p> : null}
                    {invoiceDetail.bankAccounts.map((account, index) => (
                      <article key={`${account.accountNumber}-${index}`} className="rounded-lg border border-border/70 p-3">
                        <p className="text-sm font-medium text-foreground">{account.bankName}</p>
                        <p className="text-xs text-muted-foreground">{account.accountNumber}</p>
                        <p className="text-xs text-muted-foreground">{account.accountHolder}</p>
                      </article>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-border/70 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Timeline</p>
                <div className="mt-3 space-y-2">
                  {timeline?.events?.map((event) => (
                    <article key={event.id} className="rounded-lg border border-border/70 p-3">
                      <p className="text-sm font-medium text-foreground">{event.label}</p>
                      <p className="text-xs text-muted-foreground">{formatDateLabel(event.at)}</p>
                    </article>
                  ))}
                  {!timeline?.events?.length ? <p className="text-sm text-muted-foreground">No timeline yet.</p> : null}
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            {invoiceDetail && invoiceDetail.status === "DRAFT" ? (
              <Button
                type="button"
                variant="secondary"
                className="border border-border/80 bg-background"
                onClick={() => {
                  if (!invoiceDetail.conversationId) {
                    setError("Invoice belum terhubung conversation. Buka dari inbox untuk edit.");
                    return;
                  }

                  setInvoiceDraftContext({
                    customerId: invoiceDetail.customerId,
                    conversationId: invoiceDetail.conversationId,
                    customerDisplayName: invoiceDetail.customerName,
                    customerPhoneE164: invoiceDetail.customerPhoneE164
                  });
                  setIsInvoiceDrawerOpen(true);
                }}
              >
                Edit Draft
              </Button>
            ) : null}
            {invoiceDetail ? (
              <Button
                type="button"
                onClick={() => void sendInvoiceById(invoiceDetail.id)}
                disabled={isSending || (invoiceDetail.status !== "DRAFT" && invoiceDetail.status !== "SENT")}
              >
                {isSending ? "Sending..." : "Send Invoice"}
              </Button>
            ) : null}
            {invoiceDetail?.kind === "DP_AND_FINAL" ? (
              <>
                <Button type="button" variant="secondary" className="border border-border/80 bg-background" onClick={() => void handleMarkPaid("DP")}
                  disabled={isMarkingPaid}>
                  Mark DP Paid
                </Button>
                <Button type="button" variant="secondary" className="border border-border/80 bg-background" onClick={() => void handleMarkPaid("FINAL")}
                  disabled={isMarkingPaid}>
                  Mark Final Paid
                </Button>
              </>
            ) : (
              invoiceDetail ? (
                <Button type="button" variant="secondary" className="border border-border/80 bg-background" onClick={() => void handleMarkPaid("FULL")}
                  disabled={isMarkingPaid}>
                  Mark Paid
                </Button>
              ) : null
            )}
            {invoiceDetail && (invoiceDetail.status === "DRAFT" || invoiceDetail.status === "VOID") ? (
              <Button type="button" variant="destructive" onClick={() => void deleteInvoiceById(invoiceDetail.id)} disabled={isDeleting}>
                <Trash2 className="mr-2 h-4 w-4" />
                {isDeleting ? "Deleting..." : "Delete"}
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isCreateInvoiceModalOpen} onOpenChange={setIsCreateInvoiceModalOpen}>
        <DialogContent className="sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle>Create Invoice from Invoices</DialogTitle>
            <DialogDescription>
              Pilih customer dari database (search-select). Sistem akan gunakan/buat conversation otomatis agar invoice tetap terhubung ke CRM.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Search Select Customer</p>
              <Input
                value={customerSearchText}
                onChange={(event) => {
                  setCustomerSearchText(event.target.value);
                  setSelectedCustomerId("");
                }}
                placeholder="Search customer name or WhatsApp..."
                className="h-10"
              />
              <div className="max-h-52 overflow-auto rounded-xl border border-border/70">
                {isLoadingCustomers ? (
                  <p className="px-3 py-3 text-sm text-muted-foreground">Loading customers...</p>
                ) : customerOptions.length === 0 ? (
                  <p className="px-3 py-3 text-sm text-muted-foreground">No customer found.</p>
                ) : (
                  <div className="divide-y divide-border/60">
                    {customerOptions.map((customer) => (
                      <button
                        key={customer.id}
                        type="button"
                        className={`flex w-full items-start justify-between px-3 py-2 text-left ${selectedCustomerId === customer.id ? "bg-primary/10" : "hover:bg-accent/40"}`}
                        onClick={() => {
                          setSelectedCustomerId(customer.id);
                        }}
                      >
                        <div>
                          <p className="text-sm font-medium text-foreground">{customer.displayName?.trim() || customer.phoneE164}</p>
                          <p className="text-xs text-muted-foreground">{customer.phoneE164}</p>
                        </div>
                        <span className="text-xs text-muted-foreground">{customer.latestConversationId ? "existing convo" : "no convo"}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

          </div>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setIsCreateInvoiceModalOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setSelectedCustomerId("");
                setNewCustomerName("");
                setNewCustomerPhone("");
                setIsCreateInvoiceModalOpen(false);
                setIsManualCustomerModalOpen(true);
              }}
            >
              Buat Manual
            </Button>
            <Button
              type="button"
              onClick={() => void handleCreateInvoiceFromInvoices()}
              disabled={isPreparingInvoiceDrawer || !selectedCustomer}
            >
              {isPreparingInvoiceDrawer ? "Preparing..." : "Continue"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isManualCustomerModalOpen} onOpenChange={setIsManualCustomerModalOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Create Customer Manual</DialogTitle>
            <DialogDescription>Input manual dipakai saat customer belum ada di database.</DialogDescription>
          </DialogHeader>

          <div className="space-y-3 rounded-xl border border-border/70 p-3">
            <label className="space-y-1.5">
              <span className="text-sm font-medium text-foreground">Nama Customer (opsional)</span>
              <Input
                value={newCustomerName}
                onChange={(event) => {
                  setSelectedCustomerId("");
                  setNewCustomerName(event.target.value);
                }}
                placeholder="Contoh: Budi Propertindo"
                className="h-10"
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-medium text-foreground">Nomor WhatsApp (E.164)</span>
              <Input
                value={newCustomerPhone}
                onChange={(event) => {
                  setSelectedCustomerId("");
                  setNewCustomerPhone(event.target.value);
                }}
                placeholder="+6281234567890"
                className="h-10"
              />
            </label>
          </div>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setIsManualCustomerModalOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                setIsManualCustomerModalOpen(false);
                void handleCreateInvoiceFromInvoices();
              }}
              disabled={isPreparingInvoiceDrawer || !newCustomerPhone.trim()}
            >
              {isPreparingInvoiceDrawer ? "Preparing..." : "Continue Manual"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <InvoiceDrawer
        open={isInvoiceDrawerOpen}
        customerId={invoiceDraftContext?.customerId ?? null}
        conversationId={invoiceDraftContext?.conversationId ?? null}
        orgId={activeBusiness?.id ?? null}
        customerDisplayName={invoiceDraftContext?.customerDisplayName ?? null}
        customerPhoneE164={invoiceDraftContext?.customerPhoneE164 ?? null}
        onClose={() => {
          setIsInvoiceDrawerOpen(false);
          setInvoiceDraftContext(null);
          void loadInvoices();
          if (selectedInvoiceId) {
            void loadInvoiceDetail(selectedInvoiceId);
          }
        }}
      />
    </section>
  );
}
