"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { addDays } from "date-fns";
import { InvoiceKind, PaymentMilestoneType } from "@prisma/client";
import { CalendarDays, ChevronDown, Info, Plus, Trash2 } from "lucide-react";

import { InvoiceStatusBadge } from "@/components/invoices/InvoiceStatusBadge";
import {
  computeInvoiceLine,
  INVOICE_TAX_OPTIONS,
  type InvoiceDrawerProps,
  toRupiahLabel
} from "@/components/invoices/invoice-drawer/types";
import { useInvoiceDrawer } from "@/components/invoices/invoice-drawer/useInvoiceDrawer";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type MemberOption = {
  userId: string;
  name: string | null;
  email: string;
  role: string;
};

type ProfilePayload = {
  data?: {
    user?: {
      id: string;
      name: string | null;
      email: string;
    };
  };
};

type BusinessProfilePayload = {
  data?: {
    profile?: {
      id: string;
      name: string;
      legalName: string | null;
      responsibleName: string | null;
      businessPhone: string | null;
      businessEmail: string | null;
      businessAddress: string | null;
      logoUrl: string | null;
      invoiceSignatureUrl: string | null;
    };
  };
};

type BusinessProfile = NonNullable<BusinessProfilePayload["data"]>["profile"];

type CatalogItemRecord = {
  id: string;
  name: string;
  category: string | null;
  unit: string | null;
  priceCents: number | null;
  currency: string;
};

type CatalogResponse = {
  data?: {
    items?: CatalogItemRecord[];
    item?: CatalogItemRecord;
  };
  error?: {
    message?: string;
  };
};

type CatalogDraft = {
  name: string;
  category: string;
  unit: string;
  priceCents: string;
};

function formatDateLabel(value: Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(value);
}

function toInputDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function parseInputDate(value: string): Date | undefined {
  if (!value) {
    return undefined;
  }

  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function FieldHint({ text }: { text: string }) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" className="inline-flex text-sky-500" aria-label={text}>
            <Info className="h-4 w-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent>{text}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function toPlainNumberLabel(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 0
  }).format(value);
}

function createEmptyCatalogDraft(): CatalogDraft {
  return {
    name: "",
    category: "",
    unit: "",
    priceCents: ""
  };
}

function buildCatalogCode(id: string): string {
  return `SRV-${id.slice(-6).toUpperCase()}`;
}

function buildDefaultInvoiceNotes(profile: BusinessProfile | null): string {
  if (!profile) {
    return "Pembayaran dapat dilakukan ke rekening yang tertera pada invoice. Mohon cantumkan nomor invoice sebagai berita transfer.";
  }

  const contact = profile.businessEmail || profile.businessPhone || "-";
  return `Pembayaran dapat dilakukan ke rekening yang tertera pada invoice. Mohon cantumkan nomor invoice sebagai berita transfer.\nKontak billing: ${contact}`;
}

function buildDefaultInvoiceTerms(profile: BusinessProfile | null): string {
  const companyName = profile?.legalName || profile?.name || "Perusahaan";
  return [
    `1. Pembayaran dianggap sah setelah dana diterima oleh ${companyName}.`,
    "2. Invoice yang sudah dibayar tidak dapat dibatalkan sepihak.",
    "3. Komplain layanan maksimal 3x24 jam setelah pembayaran."
  ].join("\n");
}

