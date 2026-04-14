"use client";

import Image from "next/image";
import Link from "next/link";
import QRCode from "qrcode";
import { Copy, CreditCard } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";

type PaymentMethodOption = {
  value: string;
  label: string;
  feeCents: number;
  disabled?: boolean;
  autoConfirm: boolean;
};

type PaymentOptionsResponse = {
  data?: {
    invoice?: {
      id: string;
      invoiceNo: string;
      status: string;
      totalCents: number;
      currency: string;
    };
    settings?: {
      enableBankTransfer: boolean;
      enableQris: boolean;
      enabledVaMethods: string[];
      feePolicy: "MERCHANT" | "CUSTOMER";
      autoConfirmLabelEnabled: boolean;
      paymentMethodsOrder?: string[];
    };
    bankTransfer?: {
      enabled: boolean;
      autoConfirm: boolean;
      bankName?: string | null;
      accountNumber?: string | null;
      accountHolder?: string | null;
    };
    qris?: {
      method: "qris";
      feeCents: number;
      autoConfirm: boolean;
      disabled: boolean;
    } | null;
    va?: Array<{
      method: string;
      feeCents: number;
      autoConfirm: boolean;
      disabled: boolean;
    }>;
    autoConfirmLabel?: string | null;
  };
  error?: {
    message?: string;
  };
};

type PaymentPayload = {
  mode: "gateway" | "manual_bank_transfer";
  attemptId: string | null;
  invoiceId: string;
  orderId: string | null;
  paymentMethod: string;
  amountCents: number;
  feeCents: number;
  customerPayableCents: number;
  paymentNumber: string | null;
  paymentBankName?: string | null;
  paymentAccountHolder?: string | null;
  expiresAt: string | null;
  status?: string;
  autoConfirm: boolean;
  feePolicy?: "MERCHANT" | "CUSTOMER";
};

type CreatePaymentResponse = {
  data?: {
    payment?: PaymentPayload;
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
  }).format(Math.max(0, cents));
}

