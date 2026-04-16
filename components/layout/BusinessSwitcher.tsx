"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { Building2, Check, ChevronsUpDown, CirclePlus, Loader2 } from "lucide-react";
import QRCode from "qrcode";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { invalidateOrganizationsCache } from "@/lib/client/orgsCache";

type OrgSummary = {
  id: string;
  name: string;
  role: string;
  createdAt: string;
};

type OrganizationsPayload = {
  data?: {
    organizations?: OrgSummary[];
    activeOrgId?: string | null;
  };
  error?: {
    message?: string;
  };
};

type PricingPlan = {
  months: 1 | 3 | 12;
  label: string;
  discountBps: number;
  rawBaseAmountCents: number;
  discountCents: number;
  netBaseAmountCents: number;
  gatewayFeeCents: number;
  totalAmountCents: number;
  renewalDays: number;
};

type BillingPricingPayload = {
  data?: {
    pricing?: {
      defaultPlanMonths?: 1 | 3 | 12;
      plans?: PricingPlan[];
    };
  };
  error?: {
    message?: string;
  };
};

type ProvisioningCheckoutPayload = {
  data?: {
    order?: {
      id: string;
      status: string;
      createdOrg?: {
        id: string;
        name: string;
      } | null;
    };
    selectedPlan?: PricingPlan;
    payment?: {
      payment_number?: string;
      payment_method?: string;
      expired_at?: string;
      total_payment?: number;
      fee?: number;
    } | null;
    paymentSummary?: {
      payableAmountCents?: number;
      providerFeeCents?: number | null;
    };
  };
  error?: {
    message?: string;
  };
};

type ProvisioningOrderPayload = {
  data?: {
    order?: {
      id: string;
      status: string;
      createdOrg?: {
        id: string;
        name: string;
      } | null;
      expiredAt?: string | null;
      paymentMethod?: string;
      paymentNumber?: string | null;
      payableAmountCents?: number;
    };
  };
  error?: {
    message?: string;
  };
};

function formatIdr(cents: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
  }).format(cents);
}

