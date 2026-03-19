"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
import { ArrowUpDown, Download, MoreHorizontal, Plus, Search, Tags, Upload, UsersRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { OperationFeedback } from "@/components/ui/operation-feedback";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type CustomerTag = {
  id: string;
  name: string;
  color: string;
  customerCount?: number;
};

type CustomerRow = {
  id: string;
  displayName: string | null;
  phoneE164: string;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
  conversationCount: number;
  latestConversationId: string | null;
  tags: CustomerTag[];
};

type CustomersResponse = {
  data?: {
    customers?: CustomerRow[];
    tags?: CustomerTag[];
  };
  meta?: {
    total?: number;
  };
  error?: {
    message?: string;
  };
};

type TagsResponse = {
  data?: {
    tags?: CustomerTag[];
  };
  error?: {
    message?: string;
  };
};

type ApiError = {
  error?: {
    message?: string;
  };
};

type LabelDialogMode = "single" | "bulk";

const LABEL_COLORS = ["emerald", "amber", "sky", "rose", "violet", "slate"];
const LABEL_COLOR_PREVIEWS: Record<string, string> = {
  emerald: "#10b981",
  amber: "#f59e0b",
  sky: "#0ea5e9",
  rose: "#f43f5e",
  violet: "#8b5cf6",
  slate: "#64748b"
};
const CUSTOM_LABEL_COLOR_VALUE = "__custom__";
const DEFAULT_CUSTOM_LABEL_COLOR = "#10b981";

function isHexColor(value: string): boolean {
  return /^#([0-9a-fA-F]{6})$/.test(value.trim());
}

function getColorPreview(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (isHexColor(normalized)) {
    return normalized;
  }

  return LABEL_COLOR_PREVIEWS[normalized] ?? DEFAULT_CUSTOM_LABEL_COLOR;
}

function formatDateLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function toInitial(value: string): string {
  return value.trim().slice(0, 1).toUpperCase() || "#";
}

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

function headerSortLabel(title: string, onClick: () => void) {
  return (
    <Button type="button" variant="ghost" className="h-8 -ml-2 px-2 text-xs uppercase tracking-[0.18em] text-muted-foreground" onClick={onClick}>
      {title}
      <ArrowUpDown className="ml-2 h-3.5 w-3.5" />
    </Button>
  );
}

export function CustomersWorkspace() {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<"contacts" | "labels">("contacts");
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [tags, setTags] = useState<CustomerTag[]>([]);
  const [totalCustomers, setTotalCustomers] = useState(0);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
    updatedAt: false
  });
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const [selectedTagId, setSelectedTagId] = useState<string>("");

  const [isCreateContactOpen, setIsCreateContactOpen] = useState(false);
  const [isEditContactOpen, setIsEditContactOpen] = useState(false);
  const [isDeleteContactOpen, setIsDeleteContactOpen] = useState(false);
  const [isSavingContact, setIsSavingContact] = useState(false);
  const [isDeletingContact, setIsDeletingContact] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<CustomerRow | null>(null);
  const [deletingCustomer, setDeletingCustomer] = useState<CustomerRow | null>(null);

  const [contactFormName, setContactFormName] = useState("");
  const [contactFormPhone, setContactFormPhone] = useState("");

  const [isLabelDialogOpen, setIsLabelDialogOpen] = useState(false);
  const [labelDialogMode, setLabelDialogMode] = useState<LabelDialogMode>("single");
  const [labelTargetCustomerIds, setLabelTargetCustomerIds] = useState<string[]>([]);
  const [labelSelectedTagIds, setLabelSelectedTagIds] = useState<string[]>([]);
  const [isAssigningLabels, setIsAssigningLabels] = useState(false);

  const [labelName, setLabelName] = useState("");
  const [labelColor, setLabelColor] = useState("emerald");
  const [customLabelColor, setCustomLabelColor] = useState(DEFAULT_CUSTOM_LABEL_COLOR);
  const [isCreatingLabel, setIsCreatingLabel] = useState(false);

  const selectedLabelColorValue = LABEL_COLORS.includes(labelColor) ? labelColor : CUSTOM_LABEL_COLOR_VALUE;
  const selectedLabelColorPreview = getColorPreview(labelColor);

  const loadCustomers = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(pageSize)
      });
      if (searchQuery.trim()) {
        params.set("q", searchQuery.trim());
      }
      if (selectedTagId) {
        params.set("tagId", selectedTagId);
      }

      const response = await fetch(`/api/customers?${params.toString()}`, { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as CustomersResponse | null;
      if (!response.ok) {
        throw new Error(payload?.error?.message ?? "Failed to load customer database.");
      }

      setCustomers(payload?.data?.customers ?? []);
      setTags(payload?.data?.tags ?? []);
      setTotalCustomers(payload?.meta?.total ?? payload?.data?.customers?.length ?? 0);
    } catch (loadError) {
      setError(toErrorMessage(loadError, "Failed to load customer database."));
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, searchQuery, selectedTagId]);

  const loadTags = useCallback(async () => {
    const response = await fetch("/api/tags", { cache: "no-store" });
    const payload = (await response.json().catch(() => null)) as TagsResponse | null;
    if (!response.ok) {
      throw new Error(payload?.error?.message ?? "Failed to load labels.");
    }

    setTags(payload?.data?.tags ?? []);
  }, []);

  useEffect(() => {
    void loadCustomers();
  }, [loadCustomers]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearchQuery(searchInput.trim());
      setPage(1);
    }, 250);

    return () => {
      window.clearTimeout(timer);
    };
  }, [searchInput]);

  const columns = useMemo<ColumnDef<CustomerRow>[]>(
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
        accessorKey: "displayName",
        header: ({ column }) => headerSortLabel("Nama", () => column.toggleSorting(column.getIsSorted() === "asc")),
        cell: ({ row }) => {
          const customer = row.original;
          return (
            <div className="flex min-w-[230px] items-center gap-3">
              {customer.avatarUrl ? (
                <div className="relative h-9 w-9 overflow-hidden rounded-full border border-border/70">
                  <Image src={customer.avatarUrl} alt={customer.displayName ?? customer.phoneE164} fill unoptimized className="object-cover" />
                </div>
              ) : (
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {toInitial(customer.displayName ?? customer.phoneE164)}
                </div>
              )}
              <div>
                <p className="text-sm font-semibold text-foreground">{customer.displayName?.trim() || customer.phoneE164}</p>
                <p className="text-xs text-muted-foreground">{customer.phoneE164}</p>
              </div>
            </div>
          );
        }
      },
      {
        accessorKey: "phoneE164",
        header: ({ column }) => headerSortLabel("WhatsApp", () => column.toggleSorting(column.getIsSorted() === "asc")),
        cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.phoneE164}</span>
      },
      {
        accessorKey: "createdAt",
        header: ({ column }) => headerSortLabel("Ditambahkan", () => column.toggleSorting(column.getIsSorted() === "asc")),
        cell: ({ row }) => <span className="text-sm text-muted-foreground">{formatDateLabel(row.original.createdAt)}</span>
      },
      {
        id: "conversation",
        accessorFn: (row) => row.conversationCount,
        header: ({ column }) => headerSortLabel("Percakapan", () => column.toggleSorting(column.getIsSorted() === "asc")),
        cell: ({ row }) => {
          const customer = row.original;
          if (customer.latestConversationId) {
            return (
              <Button asChild type="button" variant="secondary" className="h-8 rounded-full border border-emerald-300 bg-emerald-50 px-3 text-emerald-700">
                <Link prefetch={false} href={`/inbox?conversationId=${encodeURIComponent(customer.latestConversationId)}`}>
                  {customer.conversationCount} chat
                </Link>
              </Button>
            );
          }

          return (
            <Button
              type="button"
              variant="secondary"
              className="h-8 rounded-full border border-border px-3"
              onClick={async () => {
                try {
                  const response = await fetch("/api/conversations", {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                      phoneE164: customer.phoneE164,
                      customerDisplayName: customer.displayName ?? undefined
                    })
                  });
                  const payload = (await response.json().catch(() => null)) as
                    | {
                        data?: {
                          conversation?: {
                            id?: string;
                          };
                        };
                        error?: {
                          message?: string;
                        };
                      }
                    | null;

                  if (!response.ok || !payload?.data?.conversation?.id) {
                    throw new Error(payload?.error?.message ?? "Failed to open conversation.");
                  }

                  router.push(`/inbox?conversationId=${encodeURIComponent(payload.data.conversation.id)}`);
                } catch (openError) {
                  setError(toErrorMessage(openError, "Failed to open conversation."));
                }
              }}
            >
              Open chat
            </Button>
          );
        }
      },
      {
        id: "labels",
        accessorFn: (row) => row.tags.map((tag) => tag.name).join(" "),
        header: "Labels",
        cell: ({ row }) => (
          <div className="flex max-w-[280px] flex-wrap gap-2">
            {row.original.tags.length > 0 ? (
              row.original.tags.map((tag) => (
                <Badge key={tag.id} variant="outline" className="rounded-full">
                  {tag.name}
                </Badge>
              ))
            ) : (
              <span className="text-sm text-muted-foreground">-</span>
            )}
          </div>
        )
      },
      {
        id: "updatedAt",
        accessorFn: (row) => row.updatedAt,
        header: "Updated",
        cell: ({ row }) => <span className="text-sm text-muted-foreground">{formatDateLabel(row.original.updatedAt)}</span>
      },
      {
        id: "actions",
        enableHiding: false,
        cell: ({ row }) => {
          const customer = row.original;
          return (
            <div className="text-right">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="ghost" className="h-8 w-8 p-0">
                    <span className="sr-only">Open menu</span>
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Aksi Kontak</DropdownMenuLabel>
                  <DropdownMenuItem
                    onClick={() => {
                      setEditingCustomer(customer);
                      setContactFormName(customer.displayName ?? "");
                      setContactFormPhone(customer.phoneE164);
                      setIsEditContactOpen(true);
                    }}
                  >
                    Edit kontak
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      setLabelDialogMode("single");
                      setLabelTargetCustomerIds([customer.id]);
                      setLabelSelectedTagIds(customer.tags.map((tag) => tag.id));
                      setIsLabelDialogOpen(true);
                    }}
                  >
                    Kelola label
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={() => {
                      setDeletingCustomer(customer);
                      setIsDeleteContactOpen(true);
                    }}
                  >
                    Hapus kontak
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        }
      }
    ],
    [router]
  );

  const table = useReactTable({
    data: customers,
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
      columnVisibility: {
        updatedAt: false
      }
    }
  });

  const selectedCustomerIds = table.getSelectedRowModel().rows.map((row) => row.original.id);
  const totalPages = Math.max(1, Math.ceil(totalCustomers / pageSize));

  async function handleCreateContact() {
    try {
      setIsSavingContact(true);
      setError(null);
      setSuccess(null);

      const response = await fetch("/api/customers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: contactFormName.trim(),
          phoneE164: contactFormPhone.trim()
        })
      });
      const payload = (await response.json().catch(() => null)) as ApiError | null;
      if (!response.ok) {
        throw new Error(payload?.error?.message ?? "Failed to create contact.");
      }

      setContactFormName("");
      setContactFormPhone("");
      setIsCreateContactOpen(false);
      setSuccess("Kontak berhasil ditambahkan.");
      if (page !== 1) {
        setPage(1);
      } else {
        await loadCustomers();
      }
    } catch (saveError) {
      setError(toErrorMessage(saveError, "Failed to create contact."));
    } finally {
      setIsSavingContact(false);
    }
  }

  async function handleUpdateContact() {
    if (!editingCustomer) {
      return;
    }

    try {
      setIsSavingContact(true);
      setError(null);
      setSuccess(null);

      const response = await fetch(`/api/customers/${encodeURIComponent(editingCustomer.id)}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: contactFormName.trim(),
          phoneE164: contactFormPhone.trim()
        })
      });
      const payload = (await response.json().catch(() => null)) as ApiError | null;
      if (!response.ok) {
        throw new Error(payload?.error?.message ?? "Failed to update contact.");
      }

      setEditingCustomer(null);
      setIsEditContactOpen(false);
      setSuccess("Kontak berhasil diperbarui.");
      await loadCustomers();
    } catch (saveError) {
      setError(toErrorMessage(saveError, "Failed to update contact."));
    } finally {
      setIsSavingContact(false);
    }
  }

  async function handleDeleteContact() {
    if (!deletingCustomer) {
      return;
    }

    try {
      setIsDeletingContact(true);
      setError(null);
      setSuccess(null);

      const response = await fetch(`/api/customers/${encodeURIComponent(deletingCustomer.id)}`, {
        method: "DELETE"
      });
      const payload = (await response.json().catch(() => null)) as ApiError | null;
      if (!response.ok) {
        throw new Error(payload?.error?.message ?? "Failed to delete contact.");
      }

      setDeletingCustomer(null);
      setIsDeleteContactOpen(false);
      setSuccess("Kontak berhasil dihapus.");
      setRowSelection({});
      const nextPage = customers.length === 1 && page > 1 ? page - 1 : page;
      if (nextPage !== page) {
        setPage(nextPage);
      } else {
        await loadCustomers();
      }
    } catch (deleteError) {
      setError(toErrorMessage(deleteError, "Failed to delete contact."));
    } finally {
      setIsDeletingContact(false);
    }
  }

  async function handleAssignLabels() {
    try {
      setIsAssigningLabels(true);
      setError(null);
      setSuccess(null);

      if (labelDialogMode === "single" && labelTargetCustomerIds.length === 1) {
        const response = await fetch(`/api/customers/${encodeURIComponent(labelTargetCustomerIds[0] ?? "")}/tags`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            tagIds: labelSelectedTagIds
          })
        });
        const payload = (await response.json().catch(() => null)) as ApiError | null;
        if (!response.ok) {
          throw new Error(payload?.error?.message ?? "Failed to update labels.");
        }
      } else {
        const response = await fetch("/api/customers/tags/bulk", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            customerIds: labelTargetCustomerIds,
            tagIds: labelSelectedTagIds,
            mode: "append"
          })
        });
        const payload = (await response.json().catch(() => null)) as ApiError | null;
        if (!response.ok) {
          throw new Error(payload?.error?.message ?? "Failed to assign labels in bulk.");
        }
      }

      setIsLabelDialogOpen(false);
      setLabelTargetCustomerIds([]);
      setLabelSelectedTagIds([]);
      setSuccess(labelDialogMode === "single" ? "Label kontak berhasil diperbarui." : "Label berhasil ditambahkan ke kontak terpilih.");
      setRowSelection({});
      await loadCustomers();
    } catch (assignError) {
      setError(toErrorMessage(assignError, "Failed to assign labels."));
    } finally {
      setIsAssigningLabels(false);
    }
  }

  async function handleCreateLabel() {
    if (!labelName.trim()) {
      return;
    }

    try {
      setIsCreatingLabel(true);
      setError(null);
      setSuccess(null);

      const response = await fetch("/api/tags", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: labelName.trim(),
          color: labelColor
        })
      });
      const payload = (await response.json().catch(() => null)) as ApiError | null;
      if (!response.ok) {
        throw new Error(payload?.error?.message ?? "Failed to create label.");
      }

      setLabelName("");
      setLabelColor("emerald");
      setCustomLabelColor(DEFAULT_CUSTOM_LABEL_COLOR);
      setSuccess("Label berhasil dibuat.");
      await loadTags();
      await loadCustomers();
    } catch (createError) {
      setError(toErrorMessage(createError, "Failed to create label."));
    } finally {
      setIsCreatingLabel(false);
    }
  }

  return (
    <section className="flex h-full min-h-0 flex-1 overflow-hidden">
      <div className="flex h-full min-h-0 w-full flex-col gap-3 rounded-2xl border border-border/70 bg-card/95 p-3 shadow-sm md:gap-4 md:p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground md:text-3xl">Database Kontak</h1>
            <p className="mt-1 text-xs text-muted-foreground md:text-sm">Total: {totalCustomers} kontak aktif di bisnis Anda.</p>
          </div>
          <div className="flex w-full flex-wrap gap-2 md:w-auto">
            <Button type="button" variant="secondary" className="gap-2 rounded-lg border border-border/80 bg-background text-xs md:rounded-xl md:text-sm" disabled>
              <span className="text-red-500">◌</span>
              Logs
            </Button>
            <Button type="button" variant="secondary" className="gap-2 rounded-lg border border-border/80 bg-background text-xs md:rounded-xl md:text-sm" disabled>
              <Download className="h-4 w-4" />
              Export
            </Button>
            <Button type="button" variant="secondary" className="gap-2 rounded-lg border border-border/80 bg-background text-xs md:rounded-xl md:text-sm" disabled>
              <Upload className="h-4 w-4" />
              Import
            </Button>
            <Button
              type="button"
              className="gap-2 rounded-lg text-xs md:rounded-xl md:text-sm"
              onClick={() => {
                setContactFormName("");
                setContactFormPhone("");
                setIsCreateContactOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Tambah Kontak
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "contacts" | "labels")} className="w-full">
          <TabsList className="h-10 w-full max-w-md justify-start rounded-lg border border-border/80 bg-background/70 p-1 md:h-11 md:rounded-xl">
            <TabsTrigger value="contacts" className="h-8 rounded-md px-3 text-xs md:h-9 md:rounded-lg md:px-4 md:text-sm">
              <UsersRound className="mr-2 h-4 w-4" />
              All Contacts
            </TabsTrigger>
            <TabsTrigger value="labels" className="h-8 rounded-md px-3 text-xs md:h-9 md:rounded-lg md:px-4 md:text-sm">
              <Tags className="mr-2 h-4 w-4" />
              Label Management
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {error ? <OperationFeedback tone="error" message={error} /> : null}
        {!error && success ? <OperationFeedback tone="success" message={success} /> : null}

        {activeTab === "contacts" ? (
          <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-border/70 bg-background/50 md:rounded-[20px]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-3 py-3 md:px-4 md:py-4">
              <div className="flex w-full flex-wrap items-center gap-2 md:w-auto">
                <div className="relative w-full max-w-md">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Cari nama atau nomor..."
                    value={searchInput}
                    onChange={(event) => setSearchInput(event.target.value)}
                    className="h-9 rounded-lg pl-10 md:h-10 md:rounded-xl"
                  />
                </div>
                <Select
                  value={selectedTagId || "__all__"}
                  onValueChange={(value) => {
                    setSelectedTagId(value === "__all__" ? "" : value);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="h-9 w-full rounded-lg md:h-10 md:w-[190px] md:rounded-xl">
                    <SelectValue placeholder="Semua Label" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Semua Label</SelectItem>
                    {tags.map((tag) => (
                      <SelectItem key={tag.id} value={tag.id}>
                        {tag.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex w-full flex-wrap items-center gap-2 md:w-auto">
                {selectedCustomerIds.length > 0 ? (
                  <Button
                    type="button"
                    variant="secondary"
                    className="rounded-lg text-xs md:rounded-xl md:text-sm"
                    onClick={() => {
                      setLabelDialogMode("bulk");
                      setLabelTargetCustomerIds(selectedCustomerIds);
                      setLabelSelectedTagIds([]);
                      setIsLabelDialogOpen(true);
                    }}
                  >
                    Assign Label ({selectedCustomerIds.length})
                  </Button>
                ) : null}

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" variant="secondary" className="rounded-lg border border-border/80 bg-background text-xs md:rounded-xl md:text-sm">
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

            <div className="min-h-0 flex-1 overflow-auto">
              <Table className="min-w-[980px]">
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
                        Loading customers...
                      </TableCell>
                    </TableRow>
                  ) : table.getRowModel().rows.length ? (
                    table.getRowModel().rows.map((row) => (
                      <TableRow key={row.id} data-state={row.getIsSelected() ? "selected" : undefined}>
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                        No contact found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/70 px-3 py-3 md:px-4">
              <p className="text-xs text-muted-foreground md:text-sm">
                {table.getSelectedRowModel().rows.length} dari {customers.length} kontak pada halaman ini terpilih.
              </p>
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
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
            <div className="rounded-[20px] border border-border/70 bg-background/60 p-4">
              <h2 className="text-sm font-semibold text-foreground">Create New Label</h2>
              <div className="mt-4 space-y-3">
                <Input value={labelName} onChange={(event) => setLabelName(event.target.value)} placeholder="Label name" className="h-10 rounded-xl" />
                <Select
                  value={selectedLabelColorValue}
                  onValueChange={(value) => {
                    setLabelColor(value === CUSTOM_LABEL_COLOR_VALUE ? customLabelColor : value);
                  }}
                >
                  <SelectTrigger className="h-10 rounded-xl">
                    <SelectValue>
                      <div className="flex items-center gap-2">
                        <span className="h-3 w-3 rounded-full border border-black/10" style={{ backgroundColor: selectedLabelColorPreview }} />
                        <span>{selectedLabelColorValue === CUSTOM_LABEL_COLOR_VALUE ? `Custom (${labelColor})` : labelColor}</span>
                      </div>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {LABEL_COLORS.map((color) => (
                      <SelectItem key={color} value={color}>
                        <div className="flex items-center gap-2">
                          <span className="h-3 w-3 rounded-full border border-black/10" style={{ backgroundColor: getColorPreview(color) }} />
                          <span>{color}</span>
                        </div>
                      </SelectItem>
                    ))}
                    <SelectItem value={CUSTOM_LABEL_COLOR_VALUE}>
                      <div className="flex items-center gap-2">
                        <span className="h-3 w-3 rounded-full border border-black/10" style={{ backgroundColor: customLabelColor }} />
                        <span>Custom</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <div className="rounded-xl border border-border/70 bg-background/70 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Custom Color</p>
                      <p className="mt-1 text-xs text-muted-foreground">Pilih warna bebas jika preset tidak cocok.</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="h-8 w-8 rounded-full border border-black/10 shadow-sm" style={{ backgroundColor: customLabelColor }} />
                      <Input
                        type="color"
                        value={customLabelColor}
                        onChange={(event) => {
                          const nextColor = event.target.value;
                          setCustomLabelColor(nextColor);
                          if (selectedLabelColorValue === CUSTOM_LABEL_COLOR_VALUE || !LABEL_COLORS.includes(labelColor)) {
                            setLabelColor(nextColor);
                          }
                        }}
                        className="h-10 w-16 cursor-pointer rounded-lg p-1"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    className="mt-3 inline-flex items-center gap-2 rounded-lg border border-border/70 px-3 py-2 text-xs font-medium text-foreground transition hover:bg-accent"
                    onClick={() => setLabelColor(customLabelColor)}
                  >
                    <span className="h-3 w-3 rounded-full border border-black/10" style={{ backgroundColor: customLabelColor }} />
                    Gunakan warna custom
                  </button>
                </div>
                <Button type="button" className="w-full rounded-xl" disabled={!labelName.trim() || isCreatingLabel} onClick={() => void handleCreateLabel()}>
                  {isCreatingLabel ? "Creating..." : "Create Label"}
                </Button>
              </div>
            </div>

            <div className="rounded-[20px] border border-border/70 bg-background/60 p-4">
              <h2 className="text-sm font-semibold text-foreground">Label Table</h2>
              <div className="mt-4 overflow-hidden rounded-xl border border-border/70">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Color</TableHead>
                      <TableHead className="text-right">Contacts</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tags.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="h-16 text-center text-muted-foreground">
                          No labels available.
                        </TableCell>
                      </TableRow>
                    ) : (
                      tags.map((tag) => (
                        <TableRow key={tag.id}>
                          <TableCell className="font-medium">{tag.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="rounded-full">
                              <span className="mr-2 h-2.5 w-2.5 rounded-full border border-black/10" style={{ backgroundColor: getColorPreview(tag.color) }} />
                              {tag.color}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">{tag.customerCount ?? 0}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        )}
      </div>

      <Dialog open={isCreateContactOpen} onOpenChange={setIsCreateContactOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tambah Kontak</DialogTitle>
            <DialogDescription>Simpan customer baru ke database kontak bisnis.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <Input value={contactFormName} onChange={(event) => setContactFormName(event.target.value)} placeholder="Nama customer" />
            <Input value={contactFormPhone} onChange={(event) => setContactFormPhone(event.target.value)} placeholder="Nomor WhatsApp (+628...)" />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setIsCreateContactOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void handleCreateContact()} disabled={isSavingContact || !contactFormPhone.trim()}>
              {isSavingContact ? "Saving..." : "Save Contact"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditContactOpen} onOpenChange={setIsEditContactOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Kontak</DialogTitle>
            <DialogDescription>Perbarui nama atau nomor WhatsApp kontak.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <Input value={contactFormName} onChange={(event) => setContactFormName(event.target.value)} placeholder="Nama customer" />
            <Input value={contactFormPhone} onChange={(event) => setContactFormPhone(event.target.value)} placeholder="Nomor WhatsApp (+628...)" />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setIsEditContactOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void handleUpdateContact()} disabled={isSavingContact || !contactFormPhone.trim()}>
              {isSavingContact ? "Saving..." : "Update Contact"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteContactOpen} onOpenChange={setIsDeleteContactOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus Kontak</DialogTitle>
            <DialogDescription>
              Yakin ingin menghapus kontak <strong>{deletingCustomer?.displayName ?? deletingCustomer?.phoneE164 ?? ""}</strong>? Tindakan ini tidak bisa dibatalkan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setIsDeleteContactOpen(false)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={() => void handleDeleteContact()} disabled={isDeletingContact}>
              {isDeletingContact ? "Deleting..." : "Delete Contact"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isLabelDialogOpen} onOpenChange={setIsLabelDialogOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>{labelDialogMode === "single" ? "Kelola Label Kontak" : "Assign Label Massal"}</DialogTitle>
            <DialogDescription>
              {labelDialogMode === "single"
                ? "Pilih label untuk kontak ini. Pilihan akan menggantikan label sebelumnya."
                : `Tambahkan label ke ${labelTargetCustomerIds.length} kontak terpilih.`}
            </DialogDescription>
          </DialogHeader>

          <div className="grid max-h-[320px] grid-cols-1 gap-2 overflow-auto rounded-xl border border-border/70 p-3 md:grid-cols-2">
            {tags.length === 0 ? <p className="text-sm text-muted-foreground">Belum ada label. Buat label terlebih dahulu.</p> : null}
            {tags.map((tag) => {
              const checked = labelSelectedTagIds.includes(tag.id);
              return (
                <label key={tag.id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-border/70 px-3 py-2 hover:bg-accent/40">
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(value) => {
                      if (value) {
                        setLabelSelectedTagIds((current) => Array.from(new Set([...current, tag.id])));
                        return;
                      }

                      setLabelSelectedTagIds((current) => current.filter((item) => item !== tag.id));
                    }}
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{tag.name}</p>
                    <p className="text-xs text-muted-foreground">{tag.customerCount ?? 0} contacts</p>
                  </div>
                </label>
              );
            })}
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setIsLabelDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleAssignLabels()}
              disabled={isAssigningLabels || (labelDialogMode === "bulk" && labelSelectedTagIds.length === 0)}
            >
              {isAssigningLabels ? "Saving..." : "Apply Labels"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