function DueDatePickerField({
  value,
  onChange
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const selectedDate = useMemo(() => parseInputDate(value), [value]);
  const [currentMonth, setCurrentMonth] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  useEffect(() => {
    const baseDate = selectedDate ?? new Date();
    setCurrentMonth(new Date(baseDate.getFullYear(), baseDate.getMonth(), 1));
  }, [value, selectedDate]);

  return (
    <div className="space-y-2">
      <span className="text-sm font-medium text-foreground">Tgl. Jatuh Tempo</span>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            className="h-11 w-full justify-between rounded-md border border-border bg-muted/40 px-3 text-left font-normal hover:bg-muted/60"
          >
            <span className={cn("truncate", !selectedDate && "text-muted-foreground")}>
              {selectedDate ? formatDateLabel(selectedDate) : "Pilih tanggal jatuh tempo"}
            </span>
            <CalendarDays className="h-4 w-4 text-sky-500" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[300px] rounded-2xl border border-border p-0">
          <Card className="w-full rounded-2xl border-0 shadow-none">
            <CardContent className="p-0">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => onChange(date ? toInputDate(date) : "")}
                month={currentMonth}
                onMonthChange={setCurrentMonth}
                fixedWeeks
                className="rounded-t-2xl px-4 pb-4 pt-4"
                classNames={{
                  month_caption: "relative flex items-center justify-center pb-2",
                  caption_label: "text-sm font-semibold text-foreground",
                  button_previous:
                    "absolute left-0 inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground",
                  button_next:
                    "absolute right-0 inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground",
                  weekdays: "mb-1 grid grid-cols-7",
                  weekday: "flex h-8 items-center justify-center text-xs font-medium text-muted-foreground",
                  week: "grid grid-cols-7",
                  day: "flex items-center justify-center",
                  day_button:
                    "inline-flex h-8 w-8 items-center justify-center rounded-md text-sm font-normal text-foreground transition hover:bg-muted",
                  selected: "rounded-md bg-muted font-medium text-foreground hover:bg-muted",
                  today: "rounded-md bg-muted/70 text-foreground",
                  outside: "text-muted-foreground opacity-45"
                }}
              />
            </CardContent>
            <CardFooter className="flex flex-wrap gap-2 border-t px-4 py-3">
              {[
                { label: "Today", value: 0 },
                { label: "Tomorrow", value: 1 },
                { label: "In 3 days", value: 3 },
                { label: "In a week", value: 7 },
                { label: "In 2 weeks", value: 14 }
              ].map((preset) => (
                <Button
                  key={preset.value}
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 min-w-[82px] flex-1 rounded-lg border border-border bg-background px-2 text-xs"
                  onClick={() => {
                    const newDate = addDays(new Date(), preset.value);
                    onChange(toInputDate(newDate));
                    setCurrentMonth(new Date(newDate.getFullYear(), newDate.getMonth(), 1));
                  }}
                >
                  {preset.label}
                </Button>
              ))}
            </CardFooter>
          </Card>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export function InvoiceDrawer({
  open,
  customerId,
  conversationId,
  orgId,
  customerDisplayName,
  customerPhoneE164,
  onClose
}: InvoiceDrawerProps) {
  const [salesMembers, setSalesMembers] = useState<MemberOption[]>([]);
  const [selectedSalesperson, setSelectedSalesperson] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");
  const [currentUserLabel, setCurrentUserLabel] = useState("Business Owner");
  const [customerName, setCustomerName] = useState(customerDisplayName?.trim() || "");
  const [customerPhone, setCustomerPhone] = useState(customerPhoneE164 ?? "");
  const [isManualCustomerModalOpen, setIsManualCustomerModalOpen] = useState(false);
  const [manualCustomerName, setManualCustomerName] = useState(customerDisplayName?.trim() || "");
  const [manualCustomerPhone, setManualCustomerPhone] = useState(customerPhoneE164 ?? "");
  const [manualCustomerAddress, setManualCustomerAddress] = useState("");
  const [manualCustomerEmail, setManualCustomerEmail] = useState("");
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile | null>(null);
  const [isCatalogModalOpen, setIsCatalogModalOpen] = useState(false);
  const [isCreateCatalogModalOpen, setIsCreateCatalogModalOpen] = useState(false);
  const [catalogItems, setCatalogItems] = useState<CatalogItemRecord[]>([]);
  const [catalogSearchCode, setCatalogSearchCode] = useState("");
  const [catalogSearchName, setCatalogSearchName] = useState("");
  const [catalogSearchCategory, setCatalogSearchCategory] = useState("");
  const [catalogSelectedIds, setCatalogSelectedIds] = useState<string[]>([]);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [isCatalogLoading, setIsCatalogLoading] = useState(false);
  const [isCatalogCreating, setIsCatalogCreating] = useState(false);
  const [catalogDraft, setCatalogDraft] = useState<CatalogDraft>(createEmptyCatalogDraft);

  const {
    kind,
    setKind,
    items,
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
    handleCreateInvoice,
    handleUpdateItems,
    handleSendInvoice,
    handleMarkPaid
  } = useInvoiceDrawer({ open, customerId, conversationId, orgId, customerDisplayName, customerPhoneE164, onClose });

  useEffect(() => {
    if (!open) {
      return;
    }

    setCustomerName(customerDisplayName?.trim() || "");
    setCustomerPhone(customerPhoneE164 ?? "");
    setManualCustomerName(customerDisplayName?.trim() || "");
    setManualCustomerPhone(customerPhoneE164 ?? "");
    setManualCustomerAddress("");
    setManualCustomerEmail("");
    setNotes((current) => current || buildDefaultInvoiceNotes(businessProfile));
    setTerms((current) => current || buildDefaultInvoiceTerms(businessProfile));
  }, [open, customerDisplayName, customerPhoneE164, businessProfile, setNotes, setTerms]);

  useEffect(() => {
    if (!open || !businessProfile) {
      return;
    }

    setNotes((current) => (current.trim() ? current : buildDefaultInvoiceNotes(businessProfile)));
    setTerms((current) => (current.trim() ? current : buildDefaultInvoiceTerms(businessProfile)));
  }, [open, businessProfile, setNotes, setTerms]);

  useEffect(() => {
    if (open) {
      return;
    }

    setIsCatalogModalOpen(false);
    setIsCreateCatalogModalOpen(false);
    setCatalogItems([]);
    setCatalogSearchCode("");
    setCatalogSearchName("");
    setCatalogSearchCategory("");
    setCatalogSelectedIds([]);
    setCatalogError(null);
    setIsCatalogLoading(false);
    setIsCatalogCreating(false);
    setCatalogDraft(createEmptyCatalogDraft());
  }, [open]);

  function handleOpenManualCustomerModal() {
    setManualCustomerName(customerName.trim() || customerDisplayName?.trim() || "");
    setManualCustomerPhone(customerPhone.trim() || customerPhoneE164 || "");
    setIsManualCustomerModalOpen(true);
  }

  function handleApplyManualCustomer() {
    setCustomerName(manualCustomerName.trim());
    setCustomerPhone(manualCustomerPhone.trim());
    setIsManualCustomerModalOpen(false);
  }

  const loadCatalogItems = useCallback(async () => {
    setCatalogError(null);
    setIsCatalogLoading(true);
    try {
      const query = new URLSearchParams();
      if (orgId) {
        query.set("orgId", orgId);
      }

      const response = await fetch(`/api/catalog?${query.toString()}`, {
        cache: "no-store"
      });
      const body = (await response.json().catch(() => null)) as CatalogResponse | null;
      if (!response.ok) {
        setCatalogError(body?.error?.message ?? "Gagal memuat katalog produk.");
        return;
      }

      setCatalogItems(body?.data?.items ?? []);
    } catch {
      setCatalogError("Terjadi gangguan jaringan saat memuat katalog produk.");
    } finally {
      setIsCatalogLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    if (!open || !isCatalogModalOpen) {
      return;
    }

    void loadCatalogItems();
  }, [isCatalogModalOpen, loadCatalogItems, open]);

  async function handleCreateCatalog() {
    if (isCatalogCreating) {
      return;
    }

    setCatalogError(null);
    setIsCatalogCreating(true);
    try {
      const response = await fetch("/api/catalog", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          orgId: orgId ?? undefined,
          name: catalogDraft.name.trim(),
          category: catalogDraft.category.trim() || undefined,
          unit: catalogDraft.unit.trim() || undefined,
          priceCents: Number(catalogDraft.priceCents)
        })
      });

      const body = (await response.json().catch(() => null)) as CatalogResponse | null;
      if (!response.ok) {
        setCatalogError(body?.error?.message ?? "Gagal membuat item katalog.");
        return;
      }

      setCatalogDraft(createEmptyCatalogDraft());
      setIsCreateCatalogModalOpen(false);
      await loadCatalogItems();
    } catch {
      setCatalogError("Terjadi gangguan jaringan saat membuat item katalog.");
    } finally {
      setIsCatalogCreating(false);
    }
  }

  function toggleCatalogSelection(itemId: string) {
    setCatalogSelectedIds((current) => (current.includes(itemId) ? current.filter((id) => id !== itemId) : [...current, itemId]));
  }

  function handleApplyCatalogItems() {
    const selectedItems = catalogItems.filter((item) => catalogSelectedIds.includes(item.id));
    selectedItems.forEach((item) =>
      addItemFromCatalog({
        name: item.name,
        unit: item.unit ?? "",
        priceCents: item.priceCents ?? 0
      })
    );
    setCatalogSelectedIds([]);
    setIsCatalogModalOpen(false);
  }

  useEffect(() => {
    if (!open) {
      return;
    }

    let ignore = false;

    async function bootstrapDrawer() {
      try {
        const [profileResponse, membersResponse, businessResponse] = await Promise.all([
          fetch("/api/auth/profile", { cache: "no-store" }),
          orgId ? fetch(`/api/orgs/members?orgId=${encodeURIComponent(orgId)}`, { cache: "no-store" }) : Promise.resolve(null),
          fetch(`/api/orgs/business${orgId ? `?orgId=${encodeURIComponent(orgId)}` : ""}`, { cache: "no-store" })
        ]);

        const profilePayload = (await profileResponse.json().catch(() => null)) as ProfilePayload | null;
        const user = profilePayload?.data?.user;
        const nextUserId = user?.id ?? "";
        const nextUserLabel = user?.name?.trim() || user?.email || "Business Owner";

        if (!ignore) {
          setCurrentUserId(nextUserId);
          setCurrentUserLabel(nextUserLabel);
        }

        const businessPayload = (await businessResponse.json().catch(() => null)) as BusinessProfilePayload | null;
        if (!ignore) {
          setBusinessProfile(businessPayload?.data?.profile ?? null);
        }

        if (!membersResponse) {
          if (!ignore) {
            setSalesMembers([]);
            setSelectedSalesperson(nextUserId);
          }
          return;
        }

        const membersPayload = (await membersResponse.json().catch(() => null)) as { data?: { members?: MemberOption[] } } | null;
        const nextMembers = membersPayload?.data?.members ?? [];

        if (!ignore) {
          setSalesMembers(nextMembers);
          const fallbackMember =
            nextMembers.find((member) => member.userId === nextUserId) ??
            nextMembers.find((member) => member.role === "OWNER") ??
            nextMembers[0] ??
            null;
          setSelectedSalesperson(fallbackMember?.userId ?? nextUserId);
        }
      } catch {
        if (!ignore) {
          setSalesMembers([]);
          setSelectedSalesperson(currentUserId);
          setBusinessProfile(null);
        }
      }
    }

    void bootstrapDrawer();
    return () => {
      ignore = true;
    };
  }, [currentUserId, open, orgId]);

  const canCreateDraft = !isSubmitting && Boolean(customerId);
  const canUpdateDraft = !isUpdatingItems && Boolean(invoiceId);
  const canSendInvoice = !isSendingInvoice && Boolean(invoiceId);
  const canMarkPaid = !isMarkingPaid && Boolean(invoiceId);
  const lineSummaries = items.map((item) => computeInvoiceLine(item));
  const dpAmountCents = kind === InvoiceKind.DP_AND_FINAL ? Math.round((totalCents * dpPercentage) / 100) : totalCents;
  const finalAmountCents = kind === InvoiceKind.DP_AND_FINAL ? Math.max(0, totalCents - dpAmountCents) : 0;
  const filteredCatalogItems = catalogItems.filter((item) => {
    const code = buildCatalogCode(item.id).toLowerCase();
    const name = item.name.toLowerCase();
    const category = (item.category ?? "").toLowerCase();

    return (
      (!catalogSearchCode.trim() || code.includes(catalogSearchCode.trim().toLowerCase())) &&
      (!catalogSearchName.trim() || name.includes(catalogSearchName.trim().toLowerCase())) &&
      (!catalogSearchCategory.trim() || category.includes(catalogSearchCategory.trim().toLowerCase()))
    );
  });

  return (
    <Drawer open={open} onOpenChange={(nextOpen) => (!nextOpen ? onClose() : undefined)} direction="right">
      <DrawerContent className="data-[vaul-drawer-direction=right]:border-l-border lg:max-w-4xl xl:max-w-[1100px]">
        <DrawerHeader className="shrink-0 border-b border-border/70 px-5 py-4 md:px-6">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-3">
              <div>
                <DrawerTitle>Invoice</DrawerTitle>
                <DrawerDescription>Susun invoice customer dari percakapan aktif.</DrawerDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setKind(InvoiceKind.FULL)}
                  className={cn(
                    "rounded-md border px-3 py-2 text-xs font-medium transition",
                    kind === InvoiceKind.FULL
                      ? "border-transparent bg-foreground text-background shadow-md shadow-foreground/5"
                      : "border-border bg-background text-muted-foreground hover:bg-accent"
                  )}
                >
                  Full Payment
                </button>
                <button
                  type="button"
                  onClick={() => setKind(InvoiceKind.DP_AND_FINAL)}
                  className={cn(
                    "rounded-md border px-3 py-2 text-xs font-medium transition",
                    kind === InvoiceKind.DP_AND_FINAL
                      ? "border-transparent bg-primary text-primary-foreground shadow-md shadow-primary/20"
                      : "border-border bg-background text-muted-foreground hover:bg-accent"
                  )}
                >
                  Down Payment
                </button>
                {invoiceNo ? (
                  <span className="rounded-md border border-border bg-background px-3 py-1 text-xs text-muted-foreground">{invoiceNo}</span>
                ) : null}
                {invoiceStatus ? <InvoiceStatusBadge status={invoiceStatus} /> : null}
              </div>
            </div>
            <DrawerClose asChild>
              <Button type="button" variant="ghost">
                Close
              </Button>
            </DrawerClose>
          </div>
        </DrawerHeader>

        <form id="invoice-drawer-form" className="flex min-h-0 flex-1 flex-col overflow-hidden" onSubmit={handleCreateInvoice}>
          <div className="inbox-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-36 pt-4 md:px-6 md:pt-5">
            <div className="space-y-6">
              <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                <div className="space-y-4">
                  <div className="grid gap-4 lg:grid-cols-2">
                    <label className="space-y-2">
                      <span className="text-sm font-medium text-foreground">Salesperson</span>
                      <div className="rounded-md border border-border bg-muted/40 px-3">
                        <select
                          value={selectedSalesperson}
                          onChange={(event) => setSelectedSalesperson(event.target.value)}
                          className="h-11 w-full bg-transparent text-sm outline-none"
                        >
                          {salesMembers.length === 0 ? <option value={currentUserId}>{currentUserLabel}</option> : null}
                          {salesMembers.map((member) => (
                            <option key={member.userId} value={member.userId}>
                              {(member.name?.trim() || member.email)} • {member.role}
                            </option>
                          ))}
                        </select>
                      </div>
                    </label>

                    <DueDatePickerField value={invoiceDueDate} onChange={setInvoiceDueDate} />

                    <label className="space-y-2">
                      <span className="flex items-center justify-between gap-2 text-sm font-medium text-foreground">
                        Pelanggan
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 rounded-md border border-border px-2 text-[11px] text-muted-foreground hover:text-foreground"
                          onClick={handleOpenManualCustomerModal}
                        >
                          <Plus className="mr-1 h-3.5 w-3.5" />
                          Tambah Manual
                        </Button>
                      </span>
                      <Input
                        value={customerName}
                        onChange={(event) => setCustomerName(event.target.value)}
                        placeholder="Nama pelanggan"
                        className="h-11 rounded-md border-border bg-muted/40"
                      />
                    </label>

                    <label className="space-y-2">
                      <span className="flex items-center justify-between gap-2 text-sm font-medium text-foreground">
                        Nomor WhatsApp
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 rounded-md border border-border px-2 text-[11px] text-muted-foreground hover:text-foreground"
                          onClick={handleOpenManualCustomerModal}
                        >
                          <Plus className="mr-1 h-3.5 w-3.5" />
                          Tambah Manual
                        </Button>
                      </span>
                      <Input
                        value={customerPhone}
                        onChange={(event) => setCustomerPhone(event.target.value)}
                        placeholder="+628..."
                        className="h-11 rounded-md border-border bg-muted/40"
                      />
                    </label>
                  </div>

                  {kind === InvoiceKind.DP_AND_FINAL ? (
                    <div className="grid gap-4 rounded-md border border-primary/20 bg-primary/5 p-4 lg:grid-cols-[minmax(0,1fr)_140px]">
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-foreground">Skema Down Payment</p>
                        <p className="text-xs text-muted-foreground">
                          Atur persen DP. Ringkasan otomatis membagi DP dan pelunasan berdasarkan total akhir invoice.
                        </p>
                      </div>
                      <label className="space-y-2">
                        <span className="text-xs font-medium uppercase tracking-[0.18em] text-primary/80">DP (%)</span>
                        <Input
                          type="number"
                          min={1}
                          max={100}
                          value={dpPercentage}
                          onChange={(event) => setDpPercentage(Number(event.target.value))}
                          className="h-11 rounded-md border-border bg-background"
                        />
                      </label>
                    </div>
                  ) : null}
                </div>

              </section>

              <section className="space-y-4">
                <div className="overflow-hidden">
                  <div className="overflow-x-auto">
                    <div className="min-w-[1180px]">
                      <div className="grid grid-cols-[1.35fr_1.3fr_110px_140px_148px_160px_150px_36px] gap-x-4 rounded-xl border border-border/80 bg-muted/40 px-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        <div className="flex items-center gap-1 py-3">Produk <span className="text-rose-500">*</span></div>
                        <div className="flex items-center gap-1 py-3">Deskripsi</div>
                        <div className="flex items-center gap-1 py-3">Kuantitas <span className="text-rose-500">*</span></div>
                        <div className="flex items-center gap-1 py-3">Harga <span className="text-rose-500">*</span></div>
                        <div className="py-3">Diskon</div>
                        <div className="flex items-center gap-1 py-3">
                          Pajak
                          <FieldHint text="Pilih jenis pajak per item. Jika tidak dipilih, item dihitung tanpa pajak." />
                        </div>
                        <div className="py-3 text-right">Jumlah</div>
                        <div className="py-3" />
                      </div>

                      <div className="mt-2 space-y-2">
                        {items.map((item, index) => {
                          const lineSummary = lineSummaries[index];

                          return (
                            <div
                              key={item.id}
                              className="grid grid-cols-[1.35fr_1.3fr_110px_140px_148px_160px_150px_36px] gap-x-4 px-4 py-2"
                            >
                              <Input
                                value={item.name}
                                placeholder="Nama produk"
                                onChange={(event) => updateItem(index, { name: event.target.value })}
                                className="h-11 rounded-md border border-border bg-muted/40 px-3 shadow-none focus-visible:ring-1 focus-visible:ring-primary/40 focus-visible:border-primary/60"
                              />
                              <Input
                                value={item.description}
                                placeholder="Opsional"
                                onChange={(event) => updateItem(index, { description: event.target.value })}
                                className="h-11 rounded-md border border-border bg-muted/40 px-3 shadow-none focus-visible:ring-1 focus-visible:ring-primary/40 focus-visible:border-primary/60"
                              />
                              <Input
                                type="number"
                                min={1}
                                step={1}
                                inputMode="numeric"
                                value={item.qty}
                                placeholder="1"
                                onChange={(event) => {
                                  const nextQty = Number(event.target.value);
                                  updateItem(index, {
                                    qty: Number.isFinite(nextQty) ? Math.max(1, Math.floor(nextQty)) : 1
                                  });
                                }}
                                className="h-11 rounded-md border border-border bg-muted/40 px-3 text-left font-medium tabular-nums shadow-none focus-visible:ring-1 focus-visible:ring-primary/40 focus-visible:border-primary/60"
                              />
                              <Input
                                type="number"
                                min={0}
                                value={item.priceCents}
                                placeholder="0"
                                onChange={(event) => updateItem(index, { priceCents: Number(event.target.value) })}
                                className="h-11 rounded-md border border-border bg-muted/40 px-3 text-left font-medium tabular-nums shadow-none focus-visible:ring-1 focus-visible:ring-primary/40 focus-visible:border-primary/60"
                              />
                              <div className="grid h-11 grid-cols-[60px_1fr_24px] overflow-hidden rounded-md border border-border bg-muted/40">
                                <div className="relative border-r border-border">
                                  <select
                                    value={item.discountType}
                                    onChange={(event) => updateItem(index, { discountType: event.target.value as "%" | "IDR" })}
                                    className="h-full w-full appearance-none bg-transparent pl-2 pr-6 text-sm outline-none"
                                  >
                                    <option value="%">%</option>
                                    <option value="IDR">Rp</option>
                                  </select>
                                  <ChevronDown className="pointer-events-none absolute right-1 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                </div>
                                <input
                                  type="number"
                                  min={0}
                                  value={item.discountValue}
                                  onChange={(event) => updateItem(index, { discountValue: Number(event.target.value) })}
                                  className="bg-transparent px-3 text-sm outline-none"
                                />
                                <div className="flex items-center justify-center text-sm text-muted-foreground">
                                  {item.discountType === "%" ? "%" : ""}
                                </div>
                              </div>
                              <div className="relative h-11 overflow-hidden rounded-md border border-border bg-muted/40">
                                <select
                                  value={item.taxLabel}
                                  onChange={(event) => updateItem(index, { taxLabel: event.target.value })}
                                  className="h-full w-full appearance-none bg-transparent px-3 pr-8 text-sm text-foreground outline-none"
                                >
                                  {INVOICE_TAX_OPTIONS.map((option) => (
                                    <option key={option.value || "NONE"} value={option.value}>
                                      {option.value ? option.label : "No Tax Selected"}
                                    </option>
                                  ))}
                                </select>
                                <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                              </div>
                              <div className="flex h-11 items-center justify-end py-1 text-right">
                                <div className="text-sm font-medium tabular-nums text-foreground">
                                  {toPlainNumberLabel(lineSummary?.totalCents ?? 0)}
                                </div>
                              </div>
                              <div className="flex h-11 items-center justify-end">
                                <button
                                  type="button"
                                  disabled={items.length <= 1}
                                  onClick={() => removeItem(index)}
                                  aria-label="Hapus baris produk"
                                  className="inline-flex h-7 w-7 items-center justify-center text-rose-500 transition hover:text-rose-600 disabled:cursor-not-allowed disabled:text-slate-300"
                                >
                                  <Trash2 className="h-4.5 w-4.5 stroke-[1.6]" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-md border-border bg-background shadow-sm hover:bg-muted"
                    onClick={addItem}
                  >
                    Tambah Baris
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-md border-border bg-background shadow-sm hover:bg-muted"
                    onClick={() => setIsCatalogModalOpen(true)}
                  >
                    Katalog Produk
                  </Button>
                </div>
              </section>

              <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                      Keterangan
                      <FieldHint text="Catatan ini akan muncul di invoice customer." />
                    </label>
                    <textarea
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                      className="min-h-28 w-full rounded-md border border-border bg-white px-4 py-3 outline-none transition focus:border-primary"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                      Syarat & Ketentuan
                      <FieldHint text="Tuliskan syarat pembayaran atau ketentuan kerja sama invoice." />
                    </label>
                    <textarea
                      value={terms}
                      onChange={(event) => setTerms(event.target.value)}
                      className="min-h-28 w-full rounded-md border border-border bg-white px-4 py-3 outline-none transition focus:border-primary"
                    />
                  </div>
                </div>

                <div className="rounded-md border border-border bg-card p-5">
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Ringkasan Invoice</p>
                      <p className="text-xs text-muted-foreground">Diskon, pajak, dan total akhir selalu sinkron dengan item di atas.</p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-[72px_1fr]">
                      <select
                        value={invoiceDiscountType}
                        onChange={(event) => setInvoiceDiscountType(event.target.value as "%" | "IDR")}
                        className="h-11 rounded-md border border-border bg-muted/40 px-3 text-sm outline-none"
                      >
                        <option value="%">%</option>
                        <option value="IDR">Rp</option>
                      </select>
                      <Input
                        type="number"
                        min={0}
                        value={invoiceDiscountValue}
                        onChange={(event) => setInvoiceDiscountValue(Number(event.target.value))}
                        placeholder="Diskon invoice"
                        className="h-11 rounded-md border-border bg-muted/40"
                      />
                    </div>

                    <div className="space-y-3 text-sm px-1">
                      <div className="flex items-center justify-between border-b border-border/50 pb-3 text-muted-foreground">
                        <span>Subtotal</span>
                        <span>{toRupiahLabel(summary.subtotalCents)}</span>
                      </div>
                      <div className="flex items-center justify-between border-b border-border/50 pb-3 text-muted-foreground">
                        <span>Total Diskon Item</span>
                        <span>- {toRupiahLabel(summary.lineDiscountCents)}</span>
                      </div>
                      <div className="flex items-center justify-between border-b border-border/50 pb-3 text-muted-foreground">
                        <span>Diskon Invoice</span>
                        <span>- {toRupiahLabel(summary.invoiceDiscountCents)}</span>
                      </div>
                      <div className="flex items-center justify-between border-b border-border/50 pb-3 text-muted-foreground">
                        <span>Total Pajak</span>
                        <span>{toRupiahLabel(summary.taxCents)}</span>
                      </div>
                      <div className="flex items-center justify-between text-base font-bold text-foreground">
                        <span>Total Tagihan</span>
                        <span className="text-primary">{toRupiahLabel(summary.totalCents)}</span>
                      </div>
                    </div>

                    {kind === InvoiceKind.DP_AND_FINAL ? (
                      <div className="grid gap-3 rounded-md bg-primary/5 p-4 text-sm sm:grid-cols-2">
                        <div className="rounded-md border border-border/50 bg-background/60 p-4 backdrop-blur-sm">
                          <p className="text-xs uppercase tracking-[0.2em] text-primary/80">DP</p>
                          <p className="mt-2 text-xl font-semibold text-foreground">{toRupiahLabel(dpAmountCents)}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{dpPercentage}% dari total invoice</p>
                        </div>
                        <div className="rounded-md border border-border/50 bg-background/60 p-4 backdrop-blur-sm">
                          <p className="text-xs uppercase tracking-[0.2em] text-primary/80">Pelunasan</p>
                          <p className="mt-2 text-xl font-semibold text-foreground">{toRupiahLabel(finalAmountCents)}</p>
                          <p className="mt-1 text-xs text-muted-foreground">Sisa tagihan setelah DP dibayar</p>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </section>

              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              {success ? <p className="text-sm text-emerald-600">{success}</p> : null}
            </div>
          </div>
        </form>
        <Dialog open={isManualCustomerModalOpen} onOpenChange={setIsManualCustomerModalOpen}>
          <DialogContent className="sm:max-w-[520px]">
            <DialogHeader>
              <DialogTitle>Tambah Pelanggan Manual</DialogTitle>
              <DialogDescription>Lengkapi data pelanggan. Nama dan nomor WhatsApp terisi otomatis.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <label className="space-y-2">
                <span className="text-sm font-medium text-foreground">Nama Pelanggan</span>
                <Input
                  value={manualCustomerName}
                  onChange={(event) => setManualCustomerName(event.target.value)}
                  placeholder="Nama pelanggan"
                  className="h-11 rounded-md border-border bg-muted/30"
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium text-foreground">Nomor WhatsApp</span>
                <Input
                  value={manualCustomerPhone}
                  onChange={(event) => setManualCustomerPhone(event.target.value)}
                  placeholder="+628..."
                  className="h-11 rounded-md border-border bg-muted/30"
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium text-foreground">Alamat</span>
                <Input
                  value={manualCustomerAddress}
                  onChange={(event) => setManualCustomerAddress(event.target.value)}
                  placeholder="Alamat pelanggan"
                  className="h-11 rounded-md border-border bg-muted/30"
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium text-foreground">Email</span>
                <Input
                  type="email"
                  value={manualCustomerEmail}
                  onChange={(event) => setManualCustomerEmail(event.target.value)}
                  placeholder="email@pelanggan.com"
                  className="h-11 rounded-md border-border bg-muted/30"
                />
              </label>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setIsManualCustomerModalOpen(false)}>
                Batal
              </Button>
              <Button
                type="button"
                onClick={handleApplyManualCustomer}
                className="bg-sky-600 text-white hover:bg-sky-700"
                disabled={!manualCustomerName.trim() || !manualCustomerPhone.trim()}
              >
                Simpan Data
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isCatalogModalOpen} onOpenChange={setIsCatalogModalOpen}>
          <DialogContent className="max-w-[1180px] gap-0 overflow-hidden border-slate-200 p-0">
            <div className="bg-white">
              <DialogHeader className="border-b border-slate-200 px-6 py-6">
                <div className="inline-flex w-fit rounded-sm bg-sky-50 px-2 py-1 text-xs text-sky-600">Produk</div>
                <DialogTitle className="pt-2 text-[36px] font-semibold tracking-[-0.03em] text-slate-700">Masukkan Produk</DialogTitle>
                <DialogDescription className="pt-6 text-base text-slate-600">
                  Item terpilih <span className="rounded-full bg-lime-100 px-2 py-0.5 font-semibold text-lime-700">{catalogSelectedIds.length}</span>
                </DialogDescription>
              </DialogHeader>

              <div className="px-6 py-5">
                <div className="mb-5 flex items-center justify-end">
                  <Button
                    type="button"
                    className="h-11 rounded-full bg-sky-500 px-6 text-white shadow-[0_10px_24px_rgba(14,165,233,0.24)] hover:bg-sky-600"
                    onClick={() => setIsCreateCatalogModalOpen(true)}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Buat Produk Baru
                  </Button>
                </div>

                <div className="overflow-hidden rounded-xl border border-slate-200">
                  <div className="grid grid-cols-[56px_160px_1.25fr_1fr_120px_140px] items-center gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
                    <div />
                    <div>
                      <div>Kode Layanan</div>
                      <Input
                        value={catalogSearchCode}
                        onChange={(event) => setCatalogSearchCode(event.target.value)}
                        placeholder="Cari kode"
                        className="mt-2 h-9 rounded-none border-slate-300 bg-white text-sm shadow-none focus-visible:ring-0"
                      />
                    </div>
                    <div>
                      <div>Nama Layanan</div>
                      <Input
                        value={catalogSearchName}
                        onChange={(event) => setCatalogSearchName(event.target.value)}
                        placeholder="Cari nama layanan"
                        className="mt-2 h-9 rounded-none border-slate-300 bg-white text-sm shadow-none focus-visible:ring-0"
                      />
                    </div>
                    <div>
                      <div>Kategori Layanan</div>
                      <Input
                        value={catalogSearchCategory}
                        onChange={(event) => setCatalogSearchCategory(event.target.value)}
                        placeholder="Cari kategori"
                        className="mt-2 h-9 rounded-none border-slate-300 bg-white text-sm shadow-none focus-visible:ring-0"
                      />
                    </div>
                    <div>Satuan</div>
                    <div>Harga Jual</div>
                  </div>

                  <div className="max-h-[460px] overflow-y-auto">
                    {isCatalogLoading ? (
                      <div className="px-6 py-10 text-sm text-slate-500">Memuat katalog produk...</div>
                    ) : filteredCatalogItems.length === 0 ? (
                      <div className="px-6 py-10 text-sm text-slate-500">Belum ada item katalog yang cocok.</div>
                    ) : (
                      filteredCatalogItems.map((item) => {
                        const isSelected = catalogSelectedIds.includes(item.id);

                        return (
                          <label
                            key={item.id}
                            className="grid cursor-pointer grid-cols-[56px_160px_1.25fr_1fr_120px_140px] items-center gap-3 border-t border-slate-100 px-4 py-4 text-[15px] text-slate-600 first:border-t-0 hover:bg-sky-50/40"
                          >
                            <div className="flex justify-center">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleCatalogSelection(item.id)}
                                className="h-5 w-5 rounded border-slate-300 text-sky-500 focus:ring-sky-500"
                              />
                            </div>
                            <div>{buildCatalogCode(item.id)}</div>
                            <div className="font-medium text-slate-700">{item.name}</div>
                            <div>{item.category || "-"}</div>
                            <div>{item.unit || "-"}</div>
                            <div>{toRupiahLabel(item.priceCents ?? 0)}</div>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>

                {catalogError ? <p className="mt-3 text-sm text-destructive">{catalogError}</p> : null}
              </div>

              <DialogFooter className="border-t border-slate-200 px-6 py-5 sm:justify-center sm:space-x-5">
                <Button
                  type="button"
                  className="h-11 min-w-[140px] rounded-full bg-lime-500 text-white hover:bg-lime-600"
                  onClick={handleApplyCatalogItems}
                  disabled={catalogSelectedIds.length === 0}
                >
                  Simpan
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="h-11 min-w-[140px] rounded-full bg-slate-200 text-slate-600 hover:bg-slate-300"
                  onClick={() => setIsCatalogModalOpen(false)}
                >
                  Batalkan
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={isCreateCatalogModalOpen} onOpenChange={setIsCreateCatalogModalOpen}>
          <DialogContent className="max-w-[640px] border-slate-200 p-0">
            <div className="bg-white">
              <DialogHeader className="border-b border-slate-200 px-6 py-6">
                <div className="inline-flex w-fit rounded-sm bg-sky-50 px-2 py-1 text-xs text-sky-600">Katalog Jasa</div>
                <DialogTitle className="pt-2 text-2xl font-semibold text-slate-700">Buat Katalog Produk</DialogTitle>
                <DialogDescription className="pt-1 text-sm text-slate-500">
                  Simpan layanan yang sering dijual agar bisa ditambahkan ke invoice lebih cepat.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 px-6 py-6">
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">Nama Layanan</span>
                  <Input
                    value={catalogDraft.name}
                    onChange={(event) => setCatalogDraft((current) => ({ ...current, name: event.target.value }))}
                    placeholder="Contoh: Jasa Pembuatan Website"
                    className="h-11 rounded-md border-slate-300 bg-slate-50"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">Kategori Layanan</span>
                  <Input
                    value={catalogDraft.category}
                    onChange={(event) => setCatalogDraft((current) => ({ ...current, category: event.target.value }))}
                    placeholder="Contoh: Digital Marketing"
                    className="h-11 rounded-md border-slate-300 bg-slate-50"
                  />
                </label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-700">Satuan</span>
                    <Input
                      value={catalogDraft.unit}
                      onChange={(event) => setCatalogDraft((current) => ({ ...current, unit: event.target.value }))}
                      placeholder="Contoh: paket, proyek, sesi, bulan"
                      className="h-11 rounded-md border-slate-300 bg-slate-50"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-700">Harga Jual</span>
                    <Input
                      type="number"
                      min={0}
                      value={catalogDraft.priceCents}
                      onChange={(event) => setCatalogDraft((current) => ({ ...current, priceCents: event.target.value }))}
                      placeholder="0"
                      className="h-11 rounded-md border-slate-300 bg-slate-50"
                    />
                  </label>
                </div>
              </div>

              <DialogFooter className="border-t border-slate-200 px-6 py-5">
                <Button
                  type="button"
                  variant="secondary"
                  className="h-11 rounded-full bg-slate-200 text-slate-600 hover:bg-slate-300"
                  onClick={() => setIsCreateCatalogModalOpen(false)}
                >
                  Batalkan
                </Button>
                <Button
                  type="button"
                  className="h-11 rounded-full bg-sky-500 text-white hover:bg-sky-600"
                  onClick={() => void handleCreateCatalog()}
                  disabled={!catalogDraft.name.trim() || !catalogDraft.priceCents.trim() || isCatalogCreating}
                >
                  {isCatalogCreating ? "Menyimpan..." : "Simpan Katalog"}
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>

        <DrawerFooter className="shrink-0 border-t border-border/70 bg-background/60 backdrop-blur-md px-5 py-4 shadow-[0_-12px_24px_hsl(var(--foreground)/0.04)] md:px-6">
          <div className="flex flex-wrap items-center justify-end gap-3">
            <DrawerClose asChild>
              <Button type="button" variant="ghost" className="rounded-md text-foreground hover:bg-muted">
                Batalkan
              </Button>
            </DrawerClose>
            <Button type="submit" form="invoice-drawer-form" className="rounded-md px-6 shadow-md shadow-primary/10" disabled={!canCreateDraft}>
              {isSubmitting ? "Menyimpan..." : "Simpan Invoice"}
            </Button>
            <Button type="button" variant="secondary" className="rounded-md border border-border/80 bg-background shadow-sm" onClick={() => void handleUpdateItems()} disabled={!canUpdateDraft}>
              {isUpdatingItems ? "Updating..." : "Update Draft Items"}
            </Button>
            <Button type="button" variant="secondary" className="rounded-md border border-border/80 bg-background shadow-sm" onClick={() => void handleSendInvoice()} disabled={!canSendInvoice}>
              {isSendingInvoice ? "Sending..." : "Send Invoice"}
            </Button>
            {kind === InvoiceKind.DP_AND_FINAL ? (
              <>
                <Button type="button" variant="secondary" className="rounded-md border border-border/80 bg-background shadow-sm" onClick={() => void handleMarkPaid(PaymentMilestoneType.DP)} disabled={!canMarkPaid}>
                  {isMarkingPaid ? "Updating..." : "Mark DP Paid"}
                </Button>
                <Button type="button" variant="secondary" className="rounded-md border border-border/80 bg-background shadow-sm" onClick={() => void handleMarkPaid(PaymentMilestoneType.FINAL)} disabled={!canMarkPaid}>
                  {isMarkingPaid ? "Updating..." : "Mark Final Paid"}
                </Button>
              </>
            ) : (
              <Button type="button" variant="secondary" className="rounded-md border border-border/80 bg-background shadow-sm" onClick={() => void handleMarkPaid(PaymentMilestoneType.FULL)} disabled={!canMarkPaid}>
                {isMarkingPaid ? "Updating..." : "Mark Paid"}
              </Button>
            )}
          </div>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
