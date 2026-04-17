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
  const [open, setOpen] = useState(false);
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
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "flex h-11 w-full items-center justify-between rounded-md border border-border bg-muted/40 px-3 text-left text-sm transition hover:bg-muted/60",
        )}
      >
        <span className={cn("truncate", !selectedDate && "text-muted-foreground")}>
          {selectedDate ? formatDateLabel(selectedDate) : "Pilih tanggal jatuh tempo"}
        </span>
        <CalendarDays className="h-4 w-4 shrink-0 text-sky-500" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex w-auto max-w-[min(380px,calc(100vw-2rem))] flex-col gap-0 overflow-hidden rounded-[10px] p-0">
          <DialogHeader className="border-b border-border/60 px-5 py-3.5">
            <DialogTitle className="text-base">Pilih Tanggal Jatuh Tempo</DialogTitle>
          </DialogHeader>
          <div className="flex justify-center p-3">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => {
                onChange(date ? toInputDate(date) : "");
                if (date) setOpen(false);
              }}
              month={currentMonth}
              onMonthChange={setCurrentMonth}
              fixedWeeks
              classNames={{
                month_caption: "relative flex items-center justify-center pb-2",
                caption_label: "text-sm font-semibold text-foreground",
                button_previous:
                  "absolute left-0 inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground",
                button_next:
                  "absolute right-0 inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground",
                weekdays: "mb-1 grid grid-cols-7",
                weekday:
                  "flex h-8 items-center justify-center text-xs font-medium text-muted-foreground",
                week: "grid grid-cols-7",
                day: "flex items-center justify-center",
                day_button:
                  "inline-flex h-9 w-9 items-center justify-center rounded-lg text-sm font-normal text-foreground transition hover:bg-muted",
                selected: "rounded-lg bg-primary text-primary-foreground hover:bg-primary/90",
                today: "rounded-lg bg-muted/70 text-foreground font-semibold",
                outside: "text-muted-foreground opacity-45"
              }}
            />
          </div>
          {/* Quick presets */}
          <div className="border-t border-border/60 px-4 py-3">
            <div className="flex flex-wrap gap-1.5">
              {[
                { label: "Hari ini", value: 0 },
                { label: "Besok", value: 1 },
                { label: "3 hari", value: 3 },
                { label: "1 minggu", value: 7 },
                { label: "2 minggu", value: 14 }
              ].map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  className="flex-1 rounded-lg border border-border bg-background px-2 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
                  onClick={() => {
                    const newDate = addDays(new Date(), preset.value);
                    onChange(toInputDate(newDate));
                    setCurrentMonth(new Date(newDate.getFullYear(), newDate.getMonth(), 1));
                    setOpen(false);
                  }}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            {value ? (
              <button
                type="button"
                onClick={() => { onChange(""); setOpen(false); }}
                className="mt-2 w-full text-center text-xs text-muted-foreground hover:text-foreground"
              >
                Hapus tanggal
              </button>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
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
  } = useInvoiceDrawer({
    open,
    customerId,
    conversationId,
    orgId,
    customerDisplayName,
    customerDisplayNameSnapshot: customerName,
    customerPhoneE164,
    onClose
  });

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
          orgId
            ? fetch(`/api/orgs/members?orgId=${encodeURIComponent(orgId)}`, { cache: "no-store" })
            : Promise.resolve(null),
          fetch(`/api/orgs/business${orgId ? `?orgId=${encodeURIComponent(orgId)}` : ""}`, {
            cache: "no-store"
          })
        ]);

        const profilePayload = (await profileResponse
          .json()
          .catch(() => null)) as ProfilePayload | null;
        const user = profilePayload?.data?.user;
        const nextUserId = user?.id ?? "";
        const nextUserLabel = user?.name?.trim() || user?.email || "Business Owner";

        if (!ignore) {
          setCurrentUserId(nextUserId);
          setCurrentUserLabel(nextUserLabel);
        }

        const businessPayload = (await businessResponse
          .json()
          .catch(() => null)) as BusinessProfilePayload | null;
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

        const membersPayload = (await membersResponse.json().catch(() => null)) as {
          data?: { members?: MemberOption[] };
        } | null;
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
  const dpAmountCents =
    kind === InvoiceKind.DP_AND_FINAL ? Math.round((totalCents * dpPercentage) / 100) : totalCents;
  const finalAmountCents =
    kind === InvoiceKind.DP_AND_FINAL ? Math.max(0, totalCents - dpAmountCents) : 0;
  const filteredCatalogItems = catalogItems.filter((item) => {
    const code = buildCatalogCode(item.id).toLowerCase();
    const name = item.name.toLowerCase();
    const category = (item.category ?? "").toLowerCase();

    return (
      (!catalogSearchCode.trim() || code.includes(catalogSearchCode.trim().toLowerCase())) &&
      (!catalogSearchName.trim() || name.includes(catalogSearchName.trim().toLowerCase())) &&
      (!catalogSearchCategory.trim() ||
        category.includes(catalogSearchCategory.trim().toLowerCase()))
    );
  });

  return (
    <Drawer
      open={open}
      onOpenChange={(nextOpen) => (!nextOpen ? onClose() : undefined)}
      direction="right"
    >
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
                  <span className="rounded-md border border-border bg-background px-3 py-1 text-xs text-muted-foreground">
                    {invoiceNo}
                  </span>
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

        <form
          id="invoice-drawer-form"
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
          onSubmit={handleCreateInvoice}
        >
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
                          disabled
                        >
                          {salesMembers.length === 0 ? (
                            <option value={currentUserId}>{currentUserLabel}</option>
                          ) : null}
                          {salesMembers.map((member) => (
                            <option key={member.userId} value={member.userId}>
                              {member.name?.trim() || member.email} • {member.role}
                            </option>
                          ))}
                        </select>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Informasi salesperson saat ini untuk referensi tampilan invoice.
                      </p>
                    </label>

                    <DueDatePickerField value={invoiceDueDate} onChange={setInvoiceDueDate} />

                    <label className="space-y-2">
                      <span className="text-sm font-medium text-foreground">Pelanggan</span>
                      <Input
                        value={customerName}
                        placeholder="Nama pelanggan"
                        className="h-11 rounded-md border-border bg-muted/40"
                        onChange={(event) => setCustomerName(event.target.value)}
                      />
                    </label>

                    <label className="space-y-2">
                      <span className="text-sm font-medium text-foreground">Nomor WhatsApp</span>
                      <Input
                        value={customerPhone}
                        placeholder="+628..."
                        className="h-11 rounded-md border-border bg-muted/40"
                        readOnly
                      />
                    </label>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Nama pelanggan di invoice bisa diubah tanpa mengubah data customer pada CRM.
                  </p>

                  {kind === InvoiceKind.DP_AND_FINAL ? (
                    <div className="grid gap-4 rounded-md border border-primary/20 bg-primary/5 p-4 lg:grid-cols-[minmax(0,1fr)_140px]">
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-foreground">Skema Down Payment</p>
                        <p className="text-xs text-muted-foreground">
                          Atur persen DP. Ringkasan otomatis membagi DP dan pelunasan berdasarkan
                          total akhir invoice.
                        </p>
                      </div>
                      <label className="space-y-2">
                        <span className="text-xs font-medium uppercase tracking-[0.18em] text-primary/80">
                          DP (%)
                        </span>
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
                        <div className="flex items-center gap-1 py-3">
                          Produk <span className="text-rose-500">*</span>
                        </div>
                        <div className="flex items-center gap-1 py-3">Deskripsi</div>
                        <div className="flex items-center gap-1 py-3">
                          Kuantitas <span className="text-rose-500">*</span>
                        </div>
                        <div className="flex items-center gap-1 py-3">
                          Harga <span className="text-rose-500">*</span>
                        </div>
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
                                onChange={(event) =>
                                  updateItem(index, { name: event.target.value })
                                }
                                className="h-11 rounded-md border border-border bg-muted/40 px-3 shadow-none focus-visible:ring-1 focus-visible:ring-primary/40 focus-visible:border-primary/60"
                              />
                              <Input
                                value={item.description}
                                placeholder="Opsional"
                                onChange={(event) =>
                                  updateItem(index, { description: event.target.value })
                                }
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
                                    qty: Number.isFinite(nextQty)
                                      ? Math.max(1, Math.floor(nextQty))
                                      : 1
                                  });
                                }}
                                className="h-11 rounded-md border border-border bg-muted/40 px-3 text-left font-medium tabular-nums shadow-none focus-visible:ring-1 focus-visible:ring-primary/40 focus-visible:border-primary/60"
                              />
                              <Input
                                type="number"
                                min={0}
                                value={item.priceCents}
                                placeholder="0"
                                onChange={(event) =>
                                  updateItem(index, { priceCents: Number(event.target.value) })
                                }
                                className="h-11 rounded-md border border-border bg-muted/40 px-3 text-left font-medium tabular-nums shadow-none focus-visible:ring-1 focus-visible:ring-primary/40 focus-visible:border-primary/60"
                              />
                              <div className="grid h-11 grid-cols-[60px_1fr_24px] overflow-hidden rounded-md border border-border bg-muted/40">
                                <div className="relative border-r border-border">
                                  <select
                                    value={item.discountType}
                                    onChange={(event) =>
                                      updateItem(index, {
                                        discountType: event.target.value as "%" | "IDR"
                                      })
                                    }
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
                                  onChange={(event) =>
                                    updateItem(index, { discountValue: Number(event.target.value) })
                                  }
                                  className="bg-transparent px-3 text-sm outline-none"
                                />
                                <div className="flex items-center justify-center text-sm text-muted-foreground">
                                  {item.discountType === "%" ? "%" : ""}
                                </div>
                              </div>
                              <div className="relative h-11 overflow-hidden rounded-md border border-border bg-muted/40">
                                <select
                                  value={item.taxLabel}
                                  onChange={(event) =>
                                    updateItem(index, { taxLabel: event.target.value })
                                  }
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
                      <p className="text-xs text-muted-foreground">
                        Diskon, pajak, dan total akhir selalu sinkron dengan item di atas.
                      </p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-[72px_1fr]">
                      <select
                        value={invoiceDiscountType}
                        onChange={(event) =>
                          setInvoiceDiscountType(event.target.value as "%" | "IDR")
                        }
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
                          <p className="mt-2 text-xl font-semibold text-foreground">
                            {toRupiahLabel(dpAmountCents)}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {dpPercentage}% dari total invoice
                          </p>
                        </div>
                        <div className="rounded-md border border-border/50 bg-background/60 p-4 backdrop-blur-sm">
                          <p className="text-xs uppercase tracking-[0.2em] text-primary/80">
                            Pelunasan
                          </p>
                          <p className="mt-2 text-xl font-semibold text-foreground">
                            {toRupiahLabel(finalAmountCents)}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Sisa tagihan setelah DP dibayar
                          </p>
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
              <DialogDescription>
                Lengkapi data pelanggan. Nama dan nomor WhatsApp terisi otomatis.
              </DialogDescription>
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
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsManualCustomerModalOpen(false)}
              >
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
          <DialogContent className="max-w-[1040px] gap-0 overflow-hidden rounded-[24px] border border-slate-200/60 bg-white p-0 shadow-2xl shadow-slate-200/40 sm:rounded-[32px]">
            <div className="flex flex-col bg-white">
              {/* Header */}
              <div className="relative px-6 pb-6 pt-8 sm:px-8">
                {/* Decorative background blur */}
                <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-emerald-50/50 to-transparent" />
                <div className="relative flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1.5">
                    <div className="inline-flex w-fit items-center rounded-full bg-emerald-100/80 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-emerald-700 ring-1 ring-emerald-500/20">
                      Katalog
                    </div>
                    <DialogTitle className="text-3xl font-bold tracking-tight text-slate-800">
                      Masukkan Produk
                    </DialogTitle>
                    <DialogDescription className="flex items-center gap-2 pt-1 text-[15px] font-medium text-slate-500">
                      Item terpilih
                      <span
                        className={cn(
                          "flex h-6 min-w-[24px] items-center justify-center rounded-full px-2 text-xs font-bold transition-all",
                          catalogSelectedIds.length > 0
                            ? "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-500/20"
                            : "bg-slate-100 text-slate-600"
                        )}
                      >
                        {catalogSelectedIds.length}
                      </span>
                    </DialogDescription>
                  </div>
                  <Button
                    type="button"
                    className="group relative h-11 w-full shrink-0 overflow-hidden rounded-full bg-emerald-500 px-6 font-semibold text-white shadow-[0_8px_20px_-6px_rgba(16,185,129,0.4)] transition-all hover:-translate-y-0.5 hover:bg-emerald-600 hover:shadow-[0_12px_24px_-8px_rgba(16,185,129,0.5)] active:translate-y-0 active:shadow-[0_4px_10px_-4px_rgba(16,185,129,0.4)] sm:w-auto"
                    onClick={() => setIsCreateCatalogModalOpen(true)}
                  >
                    <div className="absolute inset-0 flex h-full w-full justify-center [transform:skew(-12deg)_translateX(-150%)] group-hover:duration-1000 group-hover:[transform:skew(-12deg)_translateX(150%)]">
                      <div className="relative h-full w-10 bg-white/20" />
                    </div>
                    <Plus className="mr-2 h-4.5 w-4.5 stroke-[2.5]" />
                    <span className="relative z-10">Buat Produk Baru</span>
                  </Button>
                </div>
              </div>

              {/* Filters & Table */}
              <div className="px-6 pb-6 sm:px-8">
                {/* Search Filters */}
                <div className="mb-5 grid gap-3 sm:grid-cols-3">
                  <div className="group relative">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3.5">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        className="h-4.5 w-4.5 text-slate-400 transition-colors group-focus-within:text-emerald-500"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <circle cx="11" cy="11" r="8" />
                        <path d="m21 21-4.3-4.3" />
                      </svg>
                    </div>
                    <Input
                      value={catalogSearchCode}
                      onChange={(event) => setCatalogSearchCode(event.target.value)}
                      placeholder="Cari kode layanan..."
                      className="h-11 w-full rounded-xl border-slate-200 bg-slate-50/50 pl-10 pr-4 text-[14px] text-slate-700 shadow-sm transition-all focus-visible:border-emerald-500/40 focus-visible:bg-white focus-visible:ring-4 focus-visible:ring-emerald-500/10"
                    />
                  </div>
                  <div className="group relative">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3.5">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        className="h-4.5 w-4.5 text-slate-400 transition-colors group-focus-within:text-emerald-500"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <circle cx="11" cy="11" r="8" />
                        <path d="m21 21-4.3-4.3" />
                      </svg>
                    </div>
                    <Input
                      value={catalogSearchName}
                      onChange={(event) => setCatalogSearchName(event.target.value)}
                      placeholder="Cari nama layanan..."
                      className="h-11 w-full rounded-xl border-slate-200 bg-slate-50/50 pl-10 pr-4 text-[14px] text-slate-700 shadow-sm transition-all focus-visible:border-emerald-500/40 focus-visible:bg-white focus-visible:ring-4 focus-visible:ring-emerald-500/10"
                    />
                  </div>
                  <div className="group relative">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3.5">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        className="h-4.5 w-4.5 text-slate-400 transition-colors group-focus-within:text-emerald-500"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <circle cx="11" cy="11" r="8" />
                        <path d="m21 21-4.3-4.3" />
                      </svg>
                    </div>
                    <Input
                      value={catalogSearchCategory}
                      onChange={(event) => setCatalogSearchCategory(event.target.value)}
                      placeholder="Cari kategori..."
                      className="h-11 w-full rounded-xl border-slate-200 bg-slate-50/50 pl-10 pr-4 text-[14px] text-slate-700 shadow-sm transition-all focus-visible:border-emerald-500/40 focus-visible:bg-white focus-visible:ring-4 focus-visible:ring-emerald-500/10"
                    />
                  </div>
                </div>

                <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
                  <div className="grid grid-cols-[56px_140px_1.25fr_1fr_120px_140px] items-center gap-4 border-b border-slate-200 bg-slate-50/80 px-4 py-3.5 text-[13px] font-semibold uppercase tracking-wider text-slate-500">
                    <div />
                    <div>Kode</div>
                    <div>Nama Layanan</div>
                    <div>Kategori</div>
                    <div>Satuan</div>
                    <div className="text-right">Harga Jual</div>
                  </div>

                  <div className="max-h-[420px] overflow-y-auto bg-white">
                    {isCatalogLoading ? (
                      <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-emerald-500" />
                        <span className="mt-4 text-sm font-medium">Memuat katalog produk...</span>
                      </div>
                    ) : filteredCatalogItems.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-16 text-center text-slate-500">
                        <div className="mb-3 rounded-full bg-slate-50 p-4">
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            className="h-8 w-8 text-slate-300"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                            <line x1="9" x2="15" y1="9" y2="9" />
                            <line x1="9" x2="15" y1="15" y2="15" />
                          </svg>
                        </div>
                        <p className="text-base font-medium text-slate-700">
                          Tidak ada produk ditemukan
                        </p>
                        <p className="mt-1 text-sm">
                          Belum ada item katalog yang cocok dengan pencarian Anda.
                        </p>
                      </div>
                    ) : (
                      filteredCatalogItems.map((item, index) => {
                        const isSelected = catalogSelectedIds.includes(item.id);

                        return (
                          <label
                            key={item.id}
                            className={cn(
                              "group grid cursor-pointer grid-cols-[56px_140px_1.25fr_1fr_120px_140px] items-center gap-4 px-4 py-3.5 text-[14px] transition-colors",
                              index !== filteredCatalogItems.length - 1 &&
                                "border-b border-slate-100",
                              isSelected ? "bg-emerald-50/60" : "hover:bg-slate-50"
                            )}
                          >
                            <div className="flex justify-center">
                              <div
                                className={cn(
                                  "flex h-5 w-5 items-center justify-center rounded border transition-all duration-200",
                                  isSelected
                                    ? "border-emerald-500 bg-emerald-500 text-white shadow-sm"
                                    : "border-slate-300 bg-white group-hover:border-emerald-400"
                                )}
                              >
                                {isSelected && (
                                  <svg
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    className="h-3.5 w-3.5"
                                    strokeWidth="3"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  >
                                    <path d="M20 6 9 17l-5-5" />
                                  </svg>
                                )}
                              </div>
                            </div>
                            <div className="font-medium text-slate-500">
                              {buildCatalogCode(item.id)}
                            </div>
                            <div className="font-semibold text-slate-800">{item.name}</div>
                            <div className="text-slate-600">
                              {item.category ? (
                                <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                                  {item.category}
                                </span>
                              ) : (
                                "-"
                              )}
                            </div>
                            <div className="text-slate-600">{item.unit || "-"}</div>
                            <div className="text-right font-semibold text-slate-800">
                              {toRupiahLabel(item.priceCents ?? 0)}
                            </div>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>

                {catalogError ? (
                  <div className="mt-4 flex items-center rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[14px] text-red-600">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      className="mr-2 h-4 w-4 shrink-0"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    {catalogError}
                  </div>
                ) : null}
              </div>

              {/* Footer */}
              <div className="relative border-t border-slate-100 bg-slate-50/50 px-6 py-5 sm:px-8">
                <div className="flex flex-col-reverse items-center justify-center gap-3 sm:flex-row sm:gap-4">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-12 w-full min-w-[140px] rounded-full border-slate-200 bg-white px-8 text-[15px] font-semibold text-slate-600 transition-all hover:bg-slate-100 hover:text-slate-900 sm:w-auto"
                    onClick={() => setIsCatalogModalOpen(false)}
                  >
                    Batalkan
                  </Button>
                  <Button
                    type="button"
                    className="h-12 w-full min-w-[140px] rounded-full bg-emerald-500 px-8 text-[15px] font-semibold text-white shadow-[0_8px_20px_-6px_rgba(16,185,129,0.3)] transition-all hover:-translate-y-0.5 hover:bg-emerald-600 hover:shadow-[0_12px_24px_-8px_rgba(16,185,129,0.4)] disabled:pointer-events-none disabled:opacity-60 sm:w-auto"
                    onClick={handleApplyCatalogItems}
                    disabled={catalogSelectedIds.length === 0}
                  >
                    Simpan Terpilih
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={isCreateCatalogModalOpen} onOpenChange={setIsCreateCatalogModalOpen}>
          <DialogContent className="max-w-[560px] gap-0 overflow-hidden rounded-[24px] border border-slate-200/60 bg-white p-0 shadow-2xl shadow-slate-200/40 sm:rounded-[32px]">
            <div className="flex flex-col bg-white">
              {/* Header */}
              <div className="relative px-6 pb-6 pt-8 sm:px-8">
                {/* Decorative background blur */}
                <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-emerald-50/50 to-transparent" />
                <div className="relative">
                  <div className="inline-flex w-fit items-center rounded-full bg-emerald-100/80 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-emerald-700 ring-1 ring-emerald-500/20">
                    Katalog Jasa
                  </div>
                  <DialogTitle className="mt-4 text-2xl font-bold tracking-tight text-slate-800">
                    Buat Katalog Produk
                  </DialogTitle>
                  <DialogDescription className="mt-2 text-[15px] leading-relaxed text-slate-500">
                    Simpan layanan yang sering dijual agar bisa ditambahkan ke invoice lebih cepat.
                  </DialogDescription>
                </div>
              </div>

              {/* Form Body */}
              <div className="grid gap-5 px-6 pb-8 sm:px-8">
                <div className="space-y-5">
                  <label className="block space-y-2">
                    <span className="text-[14px] font-semibold text-slate-700">
                      Nama Layanan <span className="text-red-500">*</span>
                    </span>
                    <Input
                      value={catalogDraft.name}
                      onChange={(event) =>
                        setCatalogDraft((current) => ({ ...current, name: event.target.value }))
                      }
                      placeholder="Contoh: Jasa Pembuatan Website"
                      className="h-12 w-full rounded-xl border-slate-200 bg-slate-50/50 px-4 text-[15px] shadow-sm transition-all focus-visible:border-emerald-500/40 focus-visible:bg-white focus-visible:ring-4 focus-visible:ring-emerald-500/10"
                    />
                  </label>
                  <label className="block space-y-2">
                    <span className="text-[14px] font-semibold text-slate-700">
                      Kategori Layanan
                    </span>
                    <Input
                      value={catalogDraft.category}
                      onChange={(event) =>
                        setCatalogDraft((current) => ({ ...current, category: event.target.value }))
                      }
                      placeholder="Contoh: Digital Marketing"
                      className="h-12 w-full rounded-xl border-slate-200 bg-slate-50/50 px-4 text-[15px] shadow-sm transition-all focus-visible:border-emerald-500/40 focus-visible:bg-white focus-visible:ring-4 focus-visible:ring-emerald-500/10"
                    />
                  </label>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <label className="block space-y-2">
                      <span className="text-[14px] font-semibold text-slate-700">Satuan</span>
                      <Input
                        value={catalogDraft.unit}
                        onChange={(event) =>
                          setCatalogDraft((current) => ({ ...current, unit: event.target.value }))
                        }
                        placeholder="Contoh: paket, proyek, sesi"
                        className="h-12 w-full rounded-xl border-slate-200 bg-slate-50/50 px-4 text-[15px] shadow-sm transition-all focus-visible:border-emerald-500/40 focus-visible:bg-white focus-visible:ring-4 focus-visible:ring-emerald-500/10"
                      />
                    </label>
                    <label className="block space-y-2">
                      <span className="text-[14px] font-semibold text-slate-700">
                        Harga Jual <span className="text-red-500">*</span>
                      </span>
                      <div className="relative">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-[15px] font-medium text-slate-400">
                          Rp
                        </div>
                        <Input
                          type="number"
                          min={0}
                          value={catalogDraft.priceCents}
                          onChange={(event) =>
                            setCatalogDraft((current) => ({
                              ...current,
                              priceCents: event.target.value
                            }))
                          }
                          placeholder="0"
                          className="h-12 w-full rounded-xl border-slate-200 bg-slate-50/50 pl-11 pr-4 text-[15px] font-medium shadow-sm transition-all focus-visible:border-emerald-500/40 focus-visible:bg-white focus-visible:ring-4 focus-visible:ring-emerald-500/10"
                        />
                      </div>
                    </label>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="relative border-t border-slate-100 bg-slate-50/50 px-6 py-5 sm:px-8">
                <div className="flex flex-col-reverse justify-end gap-3 sm:flex-row sm:gap-4">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-12 w-full min-w-[120px] rounded-full border-slate-200 bg-white px-6 text-[15px] font-semibold text-slate-600 transition-all hover:bg-slate-100 hover:text-slate-900 sm:w-auto"
                    onClick={() => setIsCreateCatalogModalOpen(false)}
                  >
                    Batalkan
                  </Button>
                  <Button
                    type="button"
                    className="h-12 w-full min-w-[140px] rounded-full bg-emerald-500 px-6 text-[15px] font-semibold text-white shadow-[0_8px_20px_-6px_rgba(16,185,129,0.3)] transition-all hover:-translate-y-0.5 hover:bg-emerald-600 hover:shadow-[0_12px_24px_-8px_rgba(16,185,129,0.4)] disabled:pointer-events-none disabled:opacity-60 sm:w-auto"
                    onClick={() => void handleCreateCatalog()}
                    disabled={
                      !catalogDraft.name.trim() ||
                      !String(catalogDraft.priceCents).trim() ||
                      isCatalogCreating
                    }
                  >
                    {isCatalogCreating ? "Menyimpan..." : "Simpan Katalog"}
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <DrawerFooter className="shrink-0 border-t border-border/70 bg-background/60 backdrop-blur-md px-5 py-4 shadow-[0_-12px_24px_hsl(var(--foreground)/0.04)] md:px-6">
          <div className="flex flex-wrap items-center justify-end gap-3">
            <DrawerClose asChild>
              <Button
                type="button"
                variant="ghost"
                className="rounded-md text-foreground hover:bg-muted"
              >
                Batalkan
              </Button>
            </DrawerClose>
            <Button
              type="submit"
              form="invoice-drawer-form"
              className="rounded-md px-6 shadow-md shadow-primary/10"
              disabled={!canCreateDraft}
            >
              {isSubmitting ? "Menyimpan..." : "Simpan Invoice"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="rounded-md border border-border/80 bg-background shadow-sm"
              onClick={() => void handleUpdateItems()}
              disabled={!canUpdateDraft}
            >
              {isUpdatingItems ? "Updating..." : "Update Draft Items"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="rounded-md border border-border/80 bg-background shadow-sm"
              onClick={() => void handleSendInvoice()}
              disabled={!canSendInvoice}
            >
              {isSendingInvoice ? "Sending..." : "Send Invoice"}
            </Button>
            {kind === InvoiceKind.DP_AND_FINAL ? (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  className="rounded-md border border-border/80 bg-background shadow-sm"
                  onClick={() => void handleMarkPaid(PaymentMilestoneType.DP)}
                  disabled={!canMarkPaid}
                >
                  {isMarkingPaid ? "Updating..." : "Mark DP Paid"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="rounded-md border border-border/80 bg-background shadow-sm"
                  onClick={() => void handleMarkPaid(PaymentMilestoneType.FINAL)}
                  disabled={!canMarkPaid}
                >
                  {isMarkingPaid ? "Updating..." : "Mark Final Paid"}
                </Button>
              </>
            ) : (
              <Button
                type="button"
                variant="secondary"
                className="rounded-md border border-border/80 bg-background shadow-sm"
                onClick={() => void handleMarkPaid(PaymentMilestoneType.FULL)}
                disabled={!canMarkPaid}
              >
                {isMarkingPaid ? "Updating..." : "Mark Paid"}
              </Button>
            )}
          </div>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