function formatCountdown(value: string | null | undefined, nowMs: number): string {
  if (!value) {
    return "-";
  }

  const expiresAtMs = new Date(value).getTime();
  if (!Number.isFinite(expiresAtMs)) {
    return "-";
  }

  const remainingMs = Math.max(0, expiresAtMs - nowMs);
  const totalSeconds = Math.floor(remainingMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;
}

function hasNotExpired(value: string | null | undefined, nowMs = Date.now()): boolean {
  if (!value) {
    return false;
  }

  const expiresAtMs = new Date(value).getTime();
  if (!Number.isFinite(expiresAtMs)) {
    return false;
  }

  return expiresAtMs > nowMs;
}

export function BusinessSwitcher({
  isOwnerRole,
  onActiveOrgChanged
}: {
  isOwnerRole: boolean;
  onActiveOrgChanged?: (orgId: string) => void;
}) {
  const [organizations, setOrganizations] = useState<OrgSummary[]>([]);
  const [activeOrgId, setActiveOrgId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [switchingOrgId, setSwitchingOrgId] = useState<string | null>(null);

  const [isPlanDialogOpen, setIsPlanDialogOpen] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [newBusinessName, setNewBusinessName] = useState("");

  const [planOptions, setPlanOptions] = useState<PricingPlan[]>([]);
  const [selectedPlanMonths, setSelectedPlanMonths] = useState<1 | 3 | 12>(1);
  const [isPricingLoading, setIsPricingLoading] = useState(false);
  const [pricingError, setPricingError] = useState<string | null>(null);

  const [isCreatingCheckout, setIsCreatingCheckout] = useState(false);
  const [isPollingOrder, setIsPollingOrder] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [paymentNumber, setPaymentNumber] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<string | null>(null);
  const [paymentTotalCents, setPaymentTotalCents] = useState<number>(0);
  const [paymentExpiresAt, setPaymentExpiresAt] = useState<string | null>(null);
  const [paymentQrDataUrl, setPaymentQrDataUrl] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [countdownNowMs, setCountdownNowMs] = useState(() => Date.now());

  const activeOrg = useMemo(
    () => organizations.find((org) => org.id === activeOrgId) ?? organizations[0] ?? null,
    [activeOrgId, organizations]
  );

  const selectedPlan = useMemo(
    () => planOptions.find((plan) => plan.months === selectedPlanMonths) ?? planOptions[0] ?? null,
    [planOptions, selectedPlanMonths]
  );

  const isQris = (paymentMethod ?? "").toLowerCase() === "qris";

  async function loadOrganizations() {
    setIsLoading(true);
    try {
      const response = await fetch("/api/orgs", { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as OrganizationsPayload | null;
      if (!response.ok) {
        throw new Error(payload?.error?.message ?? "Gagal memuat business.");
      }
      const rows = payload?.data?.organizations ?? [];
      setOrganizations(rows);
      setActiveOrgId(payload?.data?.activeOrgId ?? rows[0]?.id ?? null);
    } catch {
      setOrganizations([]);
      setActiveOrgId(null);
    } finally {
      setIsLoading(false);
    }
  }

  async function loadPricingPlans() {
    setIsPricingLoading(true);
    setPricingError(null);
    try {
      const response = await fetch("/api/billing/subscription", { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as BillingPricingPayload | null;
      if (!response.ok) {
        throw new Error(payload?.error?.message ?? "Gagal memuat paket langganan.");
      }

      const plans = payload?.data?.pricing?.plans ?? [];
      if (plans.length === 0) {
        throw new Error("Paket langganan tidak tersedia.");
      }

      setPlanOptions(plans);
      const defaultMonths = payload?.data?.pricing?.defaultPlanMonths ?? plans[0]?.months ?? 1;
      setSelectedPlanMonths(defaultMonths);
    } catch (error) {
      setPricingError(error instanceof Error ? error.message : "Gagal memuat paket langganan.");
      setPlanOptions([]);
    } finally {
      setIsPricingLoading(false);
    }
  }

  function resetCheckoutState() {
    setIsCreatingCheckout(false);
    setIsPollingOrder(false);
    setOrderId(null);
    setPaymentNumber(null);
    setPaymentMethod(null);
    setPaymentExpiresAt(null);
    setPaymentTotalCents(0);
    setPaymentQrDataUrl(null);
    setCheckoutError(null);
  }

  function resetAddBusinessFlow() {
    setNewBusinessName("");
    setPlanOptions([]);
    setSelectedPlanMonths(1);
    setPricingError(null);
    setIsPricingLoading(false);
    resetCheckoutState();
  }

  function openAddBusinessFlow() {
    resetAddBusinessFlow();
    setIsPlanDialogOpen(true);
    void loadPricingPlans();
  }

  useEffect(() => {
    void loadOrganizations();
  }, []);

  useEffect(() => {
    let canceled = false;

    async function renderQr(value: string) {
      try {
        const dataUrl = await QRCode.toDataURL(value, {
          width: 320,
          margin: 1
        });
        if (!canceled) {
          setPaymentQrDataUrl(dataUrl);
        }
      } catch {
        if (!canceled) {
          setPaymentQrDataUrl(null);
        }
      }
    }

    if (!isQris || !paymentNumber) {
      setPaymentQrDataUrl(null);
      return () => {
        canceled = true;
      };
    }

    void renderQr(paymentNumber);
    return () => {
      canceled = true;
    };
  }, [isQris, paymentNumber]);

  useEffect(() => {
    if (!isPaymentDialogOpen || !paymentExpiresAt) {
      return;
    }

    const interval = window.setInterval(() => {
      setCountdownNowMs(Date.now());
    }, 1_000);

    return () => {
      window.clearInterval(interval);
    };
  }, [isPaymentDialogOpen, paymentExpiresAt]);

  useEffect(() => {
    if (!isPaymentDialogOpen || !orderId || !isPollingOrder) {
      return;
    }
    const currentOrderId = orderId;

    let canceled = false;

    async function pollOrderStatus() {
      try {
        const response = await fetch(`/api/orgs/provisioning-orders/${encodeURIComponent(currentOrderId)}`, {
          cache: "no-store"
        });
        const payload = (await response.json().catch(() => null)) as ProvisioningOrderPayload | null;
        if (!response.ok) {
          return;
        }

        const order = payload?.data?.order;
        if (!order) {
          return;
        }

        if (order.status === "PAID" && order.createdOrg?.id) {
          canceled = true;
          await fetch("/api/orgs/active", {
            method: "PUT",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({ orgId: order.createdOrg.id })
          });
          invalidateOrganizationsCache();
          setIsPollingOrder(false);
          setIsPaymentDialogOpen(false);
          if (onActiveOrgChanged) {
            onActiveOrgChanged(order.createdOrg.id);
          }
          window.location.reload();
        }
      } catch {
        // ignore transient errors during polling
      }
    }

    const interval = window.setInterval(() => {
      if (canceled) {
        return;
      }
      void pollOrderStatus();
    }, 3_000);

    return () => {
      canceled = true;
      window.clearInterval(interval);
    };
  }, [isPaymentDialogOpen, isPollingOrder, onActiveOrgChanged, orderId]);

  async function handleSwitchBusiness(nextOrgId: string) {
    if (!nextOrgId || nextOrgId === activeOrgId || switchingOrgId) {
      return;
    }

    setSwitchingOrgId(nextOrgId);
    try {
      const response = await fetch("/api/orgs/active", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ orgId: nextOrgId })
      });
      if (!response.ok) {
        throw new Error("Gagal switch business");
      }

      invalidateOrganizationsCache();
      setActiveOrgId(nextOrgId);
      if (onActiveOrgChanged) {
        onActiveOrgChanged(nextOrgId);
      }
      window.location.reload();
    } catch {
      // ignore switch error on sidebar action
    } finally {
      setSwitchingOrgId(null);
    }
  }

  async function handleCreateProvisioningCheckout() {
    if (!newBusinessName.trim() || isCreatingCheckout || !selectedPlan) {
      return;
    }

    setIsCreatingCheckout(true);
    setCheckoutError(null);
    try {
      const response = await fetch("/api/orgs/provisioning-checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          businessName: newBusinessName,
          paymentMethod: "qris",
          planMonths: selectedPlan.months
        })
      });
      const payload = (await response.json().catch(() => null)) as ProvisioningCheckoutPayload | null;
      if (!response.ok) {
        throw new Error(payload?.error?.message ?? "Gagal menyiapkan checkout business.");
      }

      setOrderId(payload?.data?.order?.id ?? null);
      setPaymentNumber(payload?.data?.payment?.payment_number ?? null);
      setPaymentMethod(payload?.data?.payment?.payment_method ?? "qris");
      setPaymentExpiresAt(payload?.data?.payment?.expired_at ?? null);
      setPaymentTotalCents(
        payload?.data?.paymentSummary?.payableAmountCents ??
          payload?.data?.payment?.total_payment ??
          payload?.data?.selectedPlan?.totalAmountCents ??
          selectedPlan.totalAmountCents
      );
      setCountdownNowMs(Date.now());
      setIsPollingOrder(true);
      setIsPlanDialogOpen(false);
      setIsPaymentDialogOpen(true);
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : "Gagal menyiapkan checkout business.");
    } finally {
      setIsCreatingCheckout(false);
    }
  }

  return (
    <>
      <div className="mx-3 mb-2 group-data-[collapsible=icon]:hidden">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-xl border border-sidebar-border/60 bg-sidebar-accent/30 px-3 py-2 text-left hover:bg-sidebar-accent/60"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary/15 text-sidebar-primary">
                <Building2 className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-sidebar-foreground">
                  {activeOrg?.name ?? (isLoading ? "Memuat business..." : "Belum ada business")}
                </span>
                <span className="block truncate text-xs text-sidebar-foreground/70">{activeOrg?.role ?? ""}</span>
              </span>
              {switchingOrgId ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronsUpDown className="h-4 w-4" />}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[260px] rounded-xl">
            <DropdownMenuLabel className="text-xs text-muted-foreground">Business</DropdownMenuLabel>
            {organizations.map((org) => (
              <DropdownMenuItem
                key={org.id}
                className="flex items-center justify-between gap-2"
                disabled={Boolean(switchingOrgId)}
                onSelect={() => {
                  void handleSwitchBusiness(org.id);
                }}
              >
                <span className="truncate text-sm">{org.name}</span>
                {org.id === activeOrgId ? <Check className="h-4 w-4 text-emerald-600" /> : null}
              </DropdownMenuItem>
            ))}
            {isOwnerRole ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() => {
                    openAddBusinessFlow();
                  }}
                >
                  <CirclePlus className="h-4 w-4" />
                  Add business
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog
        open={isPlanDialogOpen}
        onOpenChange={(open) => {
          setIsPlanDialogOpen(open);
          if (!open) {
            resetAddBusinessFlow();
          }
        }}
      >
        <DialogContent className="sm:max-w-[480px] p-0 rounded-[28px] overflow-hidden gap-0">
          <div className="bg-muted/30 px-6 py-5 border-b border-border/50">
            <DialogTitle className="text-[18px] font-bold text-foreground">Tambah business baru</DialogTitle>
            <DialogDescription className="text-[13px] font-medium leading-relaxed text-muted-foreground/80 mt-1">
              Isi nama business, pilih paket langganan, lalu lanjutkan pembayaran. Tanpa free trial.
            </DialogDescription>
          </div>

          <div className="p-6 overflow-y-auto max-h-[75vh] space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="new-business-name">
                Nama business
              </label>
              <Input
                id="new-business-name"
                placeholder="Contoh: Acme Corp"
                value={newBusinessName}
                onChange={(event) => setNewBusinessName(event.target.value)}
              />
            </div>

            {isPricingLoading ? (
              <div className="rounded-xl border border-border/60 bg-muted/20 px-4 py-6 text-sm text-muted-foreground text-center">
                Memuat paket langganan...
              </div>
            ) : null}

            {!isPricingLoading && planOptions.length > 0 ? (
              <>
                <div className="grid gap-3 sm:grid-cols-3">
                  {planOptions.map((plan) => {
                    const isSelected = selectedPlanMonths === plan.months;
                    const discountPercent = Math.round(plan.discountBps / 100);

                    return (
                      <button
                        key={plan.months}
                        type="button"
                        onClick={() => setSelectedPlanMonths(plan.months)}
                        className={`relative flex flex-col items-center justify-center gap-1.5 p-4 rounded-[20px] border transition-all ${
                          isSelected
                            ? "border-primary bg-primary/5 shadow-md shadow-primary/10 ring-1 ring-primary"
                            : "border-border/60 bg-card hover:border-primary/50 hover:bg-muted/10"
                        }`}
                      >
                        <span className={`text-[13px] font-bold ${isSelected ? "text-primary" : "text-foreground"}`}>{plan.label}</span>
                        <span className={`text-[16px] font-bold tracking-tight ${isSelected ? "text-foreground" : "text-muted-foreground"}`}>
                          {formatIdr(plan.totalAmountCents)}
                        </span>
                        {discountPercent > 0 ? (
                          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 mt-0.5 text-[10px] font-bold text-emerald-700">Hem.{discountPercent}%</span>
                        ) : (
                          <span className="rounded-full px-2 py-0.5 mt-0.5 text-[10px] text-transparent select-none">-</span>
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="rounded-2xl border border-border/50 bg-muted/20 p-5 shadow-inner">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80">Kalkulasi Tagihan</p>
                  <div className="mt-4 space-y-2.5 text-[13px]">
                    <div className="flex items-center justify-between font-medium text-muted-foreground">
                      <span>Biaya Langganan ({selectedPlan?.months ?? 1} Bulan)</span>
                      <span>{formatIdr(selectedPlan?.rawBaseAmountCents ?? 0)}</span>
                    </div>
                    {(selectedPlan?.discountCents ?? 0) > 0 ? (
                      <div className="flex items-center justify-between font-bold text-emerald-600">
                        <span>Diskon Spesial ({Math.round((selectedPlan?.discountBps ?? 0) / 100)}%)</span>
                        <span>-{formatIdr(selectedPlan?.discountCents ?? 0)}</span>
                      </div>
                    ) : null}
                    <div className="flex items-center justify-between font-medium text-muted-foreground/80">
                      <span>Biaya Layanan Platform (2%)</span>
                      <span>{formatIdr(selectedPlan?.gatewayFeeCents ?? 0)}</span>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-border/50 pt-4">
                    <span className="font-bold text-foreground">Grand Total</span>
                    <span className="text-[20px] font-bold text-foreground">{formatIdr(selectedPlan?.totalAmountCents ?? 0)}</span>
                  </div>
                </div>
              </>
            ) : null}

            {pricingError ? <p className="text-sm text-rose-600">{pricingError}</p> : null}
            {checkoutError ? <p className="text-sm text-rose-600">{checkoutError}</p> : null}

            <Button
              className="w-full h-12 rounded-[14px] font-bold shadow-md shadow-primary/20 text-[14px]"
              disabled={isCreatingCheckout || !newBusinessName.trim() || !selectedPlan || isPricingLoading}
              onClick={() => void handleCreateProvisioningCheckout()}
            >
              {isCreatingCheckout ? "Memproses pesanan..." : "Bayar Sekarang"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isPaymentDialogOpen}
        onOpenChange={(open) => {
          setIsPaymentDialogOpen(open);
          if (!open) {
            resetAddBusinessFlow();
          }
        }}
      >
        <DialogContent className="sm:max-w-[420px] p-6 rounded-[24px] gap-0">
          <DialogHeader className="space-y-1.5 pb-2">
            <DialogTitle className="text-[18px] font-bold text-foreground">Scan QR Pembayaran</DialogTitle>
            <DialogDescription className="text-[13px] font-medium leading-relaxed text-muted-foreground/80">
              Gunakan aplikasi e-wallet atau mobile banking untuk menyelesaikan pembayaran business baru.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 space-y-4">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              Business akan otomatis dibuat setelah pembayaran terverifikasi.
            </div>
            <div className="flex flex-col items-center pb-2 pt-2">
              {paymentQrDataUrl && isQris ? (
                <div className="flex items-center justify-center rounded-[20px] border border-border/40 bg-white p-4 shadow-[0_8px_32px_-8px_rgba(0,0,0,0.08)]">
                  <Image src={paymentQrDataUrl} alt="QR pembayaran business" width={280} height={280} unoptimized className="object-contain" />
                </div>
              ) : (
                <div className="flex h-[280px] w-[280px] items-center justify-center rounded-[20px] border border-dashed border-border/50 bg-muted/20">
                  <p className="text-[13px] font-medium text-muted-foreground text-center px-6">Menyiapkan QR pembayaran...</p>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-border/50 bg-muted/20 px-4 py-3 space-y-1.5 shadow-inner">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-semibold text-muted-foreground/80">Nominal yang harus dibayar:</span>
                <span className="text-[14px] font-bold tracking-tight text-foreground">{formatIdr(paymentTotalCents ?? 0)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-semibold text-muted-foreground/80">Sisa waktu pembayaran:</span>
                <span className="text-[13px] font-bold text-amber-600 tracking-tight">{formatCountdown(paymentExpiresAt, countdownNowMs)}</span>
              </div>
            </div>

            <Button
              variant="secondary"
              className="w-full"
              onClick={() => {
                if (!orderId) {
                  return;
                }
                setIsPollingOrder(true);
              }}
              disabled={isPollingOrder || !hasNotExpired(paymentExpiresAt)}
            >
              {isPollingOrder ? "Menunggu verifikasi pembayaran..." : "Saya sudah bayar, cek status"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
