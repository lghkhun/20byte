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
import {
  ArrowUpDown,
  Copy,
  ExternalLink,
  FileText,
  MoreHorizontal,
  Search,
  Trash2
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { InvoiceDrawer } from "@/components/invoices/InvoiceDrawer";
import { InvoiceStatusBadge } from "@/components/invoices/InvoiceStatusBadge";
import type {
  ApiError,
  InvoiceItem,
  InvoiceTimeline,
  OrgItem
} from "@/components/invoices/workspace/types";
import { toErrorMessage } from "@/components/invoices/workspace/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { subscribeToOrgMessageEvents } from "@/lib/ably/client";
import { fetchOrganizationsCached } from "@/lib/client/orgsCache";
import { dismissNotify, notifyError, notifyLoading, notifySuccess } from "@/lib/ui/notify";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle
} from "@/components/ui/drawer";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";

const STATUS_FILTERS: Array<"ALL" | InvoiceStatus> = [
  "ALL",
  "DRAFT",
  "SENT",
  "PARTIALLY_PAID",
  "PAID",
  "VOID"
];
const STATUS_FILTER_LABEL: Record<"ALL" | InvoiceStatus, string> = {
  ALL: "Semua Status",
  DRAFT: "Draf",
  SENT: "Terkirim",
  PARTIALLY_PAID: "Sebagian Lunas",
  PAID: "Lunas",
  VOID: "Batal"
};

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
  meta?: {
    hasMore?: boolean;
  };
  error?: {
    message?: string;
  };
};

type CustomerOptionsCacheEntry = {
  rows: CustomerOption[];
  hasMore: boolean;
  cachedAt: number;
};

const CUSTOMER_PICKER_CACHE_TTL_MS = 60_000;
const INVOICES_DATE_FORMATTER = new Intl.DateTimeFormat("id-ID", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric"
});
const INVOICES_MONEY_FORMATTERS = new Map<string, Intl.NumberFormat>();

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
  let formatter = INVOICES_MONEY_FORMATTERS.get(currency);
  if (!formatter) {
    formatter = new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency,
      maximumFractionDigits: 0
    });
    INVOICES_MONEY_FORMATTERS.set(currency, formatter);
  }
  return formatter.format(amountCents / 100);
}

function formatDateLabel(value: string | null): string {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return INVOICES_DATE_FORMATTER.format(date);
}

function toPublicInvoicePath(publicToken: string): string {
  return `/i/${publicToken}`;
}

