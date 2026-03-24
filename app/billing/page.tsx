"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import QRCode from "qrcode";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fetchJsonCached, invalidateFetchCache } from "@/lib/client/fetchCache";

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
      payment_number?: string;
      payment_method?: string;
      expired_at?: string;
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
  totalAmountCents: number;
  paymentMethod: string;
  paymentNumber: string | null;
  expiredAt: string | null;
  createdAt: string;
  paidAt: string | null;
};

type StoredActivePayment = {
  paymentNumber: string;
  paymentMethod: string;
  totalAmountCents: number;
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
  const [paymentExpiresAt, setPaymentExpiresAt] = useState<string | null>(null);
  const [paymentQrDataUrl, setPaymentQrDataUrl] = useState<string | null>(null);
  const [isQrDialogOpen, setIsQrDialogOpen] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [isLoading, setIsLoading] = useState(true);
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
        setPaymentMethod(latestPending.paymentMethod);
        setPaymentTotalCents(latestPending.totalAmountCents);
        setPaymentExpiresAt(latestPending.expiredAt);
      } else {
        setPaymentNumber(null);
        setPaymentMethod(null);
        setPaymentTotalCents(null);
        setPaymentExpiresAt(null);
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
  const status = subscriptionPayload?.subscription?.status ?? "-";
  const isQrisPayment = (paymentMethod ?? "").toLowerCase() === "qris";

  const statusBadgeClass = useMemo(() => {
    if (status === "ACTIVE") {
      return "bg-emerald-500/10 text-emerald-700 border-emerald-500/30";
    }
    if (status === "TRIALING") {
      return "bg-blue-500/10 text-blue-700 border-blue-500/30";
    }
    if (status === "PAST_DUE") {
      return "bg-amber-500/10 text-amber-700 border-amber-500/30";
    }
    return "bg-rose-500/10 text-rose-700 border-rose-500/30";
  }, [status]);

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
        setPaymentMethod(parsed.paymentMethod);
        setPaymentTotalCents(parsed.totalAmountCents);
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
      expiredAt: paymentExpiresAt
    };
    window.localStorage.setItem(storageKey, JSON.stringify(payload));
  }, [orgId, paymentExpiresAt, paymentMethod, paymentNumber, paymentTotalCents]);

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
          paymentMethod: "qris"
        })
      });

      const payload = (await response.json().catch(() => null)) as CheckoutResponse | null;
      if (!response.ok) {
        throw new Error(payload?.error?.message ?? "Failed to create checkout.");
      }

      setPaymentNumber(payload?.data?.payment?.payment_number ?? null);
      const nextPaymentMethod = payload?.data?.payment?.payment_method ?? null;
      setPaymentMethod(nextPaymentMethod);
      setPaymentTotalCents(payload?.data?.charge?.totalAmountCents ?? null);
      setPaymentExpiresAt(payload?.data?.payment?.expired_at ?? null);
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
    <div className="inbox-scroll h-full overflow-y-auto p-4 md:p-6">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <header>
          <h1 className="text-2xl font-semibold">Billing</h1>
          <p className="mt-1 text-sm text-muted-foreground">Kelola status trial/langganan dan pembayaran subscription.</p>
        </header>

        {error ? <p className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}

        <section className="rounded-2xl border border-border/70 bg-card p-4">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading subscription...</p>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-sm text-muted-foreground">Status subscription</p>
                <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusBadgeClass}`}>{status}</span>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-xl border border-border/70 p-3">
                  <p className="text-xs text-muted-foreground">Trial berakhir</p>
                  <p className="mt-1 text-sm font-medium">{formatDate(subscriptionPayload?.subscription?.trialEndAt)}</p>
                </div>
                <div className="rounded-xl border border-border/70 p-3">
                  <p className="text-xs text-muted-foreground">Grace berakhir</p>
                  <p className="mt-1 text-sm font-medium">{formatDate(subscriptionPayload?.state?.graceEndAt)}</p>
                </div>
                <div className="rounded-xl border border-border/70 p-3">
                  <p className="text-xs text-muted-foreground">Periode aktif sampai</p>
                  <p className="mt-1 text-sm font-medium">{formatDate(subscriptionPayload?.subscription?.currentPeriodEndAt)}</p>
                </div>
              </div>

              <div className="rounded-xl border border-border/70 p-3">
                <p className="text-xs text-muted-foreground">Nominal per siklus 28 hari</p>
                <p className="mt-1 text-sm">Base: {formatIdr(pricing?.baseAmountCents ?? 0)}</p>
                <p className="text-sm">Fee gateway 2%: {formatIdr(pricing?.gatewayFeeCents ?? 0)}</p>
                <p className="mt-1 text-base font-semibold">Total: {formatIdr(pricing?.totalAmountCents ?? 0)}</p>
              </div>

              <Button onClick={() => void handleCheckout()} disabled={isCheckoutLoading}>
                {isCheckoutLoading
                  ? "Membuat checkout..."
                  : hasNotExpired(paymentExpiresAt) && paymentNumber && isQrisPayment
                    ? "Lanjutkan pembayaran"
                    : "Bayar sekarang"}
              </Button>
            </div>
          )}
        </section>

        <Dialog open={isQrDialogOpen} onOpenChange={setIsQrDialogOpen}>
          <DialogContent className="sm:max-w-[460px]">
            <DialogHeader>
              <DialogTitle>Scan QR Pembayaran</DialogTitle>
              <DialogDescription>Gunakan aplikasi e-wallet atau mobile banking untuk menyelesaikan pembayaran.</DialogDescription>
            </DialogHeader>
            {paymentQrDataUrl ? (
              <div className="mx-auto inline-flex rounded-xl border border-border/70 bg-white p-3">
                <Image src={paymentQrDataUrl} alt="QR pembayaran" width={360} height={360} unoptimized />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">QR belum tersedia.</p>
            )}
            <div className="space-y-1 rounded-lg border border-border/70 bg-muted/30 px-3 py-2 text-sm">
              <p>
                Nominal yang harus dibayar: <span className="font-semibold">{formatIdr(paymentTotalCents ?? 0)}</span>
              </p>
              <p>
                Sisa waktu pembayaran:{" "}
                <span className="font-mono font-semibold text-amber-700">{formatCountdown(paymentExpiresAt, nowMs)}</span>
              </p>
            </div>
            <p className="text-xs text-muted-foreground">Expired: {formatDate(paymentExpiresAt)}</p>
          </DialogContent>
        </Dialog>

        <section className="rounded-2xl border border-border/70 bg-card p-4">
          <h2 className="text-lg font-semibold">Riwayat Tagihan</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border/70 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2">Order ID</th>
                  <th className="py-2">Status</th>
                  <th className="py-2">Total</th>
                  <th className="py-2">Dibuat</th>
                  <th className="py-2">Dibayar</th>
                </tr>
              </thead>
              <tbody>
                {charges.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-4 text-center text-muted-foreground">
                      Belum ada tagihan.
                    </td>
                  </tr>
                ) : (
                  charges.map((charge) => (
                    <tr key={charge.id} className="border-b border-border/50">
                      <td className="py-2 font-mono text-xs">{charge.orderId}</td>
                      <td className="py-2">{charge.status}</td>
                      <td className="py-2">{formatIdr(charge.totalAmountCents)}</td>
                      <td className="py-2">{formatDate(charge.createdAt)}</td>
                      <td className="py-2">{formatDate(charge.paidAt)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
