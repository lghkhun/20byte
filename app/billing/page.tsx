"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import QRCode from "qrcode";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CreditCard, History } from "lucide-react";
import { fetchJsonCached, invalidateFetchCache } from "@/lib/client/fetchCache";
import { resolveCheckoutPaymentMethod } from "@/lib/payment/checkoutFallback";

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

type SubscriptionResponse = {
  data?: {
    subscription?: {
      orgId: string;
      status: string;
      trialEndAt: string;
      graceDays: number;
      currentPeriodEndAt: string | null;
      baseAmountCents: number;
      gatewayFeeBps: number;
      currency: string;
    };
    state?: {
      graceEndAt: string;
      isLocked: boolean;
    };
    pricing?: {
      baseAmountCents: number;
      gatewayFeeCents: number;
      totalAmountCents: number;
      renewalDays: number;
      currency: string;
      defaultPlanMonths?: 1 | 3 | 12;
      plans?: PricingPlan[];
    };
  };
  error?: {
    message?: string;
  };
};

type CheckoutResponse = {
  data?: {
    charge?: {
      id: string;
      orderId: string;
      totalAmountCents: number;
      status: string;
      expiredAt: string | null;
    };
    payment?: {
      amount?: number;
      fee?: number;
      total_payment?: number;
      payment_number?: string;
      payment_method?: string;
      expired_at?: string;
    } | null;
    paymentSummary?: {
      requestedAmountCents?: number;
      providerFeeCents?: number | null;
      payableAmountCents?: number;
    };
    appliedCoupon?: {
      code: string;
      name: string;
      discountCents: number;
      subtotalCents: number;
      finalAmountCents: number;
    } | null;
  };
  error?: {
    message?: string;
  };
};

type ChargesResponse = {
  data?: {
    charges?: ChargeItem[];
  };
};

type ChargeItem = {
  id: string;
  orderId: string;
  status: string;
  requestedAmountCents?: number;
  providerFeeCents?: number | null;
  payableAmountCents?: number;
  totalAmountCents: number;
  paymentMethod: string;
  paymentNumber: string | null;
  expiredAt: string | null;
  appliedCouponCode?: string | null;
  couponDiscountCents?: number;
  createdAt: string;
  paidAt: string | null;
};

type StoredActivePayment = {
  paymentNumber: string;
  paymentMethod: string;
  totalAmountCents: number;
  providerFeeCents?: number | null;
  expiredAt: string;
};

function formatIdr(cents: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
  }).format(cents);
}