function formatDateTime(value: string | null): string {
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

function formatCountdown(value: string | null): string {
  if (!value) {
    return "-";
  }
  const endAt = new Date(value).getTime();
  if (!Number.isFinite(endAt)) {
    return "-";
  }

  const diffMs = Math.max(0, endAt - Date.now());
  const totalSeconds = Math.floor(diffMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;
}

function labelForMethod(value: string): string {
  if (value === "bank_transfer") return "Bank Transfer";
  if (value === "qris") return "QRIS";
  return value
    .replace(/_/g, " ")
    .toUpperCase();
}

export function PublicInvoicePayWorkspace({ token }: { token: string }) {
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<string>("bank_transfer");
  const [options, setOptions] = useState<PaymentOptionsResponse["data"] | null>(null);
  const [activePayment, setActivePayment] = useState<PaymentPayload | null>(null);
  const [qrisDataUrl, setQrisDataUrl] = useState<string | null>(null);
  const [clockTick, setClockTick] = useState(0);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/public-invoices/${encodeURIComponent(token)}/payment-options`, {
          cache: "no-store"
        });
        const payload = (await response.json().catch(() => null)) as PaymentOptionsResponse | null;
        if (!response.ok || !payload?.data) {
          throw new Error(payload?.error?.message ?? "Gagal memuat opsi pembayaran.");
        }

        if (!mounted) return;
        setOptions(payload.data);

        const firstGatewayMethod =
          (payload.data.qris?.disabled ? null : payload.data.qris?.method) ??
          payload.data.va?.find((item) => !item.disabled)?.method ??
          (payload.data.bankTransfer?.enabled ? "bank_transfer" : "");
        setSelectedMethod(firstGatewayMethod || "bank_transfer");
      } catch (loadError) {
        if (!mounted) return;
        setError(loadError instanceof Error ? loadError.message : "Gagal memuat opsi pembayaran.");
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [token]);

  useEffect(() => {
    if (!activePayment?.expiresAt) {
      return;
    }
    const timer = window.setInterval(() => {
      setClockTick((current) => current + 1);
    }, 1000);
    return () => {
      window.clearInterval(timer);
    };
  }, [activePayment?.expiresAt]);

  useEffect(() => {
    if (!activePayment?.paymentNumber || activePayment.paymentMethod !== "qris") {
      setQrisDataUrl(null);
      return;
    }

    let active = true;
    void QRCode.toDataURL(activePayment.paymentNumber, {
      margin: 1,
      width: 360,
      errorCorrectionLevel: "M"
    })
      .then((value) => {
        if (!active) return;
        setQrisDataUrl(value);
      })
      .catch(() => {
        if (!active) return;
        setQrisDataUrl(null);
      });

    return () => {
      active = false;
    };
  }, [activePayment?.paymentMethod, activePayment?.paymentNumber]);

  const methodOptions = useMemo<PaymentMethodOption[]>(() => {
    const items: PaymentMethodOption[] = [];

    if (options?.bankTransfer?.enabled) {
      items.push({
        value: "bank_transfer",
        label: "Bank Transfer",
        feeCents: 0,
        autoConfirm: false
      });
    }

    if (options?.qris) {
      items.push({
        value: options.qris.method,
        label: "QRIS",
        feeCents: options.qris.feeCents,
        disabled: options.qris.disabled,
        autoConfirm: options.qris.autoConfirm
      });
    }

    for (const va of options?.va ?? []) {
      items.push({
        value: va.method,
        label: labelForMethod(va.method),
        feeCents: va.feeCents,
        disabled: va.disabled,
        autoConfirm: va.autoConfirm
      });
    }

    if (options?.settings?.paymentMethodsOrder && options.settings.paymentMethodsOrder.length > 0) {
      const orderMap = new Map(options.settings.paymentMethodsOrder.map((id, index) => [id, index]));
      items.sort((a, b) => {
        const resolveIndex = (val: string) => {
           if (val === "bank_transfer") {
              const bankKey = Array.from(orderMap.keys()).find(k => k.startsWith("bank_"));
              if (bankKey) return orderMap.get(bankKey);
           }
           return orderMap.get(val);
        };
        const aIndex = resolveIndex(a.value);
        const bIndex = resolveIndex(b.value);
        if (aIndex !== undefined && bIndex !== undefined) return aIndex - bIndex;
        if (aIndex !== undefined) return -1;
        if (bIndex !== undefined) return 1;
        return 0;
      });
    }

    return items;
  }, [options]);

  const selectedMethodOption = methodOptions.find((item) => item.value === selectedMethod) ?? null;
  const baseAmount = options?.invoice?.totalCents ?? 0;
  const selectedFee = selectedMethodOption?.feeCents ?? 0;
  const customerPayable =
    options?.settings?.feePolicy === "CUSTOMER" ? baseAmount + selectedFee : baseAmount;

  async function handleCreatePayment() {
    if (!selectedMethod) {
      return;
    }

    try {
      setIsCreating(true);
      setError(null);
      setQrisDataUrl(null);
      const response = await fetch(`/api/public-invoices/${encodeURIComponent(token)}/payments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          method: selectedMethod
        })
      });
      const payload = (await response.json().catch(() => null)) as CreatePaymentResponse | null;
      if (!response.ok || !payload?.data?.payment) {
        throw new Error(payload?.error?.message ?? "Gagal membuat pembayaran.");
      }

      setActivePayment(payload.data.payment);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Gagal membuat pembayaran.");
    } finally {
      setIsCreating(false);
    }
  }

  async function copyText(value: string) {
    if (!value) {
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // ignore
    }
  }

  return (
    <main className="mx-auto w-full max-w-[1040px] space-y-4 p-4 md:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Pembayaran Invoice</h1>
          <p className="text-sm text-muted-foreground">
            Invoice {options?.invoice?.invoiceNo ?? "-"}
          </p>
        </div>
        <Button type="button" variant="secondary" asChild>
          <Link href={`/i/${encodeURIComponent(token)}`}>Kembali ke Invoice</Link>
        </Button>
      </div>

      {isLoading ? <p className="text-sm text-muted-foreground">Memuat opsi pembayaran...</p> : null}

      {!isLoading ? (
        <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <article className="rounded-xl border border-border/70 bg-card p-4">
            <h2 className="text-base font-semibold text-foreground">Pilih Metode Bayar</h2>
            <p className="mt-1 text-sm text-muted-foreground">VA dan QRIS terkonfirmasi otomatis tanpa konfirmasi manual.</p>

            <div className="mt-4 space-y-2">
              {methodOptions.map((method) => (
                <label key={method.value} className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm ${selectedMethod === method.value ? "border-primary bg-primary/5" : "border-border/70"} ${method.disabled ? "opacity-50" : ""}`}>
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="public-payment-method"
                      checked={selectedMethod === method.value}
                      onChange={() => setSelectedMethod(method.value)}
                      disabled={method.disabled}
                    />
                    <span>{method.label}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">Fee {formatIdr(method.feeCents)}</span>
                </label>
              ))}
            </div>

            {options?.autoConfirmLabel ? (
              <p className="mt-3 rounded-md border border-emerald-300/70 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{options.autoConfirmLabel}</p>
            ) : null}

            <div className="mt-4">
              <Button type="button" onClick={() => void handleCreatePayment()} disabled={isCreating || !selectedMethod || selectedMethodOption?.disabled}>
                <CreditCard className="mr-2 h-4 w-4" />
                {isCreating ? "Memproses..." : "Bayar"}
              </Button>
            </div>
          </article>

          <article className="rounded-xl border border-border/70 bg-card p-4">
            <h2 className="text-base font-semibold text-foreground">Rincian Pembayaran</h2>
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Metode</span>
                <span className="font-medium">{selectedMethodOption?.label ?? "-"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Nominal Invoice</span>
                <span className="font-medium">{formatIdr(baseAmount)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Biaya Metode</span>
                <span className="font-medium">{formatIdr(selectedFee)}</span>
              </div>
              <div className="flex items-center justify-between border-t border-border pt-2">
                <span className="font-semibold">Total Bayar</span>
                <span className="text-base font-semibold">{formatIdr(customerPayable)}</span>
              </div>
            </div>

            {activePayment ? (
              <div className="mt-4 space-y-3 rounded-md border border-border/70 bg-background/60 p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Tujuan Bayar</span>
                  <span className="font-medium">{labelForMethod(activePayment.paymentMethod)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Nomor Tujuan</span>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{activePayment.paymentNumber ?? "-"}</span>
                    {activePayment.paymentNumber ? (
                      <Button type="button" size="sm" variant="secondary" onClick={() => void copyText(activePayment.paymentNumber ?? "")}>Copy</Button>
                    ) : null}
                  </div>
                </div>
                {activePayment.paymentMethod === "bank_transfer" ? (
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <p>Bank: {activePayment.paymentBankName ?? options?.bankTransfer?.bankName ?? "-"}</p>
                    <p>Atas nama: {activePayment.paymentAccountHolder ?? options?.bankTransfer?.accountHolder ?? "-"}</p>
                  </div>
                ) : null}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Jumlah Bayar</span>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{formatIdr(activePayment.customerPayableCents)}</span>
                    <Button type="button" size="sm" variant="secondary" onClick={() => void copyText(String(activePayment.customerPayableCents))}>Copy</Button>
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Kadaluarsa</span>
                  <span className="font-medium">{formatDateTime(activePayment.expiresAt)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Sisa Waktu</span>
                  <span className="font-medium">{formatCountdown(activePayment.expiresAt)}</span>
                </div>

                {activePayment.paymentMethod === "qris" ? (
                  <div className="mt-2 rounded-lg border border-border/70 bg-white p-3">
                    {qrisDataUrl ? (
                      <Image src={qrisDataUrl} alt="QRIS pembayaran" width={320} height={320} unoptimized className="mx-auto h-auto w-full max-w-[300px]" />
                    ) : (
                      <p className="text-center text-sm text-muted-foreground">Menyiapkan QRIS...</p>
                    )}
                  </div>
                ) : null}
              </div>
            ) : null}
          </article>
        </section>
      ) : null}

      {error ? <p className="rounded-md border border-rose-300/70 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
    </main>
  );
}