function headerSortLabel(title: string, onClick: () => void) {
  return (
    <Button
      type="button"
      variant="ghost"
      className="h-8 -ml-2 px-2 text-xs uppercase tracking-[0.18em] text-muted-foreground"
      onClick={onClick}
    >
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
  const [hasMoreCustomers, setHasMoreCustomers] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [customerSearchText, setCustomerSearchText] = useState("");
  const [customerSearchQuery, setCustomerSearchQuery] = useState("");
  const [customerFetchError, setCustomerFetchError] = useState<string | null>(null);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const customerOptionsCacheRef = useRef<Map<string, CustomerOptionsCacheEntry>>(new Map());
  const customerLoadRequestIdRef = useRef(0);
  const customerPageRef = useRef(1);
  const customerQueryRef = useRef("");
  const isMountedRef = useRef(true);
  const invoicesRequestIdRef = useRef(0);
  const timelineRequestIdRef = useRef(0);
  const detailRequestIdRef = useRef(0);
  const invoicesInFlightRef = useRef<{
    key: string;
    promise: Promise<void>;
  } | null>(null);
  const invoicesAbortControllerRef = useRef<AbortController | null>(null);
  const timelineAbortControllerRef = useRef<AbortController | null>(null);
  const detailAbortControllerRef = useRef<AbortController | null>(null);
  const customersAbortControllerRef = useRef<AbortController | null>(null);
  const hasPrimedCustomerPickerRef = useRef(false);

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
  const invoicesLoadingToastIdRef = useRef<string | number | null>(null);
  const realtimePendingInvoiceIdsRef = useRef<Set<string>>(new Set());
  const realtimeRefreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedInvoice = useMemo(
    () => invoices.find((item) => item.id === selectedInvoiceId) ?? null,
    [invoices, selectedInvoiceId]
  );
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

  const selectedCustomer = useMemo(
    () => customerOptions.find((customer) => customer.id === selectedCustomerId) ?? null,
    [customerOptions, selectedCustomerId]
  );
  const totalPages = Math.max(1, Math.ceil(totalInvoices / pageSize));

  const loadOrganizations = useCallback(async () => {
    const organizations = (await fetchOrganizationsCached()) as OrgItem[];
    setOrgs(organizations);
  }, []);

  const loadInvoices = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), limit: String(pageSize) });
    if (statusFilter !== "ALL") {
      params.set("status", statusFilter);
    }
    if (searchQuery.trim()) {
      params.set("q", searchQuery.trim());
    }

    const requestId = ++invoicesRequestIdRef.current;
    const requestKey = params.toString();
    if (invoicesInFlightRef.current?.key === requestKey) {
      await invoicesInFlightRef.current.promise;
      return;
    }

    if (isMountedRef.current) {
      setIsLoading(true);
    }

    const fetchPromise = (async () => {
      const abortController = new AbortController();
      invoicesAbortControllerRef.current?.abort();
      invoicesAbortControllerRef.current = abortController;
      try {
        const response = await fetch(`/api/invoices?${requestKey}`, {
          cache: "no-store",
          signal: abortController.signal
        });
        const payload = (await response.json()) as {
          data?: { invoices?: InvoiceItem[] };
          meta?: { total?: number };
        } & ApiError;
        if (!response.ok) {
          throw new Error(payload.error?.message ?? "Gagal memuat daftar invoice.");
        }
        if (!isMountedRef.current || requestId !== invoicesRequestIdRef.current) {
          return;
        }

        const rows = payload.data?.invoices ?? [];
        setInvoices(rows);
        setTotalInvoices(payload.meta?.total ?? rows.length);
        setSelectedInvoiceId((current) =>
          current && rows.some((row) => row.id === current) ? current : (rows[0]?.id ?? null)
        );
        if (rows.length === 0) {
          setTimeline(null);
        }
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === "AbortError") {
          return;
        }
        throw loadError;
      } finally {
        if (invoicesAbortControllerRef.current === abortController) {
          invoicesAbortControllerRef.current = null;
        }
        if (invoicesInFlightRef.current?.key === requestKey) {
          invoicesInFlightRef.current = null;
        }
        if (!isMountedRef.current || requestId !== invoicesRequestIdRef.current) {
          return;
        }
        setIsLoading(false);
      }
    })();

    invoicesInFlightRef.current = {
      key: requestKey,
      promise: fetchPromise
    };
    await fetchPromise;
  }, [page, pageSize, searchQuery, statusFilter]);

  const loadTimeline = useCallback(async () => {
    if (!selectedInvoiceId) {
      setTimeline(null);
      return;
    }

    const requestId = ++timelineRequestIdRef.current;
    const abortController = new AbortController();
    timelineAbortControllerRef.current?.abort();
    timelineAbortControllerRef.current = abortController;
    try {
      const response = await fetch(
        `/api/invoices/${encodeURIComponent(selectedInvoiceId)}/timeline`,
        { cache: "no-store", signal: abortController.signal }
      );
      const payload = (await response.json()) as {
        data?: { timeline?: InvoiceTimeline };
      } & ApiError;
      if (!response.ok) {
        throw new Error(payload.error?.message ?? "Gagal memuat linimasa invoice.");
      }
      if (!isMountedRef.current || requestId !== timelineRequestIdRef.current) {
        return;
      }

      setTimeline(payload.data?.timeline ?? null);
    } finally {
      if (timelineAbortControllerRef.current === abortController) {
        timelineAbortControllerRef.current = null;
      }
    }
  }, [selectedInvoiceId]);

  const loadInvoiceDetail = useCallback(async (invoiceId: string) => {
    const requestId = ++detailRequestIdRef.current;
    const abortController = new AbortController();
    if (isMountedRef.current) {
      setIsLoadingDetail(true);
    }
    try {
      detailAbortControllerRef.current?.abort();
      detailAbortControllerRef.current = abortController;
      const response = await fetch(`/api/invoices/${encodeURIComponent(invoiceId)}`, {
        cache: "no-store",
        signal: abortController.signal
      });
      const payload = (await response.json().catch(() => null)) as InvoiceDetailResponse | null;
      if (!response.ok || !payload?.data?.invoice) {
        throw new Error(payload?.error?.message ?? "Gagal memuat detail invoice.");
      }
      if (!isMountedRef.current || requestId !== detailRequestIdRef.current) {
        return;
      }

      setInvoiceDetail(payload.data.invoice);
    } catch (detailError) {
      if (detailError instanceof DOMException && detailError.name === "AbortError") {
        return;
      }
      if (!isMountedRef.current || requestId !== detailRequestIdRef.current) {
        return;
      }
      setError(toErrorMessage(detailError, "Gagal memuat detail invoice."));
    } finally {
      if (detailAbortControllerRef.current === abortController) {
        detailAbortControllerRef.current = null;
      }
      if (!isMountedRef.current || requestId !== detailRequestIdRef.current) {
        return;
      }
      setIsLoadingDetail(false);
    }
  }, []);

  const flushRealtimeRefresh = useCallback(async () => {
    const pendingIds = Array.from(realtimePendingInvoiceIdsRef.current);
    realtimePendingInvoiceIdsRef.current.clear();

    try {
      await loadInvoices();
      if (!isMountedRef.current) {
        return;
      }

      if (
        selectedInvoiceId &&
        (pendingIds.length === 0 || pendingIds.includes(selectedInvoiceId))
      ) {
        await loadTimeline();
      }

      if (
        isDetailModalOpen &&
        invoiceDetail?.id &&
        (pendingIds.length === 0 || pendingIds.includes(invoiceDetail.id))
      ) {
        await loadInvoiceDetail(invoiceDetail.id);
      }
    } catch (refreshError) {
      if (!isMountedRef.current) {
        return;
      }
      setError(toErrorMessage(refreshError, "Gagal menyegarkan data invoice realtime."));
    }
  }, [
    invoiceDetail?.id,
    isDetailModalOpen,
    loadInvoiceDetail,
    loadInvoices,
    loadTimeline,
    selectedInvoiceId
  ]);

  const scheduleRealtimeRefresh = useCallback(
    (invoiceId?: string) => {
      if (invoiceId) {
        realtimePendingInvoiceIdsRef.current.add(invoiceId);
      }
      if (realtimeRefreshTimeoutRef.current) {
        return;
      }
      realtimeRefreshTimeoutRef.current = setTimeout(() => {
        realtimeRefreshTimeoutRef.current = null;
        void flushRealtimeRefresh();
      }, 250);
    },
    [flushRealtimeRefresh]
  );

  const loadCustomers = useCallback(
    async (queryText: string, options?: { force?: boolean; append?: boolean }) => {
      if (!isMountedRef.current) {
        return;
      }
      const query = queryText.trim();
      customerQueryRef.current = query;
      const append = Boolean(options?.append);
      const targetPage = append ? customerPageRef.current + 1 : 1;
      setCustomerFetchError(null);
      const requestId = ++customerLoadRequestIdRef.current;

      const cached = append ? null : customerOptionsCacheRef.current.get(query);
      const isCacheFresh = Boolean(
        cached && Date.now() - cached.cachedAt < CUSTOMER_PICKER_CACHE_TTL_MS
      );
      if (cached?.rows) {
        setCustomerOptions(cached.rows);
        setHasMoreCustomers(cached.hasMore);
        customerPageRef.current = 1;
      } else if (!append) {
        setCustomerOptions([]);
        setHasMoreCustomers(false);
        customerPageRef.current = 1;
      }
      if (!options?.force && isCacheFresh) {
        return;
      }

      setIsLoadingCustomers(true);
      const abortController = new AbortController();
      customersAbortControllerRef.current?.abort();
      customersAbortControllerRef.current = abortController;
      try {
        const params = new URLSearchParams({
          page: String(targetPage),
          limit: "20",
          picker: "1"
        });
        if (query) {
          params.set("q", query);
        }

        const response = await fetch(`/api/customers?${params.toString()}`, {
          cache: "no-store",
          signal: abortController.signal
        });
        const payload = (await response.json().catch(() => null)) as CustomersResponse | null;
        if (!isMountedRef.current || requestId !== customerLoadRequestIdRef.current) {
          return;
        }
        if (!response.ok) {
          throw new Error(payload?.error?.message ?? "Gagal memuat pelanggan.");
        }

        const rows = payload?.data?.customers ?? [];
        const hasMore = Boolean(payload?.meta?.hasMore);
        if (append) {
          setCustomerOptions((current) => {
            const knownIds = new Set(current.map((item) => item.id));
            const uniqueRows = rows.filter((item) => !knownIds.has(item.id));
            return [...current, ...uniqueRows];
          });
          customerPageRef.current = targetPage;
          setHasMoreCustomers(hasMore);
          return;
        }

        customerOptionsCacheRef.current.set(query, {
          rows,
          hasMore,
          cachedAt: Date.now()
        });
        setCustomerOptions(rows);
        setHasMoreCustomers(hasMore);
        customerPageRef.current = 1;
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === "AbortError") {
          return;
        }
        if (!isMountedRef.current || requestId !== customerLoadRequestIdRef.current) {
          return;
        }
        setCustomerFetchError(toErrorMessage(loadError, "Gagal memuat pelanggan."));
      } finally {
        if (customersAbortControllerRef.current === abortController) {
          customersAbortControllerRef.current = null;
        }
        if (!isMountedRef.current || requestId !== customerLoadRequestIdRef.current) {
          return;
        }
        setIsLoadingCustomers(false);
      }
    },
    []
  );

  const primeCustomerPicker = useCallback(async () => {
    if (hasPrimedCustomerPickerRef.current) {
      return;
    }
    hasPrimedCustomerPickerRef.current = true;
    await loadCustomers("");
  }, [loadCustomers]);

  const loadMoreCustomers = useCallback(async () => {
    if (isLoadingCustomers || !hasMoreCustomers) {
      return;
    }
    await loadCustomers(customerQueryRef.current, { append: true });
  }, [hasMoreCustomers, isLoadingCustomers, loadCustomers]);

  const sendInvoiceById = useCallback(
    async (invoiceId: string) => {
      if (!invoiceId || isSending) {
        return;
      }

      try {
        setError(null);
        setSuccess(null);
        setIsSending(true);
        const response = await fetch(`/api/invoices/${encodeURIComponent(invoiceId)}/send`, {
          method: "POST"
        });
        const payload = (await response.json()) as {
          data?: { invoice?: { publicLink?: string } };
        } & ApiError;
        if (!response.ok) {
          throw new Error(payload.error?.message ?? "Gagal mengirim invoice.");
        }

        setSuccess(`Invoice berhasil dikirim. ${payload.data?.invoice?.publicLink ?? ""}`.trim());
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
        setError(toErrorMessage(err, "Gagal mengirim invoice."));
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
          throw new Error(payload?.error?.message ?? "Gagal menghapus invoice.");
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
        setError(toErrorMessage(deleteError, "Gagal menghapus invoice."));
      } finally {
        setIsDeleting(false);
      }
    },
    [invoices.length, isDeleting, loadInvoices, page]
  );

  const bulkSendDraftByIds = useCallback(async (invoiceIds: string[]) => {
    if (invoiceIds.length === 0) {
      return;
    }

    const failures: string[] = [];
    for (const invoiceId of invoiceIds) {
      // Sequential request keeps timeline updates stable and avoids API burst.
      // eslint-disable-next-line no-await-in-loop
      const response = await fetch(`/api/invoices/${encodeURIComponent(invoiceId)}/send`, {
        method: "POST"
      });
      if (!response.ok) {
        failures.push(invoiceId);
      }
    }

    if (failures.length > 0) {
      throw new Error(`Gagal mengirim ${failures.length} draft invoice.`);
    }
  }, []);

  const bulkDeleteDraftByIds = useCallback(async (invoiceIds: string[]) => {
    if (invoiceIds.length === 0) {
      return;
    }

    const failures: string[] = [];
    for (const invoiceId of invoiceIds) {
      // Sequential request keeps deletion deterministic and easier to trace.
      // eslint-disable-next-line no-await-in-loop
      const response = await fetch(`/api/invoices/${encodeURIComponent(invoiceId)}`, {
        method: "DELETE"
      });
      if (!response.ok) {
        failures.push(invoiceId);
      }
    }

    if (failures.length > 0) {
      throw new Error(`Gagal menghapus ${failures.length} draft invoice.`);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        await loadOrganizations();
      } catch (err) {
        if (mounted) {
          setError(toErrorMessage(err, "Gagal menginisialisasi sistem invoice."));
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [loadOrganizations]);

  useEffect(() => {
    void loadInvoices().catch((err) => {
      if (!isMountedRef.current) {
        return;
      }
      setError(toErrorMessage(err, "Gagal menyegarkan daftar invoice."));
    });
  }, [loadInvoices]);

  useEffect(() => {
    void loadTimeline().catch((err) => {
      if (err instanceof DOMException && err.name === "AbortError") {
        return;
      }
      if (!isMountedRef.current) {
        return;
      }
      setError(toErrorMessage(err, "Gagal menyegarkan linimasa invoice."));
    });
  }, [loadTimeline]);

  useEffect(() => {
    const orgId = activeBusiness?.id ?? null;
    if (!orgId) {
      return;
    }

    let active = true;
    let cleanup: (() => void) | null = null;
    let fallbackTimer: ReturnType<typeof setInterval> | null = null;

    const stopFallbackPolling = () => {
      if (fallbackTimer) {
        clearInterval(fallbackTimer);
        fallbackTimer = null;
      }
    };

    const startFallbackPolling = () => {
      if (fallbackTimer || !active) {
        return;
      }
      fallbackTimer = setInterval(() => {
        if (!active) {
          return;
        }
        scheduleRealtimeRefresh();
      }, 15000);
    };

    const startSubscription = async () => {
      try {
        cleanup = await subscribeToOrgMessageEvents({
          orgId,
          onConnectionStateChange: (connectionState) => {
            if (!active) {
              return;
            }
            if (connectionState === "connected") {
              stopFallbackPolling();
              return;
            }
            startFallbackPolling();
          },
          onInvoiceCreated: (payload) => {
            scheduleRealtimeRefresh(payload.invoiceId);
          },
          onInvoiceUpdated: (payload) => {
            scheduleRealtimeRefresh(payload.invoiceId);
          },
          onInvoicePaid: (payload) => {
            scheduleRealtimeRefresh(payload.invoiceId);
          },
          onProofAttached: (payload) => {
            scheduleRealtimeRefresh(payload.invoiceId);
          }
        });
      } catch (subscriptionError) {
        if (!active) {
          return;
        }
        setError(toErrorMessage(subscriptionError, "Realtime invoice gagal terhubung."));
        startFallbackPolling();
      }
    };

    void startSubscription();

    return () => {
      active = false;
      stopFallbackPolling();
      if (cleanup) {
        cleanup();
      }
    };
  }, [activeBusiness?.id, scheduleRealtimeRefresh]);

  useEffect(() => {
    if (!isCreateInvoiceModalOpen) {
      return;
    }

    const timer = window.setTimeout(() => {
      setCustomerSearchQuery(customerSearchText.trim());
    }, 220);

    return () => {
      window.clearTimeout(timer);
    };
  }, [customerSearchText, isCreateInvoiceModalOpen]);

  useEffect(() => {
    if (!isCreateInvoiceModalOpen) {
      return;
    }

    void loadCustomers(customerSearchQuery);
  }, [customerSearchQuery, isCreateInvoiceModalOpen, loadCustomers]);

  useEffect(() => {
    if (isCreateInvoiceModalOpen) {
      setCustomerSearchQuery(customerSearchText.trim());
      return;
    }
  }, [customerSearchText, isCreateInvoiceModalOpen]);

  useEffect(() => {
    isMountedRef.current = true;
    const pendingInvoiceIds = realtimePendingInvoiceIdsRef.current;
    return () => {
      isMountedRef.current = false;
      invoicesAbortControllerRef.current?.abort();
      timelineAbortControllerRef.current?.abort();
      detailAbortControllerRef.current?.abort();
      customersAbortControllerRef.current?.abort();
      if (realtimeRefreshTimeoutRef.current) {
        clearTimeout(realtimeRefreshTimeoutRef.current);
        realtimeRefreshTimeoutRef.current = null;
      }
      if (invoicesLoadingToastIdRef.current !== null) {
        dismissNotify(invoicesLoadingToastIdRef.current);
        invoicesLoadingToastIdRef.current = null;
      }
      pendingInvoiceIds.clear();
    };
  }, []);

  useEffect(() => {
    if (hasPrimedCustomerPickerRef.current) {
      return;
    }

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let idleId: number | null = null;

    const runPrefetch = () => {
      void primeCustomerPicker();
    };

    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      idleId = window.requestIdleCallback(runPrefetch, { timeout: 1200 });
    } else {
      timeoutId = globalThis.setTimeout(runPrefetch, 600);
    }

    return () => {
      if (idleId !== null && typeof window !== "undefined" && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(idleId);
      }
      if (timeoutId !== null) {
        globalThis.clearTimeout(timeoutId);
      }
    };
  }, [primeCustomerPicker]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearchQuery(searchInput.trim());
      setPage(1);
    }, 250);

    return () => {
      window.clearTimeout(timer);
    };
  }, [searchInput]);

  useEffect(() => {
    if (!error) return;
    notifyError(error);
  }, [error]);

  useEffect(() => {
    if (!success) return;
    notifySuccess(success);
  }, [success]);

  useEffect(() => {
    if (isLoading) {
      if (invoicesLoadingToastIdRef.current === null) {
        invoicesLoadingToastIdRef.current = notifyLoading("Memuat daftar invoice...");
      }
      return;
    }

    if (invoicesLoadingToastIdRef.current !== null) {
      dismissNotify(invoicesLoadingToastIdRef.current);
      invoicesLoadingToastIdRef.current = null;
    }
  }, [isLoading]);

  const columns = useMemo<ColumnDef<InvoiceItem>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={
              table.getIsAllRowsSelected() || (table.getIsSomeRowsSelected() && "indeterminate")
            }
            onCheckedChange={(value) => table.toggleAllRowsSelected(Boolean(value))}
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
        header: ({ column }) =>
          headerSortLabel("Nomor", () => column.toggleSorting(column.getIsSorted() === "asc")),
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
        header: ({ column }) =>
          headerSortLabel("Pelanggan", () => column.toggleSorting(column.getIsSorted() === "asc")),
        cell: ({ row }) => (
          <div>
            <p className="font-medium text-foreground">
              {row.original.customerName?.trim() || row.original.customerPhoneE164}
            </p>
            <p className="text-sm text-muted-foreground">{row.original.customerPhoneE164}</p>
          </div>
        )
      },
      {
        accessorKey: "publicToken",
        header: ({ column }) =>
          headerSortLabel("Link Publik", () =>
            column.toggleSorting(column.getIsSorted() === "asc")
          ),
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
        header: ({ column }) =>
          headerSortLabel("Tanggal", () => column.toggleSorting(column.getIsSorted() === "asc")),
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {formatDateLabel(row.original.createdAt)}
          </span>
        )
      },
      {
        accessorKey: "totalCents",
        header: ({ column }) =>
          headerSortLabel("Nilai", () => column.toggleSorting(column.getIsSorted() === "asc")),
        cell: ({ row }) => (
          <span className="font-semibold text-foreground">
            {formatMoney(row.original.totalCents, row.original.currency)}
          </span>
        )
      },
      {
        accessorKey: "status",
        header: ({ column }) =>
          headerSortLabel("Status", () => column.toggleSorting(column.getIsSorted() === "asc")),
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
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-8 w-8 p-0"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <span className="sr-only">Buka aksi</span>
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Aksi Invoice</DropdownMenuLabel>
                  <DropdownMenuItem
                    onClick={() => {
                      setSelectedInvoiceId(invoice.id);
                      setIsDetailModalOpen(true);
                      void loadInvoiceDetail(invoice.id);
                    }}
                  >
                    Lihat detail
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={invoice.status !== "DRAFT" && invoice.status !== "SENT"}
                    onClick={() => {
                      void sendInvoiceById(invoice.id);
                    }}
                  >
                    Kirim invoice
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link
                      prefetch={false}
                      href={
                        invoice.conversationId
                          ? `/inbox?conversationId=${encodeURIComponent(invoice.conversationId)}`
                          : "/inbox"
                      }
                    >
                      Buka Panel CRM
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
                    Hapus draft/void
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
    autoResetAll: false,
    autoResetPageIndex: false,
    initialState: {
      columnVisibility: {}
    }
  });

  const selectedRows = table.getSelectedRowModel().rows.map((row) => row.original);
  const selectedDraftIds = selectedRows
    .filter((item) => item.status === "DRAFT")
    .map((item) => item.id);

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
      setError(toErrorMessage(bulkError, "Aksi kirim massal gagal."));
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

      const shouldRefreshDetail = Boolean(
        selectedInvoiceId && selectedDraftIds.includes(selectedInvoiceId)
      );
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
      setError(toErrorMessage(bulkError, "Aksi hapus massal gagal."));
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
      const response = await fetch(
        `/api/invoices/${encodeURIComponent(selectedInvoice.id)}/mark-paid`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ milestoneType })
        }
      );
      const payload = (await response.json()) as ApiError;
      if (!response.ok) {
        throw new Error(payload.error?.message ?? "Gagal menandai invoice lunas.");
      }

      setSuccess("Invoice payment status updated.");
      await loadInvoices();
      await loadTimeline();
      await loadInvoiceDetail(selectedInvoice.id);
    } catch (err) {
      setError(toErrorMessage(err, "Gagal menandai invoice lunas."));
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
      throw new Error(payload?.error?.message ?? "Gagal menyiapkan percakapan pelanggan.");
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
        const payload = (await response
          .json()
          .catch(() => null)) as CreateConversationResponse | null;
        if (!response.ok) {
          throw new Error(payload?.error?.message ?? "Gagal menyiapkan percakapan pelanggan.");
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
      setSuccess("Percakapan pelanggan siap. Lanjutkan menyusun draft invoice.");
    } catch (err) {
      setError(toErrorMessage(err, "Gagal memulai pembuatan invoice."));
    } finally {
      setIsPreparingInvoiceDrawer(false);
    }
  }

  async function handleCopyPublicLink(publicToken: string) {
    try {
      const path = toPublicInvoicePath(publicToken);
      const absoluteLink = `${window.location.origin}${path}`;
      await navigator.clipboard.writeText(absoluteLink);
      setSuccess("Link invoice publik berhasil disalin.");
    } catch {
      setError("Gagal menyalin link invoice publik.");
    }
  }

  return (
    <section className="flex h-full min-h-0 flex-1 flex-col space-y-3 p-3 md:space-y-4 md:p-5">
      <div className="space-y-3 px-1 py-1 md:space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 md:gap-4">
          <div className="flex flex-wrap items-center gap-3 lg:gap-4 2xl:gap-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-primary/20 to-primary/5 text-primary shadow-inner ring-1 ring-primary/20 lg:h-12 lg:w-12 lg:rounded-[18px] 2xl:h-14 2xl:w-14">
              <FileText className="h-5 w-5 lg:h-6 lg:w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground lg:text-2xl 2xl:text-3xl">
                Manajemen Invoice
              </h1>
              <p className="text-xs text-muted-foreground lg:text-sm">
                Kelola invoice, pengiriman, pelunasan, dan sinkronisasi stage CRM dari satu
                workspace.
              </p>
            </div>
          </div>
          <Button
            type="button"
            className="h-10 rounded-xl px-5 shadow-md shadow-primary/20 transition-all hover:scale-[1.02]"
            onMouseEnter={() => {
              void primeCustomerPicker();
            }}
            onFocus={() => {
              void primeCustomerPicker();
            }}
            onClick={() => {
              void primeCustomerPicker();
              setSelectedCustomerId("");
              setCustomerSearchText("");
              setCustomerSearchQuery("");
              setCustomerOptions([]);
              setHasMoreCustomers(false);
              customerPageRef.current = 1;
              customerQueryRef.current = "";
              setNewCustomerName("");
              setNewCustomerPhone("");
              setIsCreateInvoiceModalOpen(true);
            }}
          >
            Buat Invoice
          </Button>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-3 xl:gap-4">
        <article className="flex flex-col justify-center rounded-[14px] border border-border/70 bg-card p-3 shadow-sm transition-shadow hover:shadow-md lg:rounded-[16px] lg:p-4 2xl:rounded-[20px] 2xl:p-5">
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 lg:h-2 lg:w-2"></div>
            <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground lg:text-[11px]">
              Invoice Lunas
            </p>
          </div>
          <p className="mt-1.5 text-xl font-semibold tracking-tight text-foreground lg:mt-2 lg:text-2xl 2xl:mt-2.5 2xl:text-[28px]">
            {summary.paid}
          </p>
        </article>
        <article className="flex flex-col justify-center rounded-[14px] border border-border/70 bg-card p-3 shadow-sm transition-shadow hover:shadow-md lg:rounded-[16px] lg:p-4 2xl:rounded-[20px] 2xl:p-5">
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-rose-500 lg:h-2 lg:w-2"></div>
            <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground lg:text-[11px]">
              Belum Lunas
            </p>
          </div>
          <p className="mt-1.5 text-xl font-semibold tracking-tight text-foreground lg:mt-2 lg:text-2xl 2xl:mt-2.5 2xl:text-[28px]">
            {summary.unpaid}
          </p>
        </article>
        <article className="flex flex-col justify-center rounded-[14px] border border-border/70 bg-card p-3 shadow-sm transition-shadow hover:shadow-md lg:rounded-[16px] lg:p-4 2xl:rounded-[20px] 2xl:p-5">
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-blue-500 lg:h-2 lg:w-2"></div>
            <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground lg:text-[11px]">
              Total Pendapatan
            </p>
          </div>
          <p className="mt-1.5 text-xl font-semibold tracking-tight text-foreground lg:mt-2 lg:text-2xl 2xl:mt-2.5 2xl:text-[28px]">
            {formatMoney(summary.revenue, "IDR")}
          </p>
        </article>
      </div>

      <section className="flex min-h-0 flex-1 flex-col rounded-[16px] border border-border/80 bg-card p-3 shadow-md shadow-black/5 lg:rounded-2xl lg:p-4 2xl:rounded-[24px] 2xl:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 2xl:mb-5">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-foreground lg:text-xl 2xl:text-2xl">
              Daftar Invoice
            </h2>
            <p className="text-[11px] text-muted-foreground lg:text-xs 2xl:text-sm">
              Register invoice {activeBusiness?.name ?? "Bisnis"}
            </p>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 md:w-auto">
            <label className="relative block w-full md:w-auto">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Cari invoice/customer..."
                className="h-10 rounded-xl pl-10 shadow-sm transition-shadow focus-visible:ring-primary/30"
              />
            </label>
            <Select
              value={statusFilter}
              onValueChange={(value) => {
                setStatusFilter(value as "ALL" | InvoiceStatus);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-10 w-full rounded-xl bg-background shadow-sm md:w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_FILTERS.map((filter) => (
                  <SelectItem key={filter} value={filter}>
                    {STATUS_FILTER_LABEL[filter]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="secondary"
                  className="h-9 rounded-lg border border-border/80 bg-background md:h-10 md:rounded-xl"
                >
                  Kolom
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
            <p className="text-sm text-muted-foreground">{selectedRows.length} dipilih</p>
            <Button
              type="button"
              size="sm"
              onClick={() => void handleBulkSend()}
              disabled={isBulkActing || selectedDraftIds.length === 0}
            >
              Kirim Draft ({selectedDraftIds.length})
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              onClick={() => void handleBulkDelete()}
              disabled={isBulkActing || selectedDraftIds.length === 0}
            >
              Hapus Draft ({selectedDraftIds.length})
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
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, rowIndex) => (
                  <TableRow key={`invoice-skeleton-${rowIndex}`}>
                    {Array.from({ length: columns.length }).map((__, columnIndex) => (
                      <TableCell key={`invoice-skeleton-${rowIndex}-${columnIndex}`}>
                        <Skeleton className="h-4 w-full max-w-[220px]" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
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
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center text-muted-foreground"
                  >
                    Invoice tidak ditemukan.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">{totalInvoices} invoice</p>
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
                <SelectItem value="10">10 baris</SelectItem>
                <SelectItem value="20">20 baris</SelectItem>
                <SelectItem value="50">50 baris</SelectItem>
                <SelectItem value="100">100 baris</SelectItem>
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
              Sebelumnya
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="border border-border/80 bg-background"
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              disabled={page >= totalPages}
            >
              Berikutnya
            </Button>
          </div>
        </div>
      </section>

      <Drawer open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen} direction="right">
        <DrawerContent className="data-[vaul-drawer-direction=right]:border-l-border lg:max-w-2xl xl:max-w-3xl">
          <DrawerHeader className="shrink-0 border-b border-border/70 px-5 py-4 md:px-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <DrawerTitle>Detail Invoice</DrawerTitle>
                <DrawerDescription>
                  Detail invoice dengan format dokumen invoice standar dan aksi CRUD.
                </DrawerDescription>
              </div>
              <DrawerClose asChild>
                <Button type="button" variant="ghost">
                  Tutup
                </Button>
              </DrawerClose>
            </div>
          </DrawerHeader>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="inbox-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 md:px-6 md:py-5">
              {isLoadingDetail || !invoiceDetail ? (
                <p className="text-sm text-muted-foreground">Memuat detail invoice...</p>
              ) : (
                <div className="space-y-5">
                  <div className="rounded-xl border border-border/70 bg-background/40 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                          Dokumen Invoice
                        </p>
                        <h3 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
                          {invoiceDetail.invoiceNo}
                        </h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Dibuat: {formatDateLabel(invoiceDetail.createdAt)} | Jatuh Tempo:{" "}
                          {formatDateLabel(invoiceDetail.dueDate)}
                        </p>
                      </div>
                      <InvoiceStatusBadge status={invoiceDetail.status} />
                    </div>

                    <div className="mt-5 grid gap-4 md:grid-cols-2">
                      <div className="rounded-lg border border-border/70 p-3">
                        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                          Dari
                        </p>
                        <p className="mt-2 text-sm font-medium text-foreground">
                          {activeBusiness?.name ?? "Bisnis Anda"}
                        </p>
                      </div>
                      <div className="rounded-lg border border-border/70 p-3">
                        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                          Ditagihkan Ke
                        </p>
                        <p className="mt-2 text-sm font-medium text-foreground">
                          {invoiceDetail.customerName?.trim() || invoiceDetail.customerPhoneE164}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {invoiceDetail.customerPhoneE164}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 rounded-lg border border-border/70 p-3">
                      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                        Slug Link Publik
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <a
                          href={toPublicInvoicePath(invoiceDetail.publicToken)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex max-w-full items-center gap-2 rounded-md border border-border/70 bg-background px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
                          title={toPublicInvoicePath(invoiceDetail.publicToken)}
                        >
                          <span className="max-w-[360px] truncate">
                            {toPublicInvoicePath(invoiceDetail.publicToken)}
                          </span>
                          <ExternalLink className="h-4 w-4 shrink-0" />
                        </a>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          className="border border-border/80 bg-background"
                          onClick={() => void handleCopyPublicLink(invoiceDetail.publicToken)}
                        >
                          <Copy className="mr-2 h-3.5 w-3.5" />
                          Salin Link
                        </Button>
                      </div>
                    </div>

                    <div className="mt-5 overflow-auto rounded-lg border border-border/70">
                      <Table className="min-w-[640px]">
                        <TableHeader>
                          <TableRow>
                            <TableHead>Item</TableHead>
                            <TableHead>Qty</TableHead>
                            <TableHead>Harga</TableHead>
                            <TableHead className="text-right">Subtotal</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {invoiceDetail.items.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell>
                                <p className="font-medium text-foreground">{item.name}</p>
                                {item.description ? (
                                  <p className="text-xs text-muted-foreground">
                                    {item.description}
                                  </p>
                                ) : null}
                              </TableCell>
                              <TableCell>
                                {item.qty}
                                {item.unit ? ` ${item.unit}` : ""}
                              </TableCell>
                              <TableCell>
                                {formatMoney(item.priceCents, invoiceDetail.currency)}
                              </TableCell>
                              <TableCell className="text-right font-semibold">
                                {formatMoney(item.amountCents, invoiceDetail.currency)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    <div className="mt-4 flex justify-end">
                      <div className="w-full max-w-xs space-y-1 rounded-lg border border-border/70 bg-background/50 p-3 text-sm">
                        <div className="flex items-center justify-between text-muted-foreground">
                          <span>Subtotal</span>
                          <span>
                            {formatMoney(invoiceDetail.subtotalCents, invoiceDetail.currency)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-base font-semibold text-foreground">
                          <span>Total</span>
                          <span>
                            {formatMoney(invoiceDetail.totalCents, invoiceDetail.currency)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-xl border border-border/70 p-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                        Termin Pembayaran
                      </p>
                      <div className="mt-3 space-y-2">
                        {invoiceDetail.milestones.map((milestone) => (
                          <article
                            key={milestone.id}
                            className="rounded-lg border border-border/70 p-3"
                          >
                            <p className="text-sm font-medium text-foreground">{milestone.type}</p>
                            <p className="text-sm text-muted-foreground">
                              {formatMoney(milestone.amountCents, invoiceDetail.currency)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Jatuh Tempo: {formatDateLabel(milestone.dueDate)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Status: {milestone.status}
                            </p>
                          </article>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-xl border border-border/70 p-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                        Instruksi Transfer
                      </p>
                      <div className="mt-3 space-y-2">
                        {invoiceDetail.bankAccounts.length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            Belum ada rekening bank yang dikonfigurasi.
                          </p>
                        ) : null}
                        {invoiceDetail.bankAccounts.map((account, index) => (
                          <article
                            key={`${account.accountNumber}-${index}`}
                            className="rounded-lg border border-border/70 p-3"
                          >
                            <p className="text-sm font-medium text-foreground">
                              {account.bankName}
                            </p>
                            <p className="text-xs text-muted-foreground">{account.accountNumber}</p>
                            <p className="text-xs text-muted-foreground">{account.accountHolder}</p>
                          </article>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-border/70 p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                      Linimasa
                    </p>
                    <div className="mt-3 space-y-2">
                      {timeline?.events?.map((event) => (
                        <article key={event.id} className="rounded-lg border border-border/70 p-3">
                          <p className="text-sm font-medium text-foreground">{event.label}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDateLabel(event.at)}
                          </p>
                        </article>
                      ))}
                      {!timeline?.events?.length ? (
                        <p className="text-sm text-muted-foreground">Belum ada aktivitas.</p>
                      ) : null}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <DrawerFooter className="shrink-0 flex-row gap-2 border-t border-border/70 px-5 py-4 md:px-6">
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
                disabled={
                  isSending || (invoiceDetail.status !== "DRAFT" && invoiceDetail.status !== "SENT")
                }
              >
                {isSending ? "Mengirim..." : "Kirim Invoice"}
              </Button>
            ) : null}
            {invoiceDetail?.kind === "DP_AND_FINAL" ? (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  className="border border-border/80 bg-background"
                  onClick={() => void handleMarkPaid("DP")}
                  disabled={isMarkingPaid}
                >
                  Tandai DP Lunas
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="border border-border/80 bg-background"
                  onClick={() => void handleMarkPaid("FINAL")}
                  disabled={isMarkingPaid}
                >
                  Tandai Pelunasan Lunas
                </Button>
              </>
            ) : invoiceDetail ? (
              <Button
                type="button"
                variant="secondary"
                className="border border-border/80 bg-background"
                onClick={() => void handleMarkPaid("FULL")}
                disabled={isMarkingPaid}
              >
                Tandai Lunas
              </Button>
            ) : null}
            {invoiceDetail &&
            (invoiceDetail.status === "DRAFT" || invoiceDetail.status === "VOID") ? (
              <Button
                type="button"
                variant="destructive"
                onClick={() => void deleteInvoiceById(invoiceDetail.id)}
                disabled={isDeleting}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {isDeleting ? "Menghapus..." : "Hapus"}
              </Button>
            ) : null}
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      <Dialog open={isCreateInvoiceModalOpen} onOpenChange={setIsCreateInvoiceModalOpen}>
        <DialogContent className="sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle>Buat Invoice dari Halaman Invoice</DialogTitle>
            <DialogDescription>
              Pilih customer dari database (search-select). Sistem akan gunakan/buat conversation
              otomatis agar invoice tetap terhubung ke CRM.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Cari & Pilih Pelanggan</p>
              <Input
                value={customerSearchText}
                onChange={(event) => {
                  setCustomerSearchText(event.target.value);
                  setSelectedCustomerId("");
                }}
                placeholder="Cari nama pelanggan atau nomor WhatsApp..."
                className="h-10"
              />
              {isLoadingCustomers ? (
                <p className="text-xs text-muted-foreground">Mencari pelanggan...</p>
              ) : null}
              <div className="max-h-52 overflow-auto rounded-xl border border-border/70">
                {customerFetchError ? (
                  <div className="space-y-2 px-3 py-3">
                    <p className="text-sm text-destructive">{customerFetchError}</p>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="h-8"
                      onClick={() => void loadCustomers(customerSearchQuery, { force: true })}
                    >
                      Coba Lagi
                    </Button>
                  </div>
                ) : isLoadingCustomers && customerOptions.length === 0 ? (
                  <div className="space-y-2 px-3 py-3">
                    {Array.from({ length: 5 }).map((_, index) => (
                      <div
                        key={`customer-skeleton-${index}`}
                        className="animate-pulse rounded-lg border border-border/60 px-3 py-2"
                      >
                        <div className="h-3.5 w-40 rounded bg-muted" />
                        <div className="mt-2 h-3 w-28 rounded bg-muted/80" />
                      </div>
                    ))}
                  </div>
                ) : customerOptions.length === 0 ? (
                  <p className="px-3 py-3 text-sm text-muted-foreground">
                    Pelanggan tidak ditemukan.
                  </p>
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
                          <p className="text-sm font-medium text-foreground">
                            {customer.displayName?.trim() || customer.phoneE164}
                          </p>
                          <p className="text-xs text-muted-foreground">{customer.phoneE164}</p>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {customer.latestConversationId ? "sudah ada chat" : "belum ada chat"}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                {hasMoreCustomers ? (
                  <div className="border-t border-border/60 p-2">
                    <Button
                      type="button"
                      variant="secondary"
                      className="h-8 w-full"
                      onClick={() => void loadMoreCustomers()}
                      disabled={isLoadingCustomers}
                    >
                      {isLoadingCustomers ? "Memuat..." : "Muat Pelanggan Lain"}
                    </Button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsCreateInvoiceModalOpen(false)}
            >
              Batal
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
              {isPreparingInvoiceDrawer ? "Menyiapkan..." : "Lanjutkan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isManualCustomerModalOpen} onOpenChange={setIsManualCustomerModalOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Buat Pelanggan Manual</DialogTitle>
            <DialogDescription>
              Input manual dipakai saat customer belum ada di database.
            </DialogDescription>
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
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsManualCustomerModalOpen(false)}
            >
              Batal
            </Button>
            <Button
              type="button"
              onClick={() => {
                setIsManualCustomerModalOpen(false);
                void handleCreateInvoiceFromInvoices();
              }}
              disabled={isPreparingInvoiceDrawer || !newCustomerPhone.trim()}
            >
              {isPreparingInvoiceDrawer ? "Menyiapkan..." : "Lanjutkan Manual"}
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