function formatDate(value: string | null | undefined): string {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
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

function toActivePaymentStorageKey(orgId: string): string {
  return `billing:active-payment:${orgId}`;
}

export default function BillingPage() {
  const [subscriptionPayload, setSubscriptionPayload] = useState<SubscriptionResponse["data"] | null>(null);
  const [charges, setCharges] = useState<ChargeItem[]>([]);
  const [paymentNumber, setPaymentNumber] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<string | null>(null);
  const [paymentTotalCents, setPaymentTotalCents] = useState<number | null>(null);
  const [paymentProviderFeeCents, setPaymentProviderFeeCents] = useState<number | null>(null);
  const [paymentExpiresAt, setPaymentExpiresAt] = useState<string | null>(null);
  const [paymentQrDataUrl, setPaymentQrDataUrl] = useState<string | null>(null);
  const [isQrDialogOpen, setIsQrDialogOpen] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [isLoading, setIsLoading] = useState(true);
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlanMonths, setSelectedPlanMonths] = useState<1 | 3 | 12>(1);
  const [isPricingDialogOpen, setIsPricingDialogOpen] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [paymentCouponCode, setPaymentCouponCode] = useState<string | null>(null);
  const [paymentCouponDiscountCents, setPaymentCouponDiscountCents] = useState(0);
  const orgId = subscriptionPayload?.subscription?.orgId ?? null;

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [subPayload, chargePayload] = await Promise.all([
        fetchJsonCached<SubscriptionResponse>("/api/billing/subscription", { ttlMs: 15_000, init: { cache: "no-store" } }),
        fetchJsonCached<ChargesResponse>("/api/billing/charges", { ttlMs: 10_000, init: { cache: "no-store" } })
      ]);

      setSubscriptionPayload(subPayload?.data ?? null);
      const chargeItems = chargePayload?.data?.charges ?? [];
      setCharges(chargeItems);

      const latestPending = chargeItems.find((charge) => charge.status === "PENDING" && charge.paymentNumber);
      if (latestPending && hasNotExpired(latestPending.expiredAt)) {
        setPaymentNumber(latestPending.paymentNumber);
        setPaymentMethod(
          resolveCheckoutPaymentMethod({
            paymentMethod: latestPending.paymentMethod,
            paymentNumber: latestPending.paymentNumber,
            fallbackMethod: "qris"
          })
        );
        setPaymentTotalCents(latestPending.payableAmountCents ?? latestPending.totalAmountCents);
        setPaymentProviderFeeCents(latestPending.providerFeeCents ?? null);
        setPaymentExpiresAt(latestPending.expiredAt);
        setPaymentCouponCode(latestPending.appliedCouponCode ?? null);
        setPaymentCouponDiscountCents(latestPending.couponDiscountCents ?? 0);
      } else {
        setPaymentNumber(null);
        setPaymentMethod(null);
        setPaymentTotalCents(null);
        setPaymentProviderFeeCents(null);
        setPaymentExpiresAt(null);
        setPaymentCouponCode(null);
        setPaymentCouponDiscountCents(0);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load billing data.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const pricing = subscriptionPayload?.pricing;
  const planOptions = useMemo(() => pricing?.plans ?? [], [pricing?.plans]);
  const selectedPlan =
    planOptions.find((plan) => plan.months === selectedPlanMonths) ??
    planOptions.find((plan) => plan.months === pricing?.defaultPlanMonths) ??
    planOptions[0] ??
    null;
  const status = subscriptionPayload?.subscription?.status ?? "-";
  const isQrisPayment =
    resolveCheckoutPaymentMethod({
      paymentMethod,
      paymentNumber,
      fallbackMethod: "qris"
    }) === "qris";

  useEffect(() => {
    if (!planOptions.length) {
      return;
    }

    const hasSelected = planOptions.some((plan) => plan.months === selectedPlanMonths);
    if (!hasSelected) {
      const fallbackMonths = planOptions[0]?.months;
      if (fallbackMonths) {
        setSelectedPlanMonths(fallbackMonths);
      }
    }
  }, [planOptions, selectedPlanMonths]);

  useEffect(() => {
    let canceled = false;

    async function generateQrDataUrl(value: string) {
      try {
        const qrDataUrl = await QRCode.toDataURL(value, {
          width: 320,
          margin: 1
        });
        if (!canceled) {
          setPaymentQrDataUrl(qrDataUrl);
        }
      } catch {
        if (!canceled) {
          setPaymentQrDataUrl(null);
        }
      }
    }

    if (!paymentNumber || !isQrisPayment) {
      setPaymentQrDataUrl(null);
      return () => {
        canceled = true;
      };
    }

    void generateQrDataUrl(paymentNumber);
    return () => {
      canceled = true;
    };
  }, [isQrisPayment, paymentNumber]);

  useEffect(() => {
    if (!orgId || typeof window === "undefined") {
      return;
    }

    const storageKey = toActivePaymentStorageKey(orgId);
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return;
    }

    try {
      const parsed = JSON.parse(raw) as StoredActivePayment;
      if (!hasNotExpired(parsed.expiredAt)) {
        window.localStorage.removeItem(storageKey);
        return;
      }

      if (!paymentNumber) {
        setPaymentNumber(parsed.paymentNumber);
        setPaymentMethod(
          resolveCheckoutPaymentMethod({
            paymentMethod: parsed.paymentMethod,
            paymentNumber: parsed.paymentNumber,
            fallbackMethod: "qris"
          })
        );
        setPaymentTotalCents(parsed.totalAmountCents);
        setPaymentProviderFeeCents(parsed.providerFeeCents ?? null);
        setPaymentExpiresAt(parsed.expiredAt);
      }
    } catch {
      window.localStorage.removeItem(storageKey);
    }
  }, [orgId, paymentNumber]);

  useEffect(() => {
    if (!orgId || typeof window === "undefined") {
      return;
    }

    const storageKey = toActivePaymentStorageKey(orgId);
    if (!paymentNumber || !paymentMethod || paymentTotalCents === null || !paymentExpiresAt || !hasNotExpired(paymentExpiresAt)) {
      window.localStorage.removeItem(storageKey);
      return;
    }

    const payload: StoredActivePayment = {
      paymentNumber,
      paymentMethod,
      totalAmountCents: paymentTotalCents,
      providerFeeCents: paymentProviderFeeCents,
      expiredAt: paymentExpiresAt
    };
    window.localStorage.setItem(storageKey, JSON.stringify(payload));
  }, [orgId, paymentExpiresAt, paymentMethod, paymentNumber, paymentProviderFeeCents, paymentTotalCents]);

  useEffect(() => {
    if (!paymentExpiresAt) {
      return;
    }

    const intervalId = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => {
      clearInterval(intervalId);
    };
  }, [paymentExpiresAt]);

  async function handleCheckout() {
    if (hasNotExpired(paymentExpiresAt) && paymentNumber && isQrisPayment) {
      setIsQrDialogOpen(true);
      return;
    }

    setIsCheckoutLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          paymentMethod: "qris",
          planMonths: selectedPlan?.months ?? selectedPlanMonths,
          couponCode: couponCode.trim() || undefined
        })
      });

      const payload = (await response.json().catch(() => null)) as CheckoutResponse | null;
      if (!response.ok) {
        throw new Error(payload?.error?.message ?? "Failed to create checkout.");
      }

      setPaymentNumber(payload?.data?.payment?.payment_number ?? null);
      const nextPaymentMethod = resolveCheckoutPaymentMethod({
        paymentMethod: payload?.data?.payment?.payment_method ?? null,
        paymentNumber: payload?.data?.payment?.payment_number ?? null,
        fallbackMethod: "qris"
      });
      setPaymentMethod(nextPaymentMethod);
      setPaymentTotalCents(
        payload?.data?.paymentSummary?.payableAmountCents ??
          payload?.data?.payment?.total_payment ??
          payload?.data?.charge?.totalAmountCents ??
          null
      );
      setPaymentProviderFeeCents(
        payload?.data?.paymentSummary?.providerFeeCents ??
          (typeof payload?.data?.payment?.fee === "number" ? payload.data.payment.fee : null)
      );
      setPaymentExpiresAt(payload?.data?.payment?.expired_at ?? null);
      setPaymentCouponCode(payload?.data?.appliedCoupon?.code ?? null);
      setPaymentCouponDiscountCents(payload?.data?.appliedCoupon?.discountCents ?? 0);
      setIsPricingDialogOpen(false); // Close pricing popup on successful creation
      if ((nextPaymentMethod ?? "").toLowerCase() === "qris" && payload?.data?.payment?.payment_number) {
        setIsQrDialogOpen(true);
      }
      await load();
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : "Checkout failed.");
    } finally {
      invalidateFetchCache("GET:/api/billing/subscription");
      invalidateFetchCache("GET:/api/billing/charges");
      setIsCheckoutLoading(false);
    }
  }
  return (
    <div className="w-full flex-1 inbox-scroll h-full overflow-y-auto p-4 md:p-6 lg:p-8">
      <div className="w-full space-y-6">
        {/* Modern Header */}
        <header className="rounded-3xl border border-border/60 bg-gradient-to-b from-card to-background/50 px-6 py-6 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.02)] flex items-center gap-5">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] bg-primary/10 text-primary">
            <CreditCard className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-[28px]">Billing & Subscription</h1>
            <p className="mt-1.5 text-[14px] font-medium text-muted-foreground/80">Kelola status aktif akun dan riwayat pembayaran subscription Anda.</p>
          </div>
        </header>

        {error ? <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm font-medium text-rose-600 shadow-sm">{error}</p> : null}

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
          </div>
        ) : (
          <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)] 2xl:grid-cols-[420px_minmax(0,1fr)] items-start">
            {/* Left Column: ATM Card */}
            <section className="space-y-6">
              <div className="relative w-full aspect-[1.586/1] overflow-hidden rounded-[24px] border border-border/10 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 sm:p-8 shadow-xl flex flex-col justify-between">
                {/* Decorative Elements */}
                <div className="absolute right-0 top-0 opacity-[0.15] blur-[60px] pointer-events-none">
                  <div className="h-64 w-64 rounded-full bg-primary" />
                </div>
                <div className="absolute left-[-10%] bottom-[-20%] opacity-[0.08] blur-[60px] pointer-events-none">
                  <div className="h-64 w-64 rounded-full bg-emerald-500" />
                </div>
                
                <div className="relative z-10 flex flex-col justify-between h-full">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 pr-2">
                      <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.15em] text-slate-400 line-clamp-1">
                        {status === "TRIALING" ? "Masa Trial Berakhir" : status === "ACTIVE" ? "Periode Aktif" : "Status Langganan"}
                      </p>
                      <p className="mt-1.5 sm:mt-2.5 text-[18px] sm:text-[22px] font-bold tracking-tight text-white drop-shadow-md truncate">
                        {status === "TRIALING"
                          ? formatDate(subscriptionPayload?.subscription?.trialEndAt)
                          : formatDate(subscriptionPayload?.subscription?.currentPeriodEndAt)}
                      </p>
                    </div>
                    <span className="rounded-lg border border-white/20 bg-white/10 px-2 py-1 sm:px-3 sm:py-1.5 text-[9px] sm:text-[10px] font-bold tracking-widest uppercase text-white backdrop-blur-md shadow-sm shrink-0">
                      {status}
                    </span>
                  </div>
                  
                  <div className="flex items-end justify-between gap-3 mt-8">
                    <div className="flex items-center gap-2.5 sm:gap-3">
                      {/* Simulating Premium ATM Chip */}
                      <div className="h-8 w-11 sm:h-10 sm:w-14 shrink-0 rounded-md border border-amber-500/30 bg-gradient-to-br from-amber-200 via-amber-400 to-amber-600 opacity-90 shadow-inner overflow-hidden relative">
                        <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_20%,rgba(255,255,255,0.3)_50%,transparent_80%)] border-l" />
                        <div className="absolute inset-0 bg-[linear-gradient(0deg,transparent_20%,rgba(255,255,255,0.3)_50%,transparent_80%)] border-t" />
                      </div>
                      <span className="text-[11px] sm:text-[14px] font-bold tracking-[0.15em] sm:tracking-[0.2em] text-slate-300 drop-shadow-sm uppercase">20BYT • {orgId ? orgId.slice(-4) : "****"}</span>
                    </div>
                    <Button 
                      onClick={() => setIsPricingDialogOpen(true)}
                      className="shrink-0 rounded-[12px] sm:rounded-[14px] bg-white text-slate-900 hover:bg-slate-100 font-bold shadow-[0_4px_14px_0_rgba(255,255,255,0.2)] h-9 px-4 sm:h-11 sm:px-6 text-[12px] sm:text-[14px] transition-all active:scale-95"
                    >
                      Perpanjang
                    </Button>
                  </div>
                </div>
              </div>
            </section>

            {/* Right Column: Riwayat Tagihan */}
            <section className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-[0_2px_10px_-4px_rgba(0,0,0,0.02)] xl:h-full">
              <div className="border-b border-border/50 px-6 py-5 flex items-center gap-2">
                <History className="h-4 w-4 text-muted-foreground/70" />
                <h2 className="text-[12px] font-bold uppercase tracking-wider text-muted-foreground/80">Riwayat Tagihan</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[500px] text-sm">
                  <thead>
                    <tr className="border-b border-border/50 bg-muted/10 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70">
                      <th className="px-6 py-3 font-medium">Order ID</th>
                      <th className="px-6 py-3 font-medium">Status & Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {charges.length === 0 ? (
                      <tr>
                        <td colSpan={2} className="py-12 text-center text-[13px] font-medium text-muted-foreground/80">
                          Belum ada riwayat tagihan.
                        </td>
                      </tr>
                    ) : (
                      charges.map((charge) => (
                        <tr key={charge.id} className="transition-colors hover:bg-muted/5">
                          <td className="px-6 py-4 font-mono text-[12px] text-foreground/80">
                            {charge.orderId}
                            <div className="mt-1 font-sans text-[11px] text-muted-foreground/70">
                              Dibuat: {formatDate(charge.createdAt)}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <span className="inline-flex rounded-md border border-border/80 bg-background/50 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                                {charge.status}
                              </span>
                              <span className="font-bold text-[13px] text-foreground">{formatIdr(charge.payableAmountCents ?? charge.totalAmountCents)}</span>
                            </div>
                            <div className="mt-1 text-[11px] font-medium text-muted-foreground/70">
                              Dibayar: {formatDate(charge.paidAt) !== "-" ? formatDate(charge.paidAt) : "Belum Dibayar"}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        <Dialog open={isPricingDialogOpen} onOpenChange={setIsPricingDialogOpen}>
          <DialogContent className="sm:max-w-[480px] p-0 rounded-[28px] overflow-hidden gap-0">
            <div className="bg-muted/30 px-6 py-5 border-b border-border/50">
              <DialogTitle className="text-[18px] font-bold text-foreground">Pilih Paket Langganan</DialogTitle>
              <DialogDescription className="text-[13px] font-medium leading-relaxed text-muted-foreground/80 mt-1">
                Pilih durasi perpanjangan yang sesuai untuk menghemat lebih banyak.
              </DialogDescription>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[75vh]">
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  {planOptions.map((plan) => {
                    const isSelected = selectedPlanMonths === plan.months;
                    const discountPercent = Math.round(plan.discountBps / 100);

                    return (
                      <button
                        key={plan.months}
                        type="button"
                        onClick={() => setSelectedPlanMonths(plan.months)}
                        className={`relative flex flex-col items-center justify-center gap-1.5 p-4 rounded-[20px] border transition-all ${isSelected ? "border-primary bg-primary/5 shadow-md shadow-primary/10 ring-1 ring-primary" : "border-border/60 bg-card hover:border-primary/50 hover:bg-muted/10"} ${hasNotExpired(paymentExpiresAt) && paymentTotalCents !== null ? "pointer-events-none opacity-50" : ""}`}
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
                      <span>{formatIdr(selectedPlan?.rawBaseAmountCents ?? pricing?.baseAmountCents ?? 0)}</span>
                    </div>
                    {(selectedPlan?.discountCents ?? 0) > 0 ? (
                      <div className="flex items-center justify-between font-bold text-emerald-600">
                        <span>Diskon Spesial ({Math.round((selectedPlan?.discountBps ?? 0) / 100)}%)</span>
                        <span>-{formatIdr(selectedPlan?.discountCents ?? 0)}</span>
                      </div>
                    ) : null}
                    <div className="flex items-center justify-between font-medium text-muted-foreground/80">
                      <span>Biaya Layanan Platform (2%)</span>
                      <span>{formatIdr(selectedPlan?.gatewayFeeCents ?? pricing?.gatewayFeeCents ?? 0)}</span>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-border/50 pt-4">
                    <span className="font-bold text-foreground">Grand Total</span>
                    <span className="text-[20px] font-bold text-foreground">
                      {formatIdr(
                        hasNotExpired(paymentExpiresAt) && paymentTotalCents !== null
                          ? paymentTotalCents
                          : selectedPlan?.totalAmountCents ?? pricing?.totalAmountCents ?? 0
                      )}
                    </span>
                  </div>
                  {hasNotExpired(paymentExpiresAt) && paymentTotalCents !== null ? (
                    <p className="mt-2 text-[11px] font-medium text-amber-600">
                      * Terdapat tagihan tertunda, abaikan jika ingin memilih ulang paket baru.
                    </p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground" htmlFor="billing-coupon-code">
                    Kode kupon (opsional)
                  </label>
                  <input
                    id="billing-coupon-code"
                    className="h-10 w-full rounded-xl border border-border/80 bg-background px-4 text-[13px] shadow-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all uppercase"
                    placeholder="Contoh: HEMAT20"
                    value={couponCode}
                    onChange={(event) => setCouponCode(event.target.value.toUpperCase())}
                    maxLength={40}
                  />
                </div>

                <div className="pt-2">
                  <Button 
                    onClick={() => void handleCheckout()} 
                    disabled={isCheckoutLoading} 
                    size="lg" 
                    className="w-full h-12 rounded-[14px] font-bold shadow-md shadow-primary/20 text-[14px]"
                  >
                    {isCheckoutLoading
                      ? "Memproses pesanan..."
                      : hasNotExpired(paymentExpiresAt) && paymentNumber && isQrisPayment
                        ? "Lanjutkan pembayaran (Tertunda)"
                        : "Bayar Sekarang"}
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={isQrDialogOpen} onOpenChange={setIsQrDialogOpen}>
          <DialogContent className="sm:max-w-[420px] p-6 rounded-[24px] gap-0">
            <DialogHeader className="space-y-1.5 pb-2">
              <DialogTitle className="text-[18px] font-bold text-foreground">Scan QR Pembayaran</DialogTitle>
              <DialogDescription className="text-[13px] font-medium leading-relaxed text-muted-foreground/80">
                Gunakan aplikasi e-wallet atau mobile banking untuk menyelesaikan pembayaran.
              </DialogDescription>
            </DialogHeader>

            <div className="py-2">
              <div className="flex flex-col items-center pb-6 pt-4">
                {paymentQrDataUrl ? (
                  <div className="flex items-center justify-center rounded-[20px] border border-border/40 bg-white p-4 shadow-[0_8px_32px_-8px_rgba(0,0,0,0.08)]">
                    <Image src={paymentQrDataUrl} alt="QR pembayaran" width={280} height={280} unoptimized className="object-contain" />
                  </div>
                ) : (
                  <div className="flex h-[280px] w-[280px] items-center justify-center rounded-[20px] border border-dashed border-border/50 bg-muted/20">
                    <p className="text-[13px] font-medium text-muted-foreground text-center px-6">
                      Menyiapkan QR...
                    </p>
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
                  <span className="text-[13px] font-bold text-amber-600 tracking-tight">{formatCountdown(paymentExpiresAt, nowMs)}</span>
                </div>
                {paymentCouponCode && paymentCouponDiscountCents > 0 ? (
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-semibold text-emerald-700">Kupon {paymentCouponCode}</span>
                    <span className="text-[13px] font-bold text-emerald-700">-{formatIdr(paymentCouponDiscountCents)}</span>
                  </div>
                ) : null}
              </div>

              <p className="mt-4 text-center text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider">
                Expired: {formatDate(paymentExpiresAt)}
              </p>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
